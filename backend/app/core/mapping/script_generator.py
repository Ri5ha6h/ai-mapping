import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.api.models import MappingSpec, MappingSuggestion, SchemaNode

ScriptGenerator = Callable[
    [Any, Any, SchemaNode | None, SchemaNode | None, list[MappingSuggestion], str, str],
    str,
]


@dataclass(frozen=True)
class SourceLeaf:
    path: str
    value: Any
    normalized_path: str
    normalized_leaf: str
    variable_name: str


@dataclass(frozen=True)
class GeneratedExpression:
    code: str
    unresolved: bool = False
    comment: str | None = None


def generate_script_draft(
    *,
    source_sample: Any,
    target_sample: Any,
    source_schema: SchemaNode | None = None,
    target_schema: SchemaNode | None = None,
    field_hints: list[MappingSuggestion] | None = None,
    domain_context: str = "",
    use_ai: bool = False,
    ai_available: bool = False,
    ai_generator: ScriptGenerator | None = None,
) -> tuple[MappingSpec, str, list[str], bool, list[str]]:
    local_script, unresolved = generate_deterministic_script(source_sample, target_sample)
    provider_errors: list[str] = []

    if use_ai:
        if not ai_available or ai_generator is None:
            provider_errors.append(
                "AI script generation is not configured; used deterministic draft."
            )
        else:
            try:
                ai_script = ai_generator(
                    source_sample,
                    target_sample,
                    source_schema,
                    target_schema,
                    field_hints or [],
                    domain_context,
                    local_script,
                )
            except Exception as exc:  # noqa: BLE001 - provider failures must fall back safely.
                provider_errors.append(
                    f"AI script generation failed; used deterministic draft. {exc}"
                )
            else:
                if _is_complete_transform(ai_script):
                    return (
                        MappingSpec(engine="script_js", script=ai_script),
                        (
                            "Generated an AI-assisted transform from the local draft and "
                            "schema context."
                        ),
                        unresolved,
                        True,
                        provider_errors,
                    )
                provider_errors.append(
                    "AI script generation returned an invalid transform; used deterministic draft."
                )

    explanation = (
        "Generated a readable starter transform from matching source and target fields. "
        "Review TODO comments for unresolved target values."
    )
    return (
        MappingSpec(engine="script_js", script=local_script),
        explanation,
        unresolved,
        False,
        provider_errors,
    )


def generate_deterministic_script(
    source_sample: Any,
    target_sample: Any,
) -> tuple[str, list[str]]:
    source_leaves = list(_leaf_paths(source_sample))
    variable_sources = _selected_variable_sources(source_leaves, target_sample)
    variable_lines = [
        (
            f"  const {leaf.variable_name} = helpers.get(source, "
            f"{json.dumps(leaf.path)}, {json.dumps(_fallback_for(leaf.value))});"
        )
        for leaf in variable_sources
    ]

    body_code, unresolved = _target_expression(
        target_sample,
        source_leaves,
        variable_sources,
        path="$",
        indent=2,
    )
    lines = [
        "function transform(source, helpers) {",
        "  // source is the parsed input object. XML and EDI inputs arrive as canonical JSON.",
        (
            "  // helpers includes get, default, clean, regexReplace, parseNumber, "
            "formatDate, lookup, countryCode, omitEmpty."
        ),
        '  // Example: helpers.get(source, "$.customer.name", "")',
    ]
    if variable_lines:
        lines.append("")
        lines.extend(variable_lines)
    lines.extend(["", f"  return {body_code};", "}"])
    return "\n".join(lines), unresolved


def _target_expression(
    target: Any,
    source_leaves: list[SourceLeaf],
    variable_sources: list[SourceLeaf],
    *,
    path: str,
    indent: int,
) -> tuple[str, list[str]]:
    space = " " * indent
    child_space = " " * (indent + 2)
    unresolved: list[str] = []

    if isinstance(target, dict):
        lines = ["{"]
        for key, value in target.items():
            child_path = f"{path}.{key}"
            expression, child_unresolved = _target_expression(
                value,
                source_leaves,
                variable_sources,
                path=child_path,
                indent=indent + 2,
            )
            lines.append(f"{child_space}{json.dumps(key)}: {expression},")
            unresolved.extend(child_unresolved)
        lines.append(f"{space}}}")
        return "\n".join(lines), unresolved

    if isinstance(target, list):
        if not target:
            return "[]", []
        expression, child_unresolved = _target_expression(
            target[0],
            source_leaves,
            variable_sources,
            path=f"{path}[0]",
            indent=indent + 2,
        )
        return f"[\n{child_space}{expression}\n{space}]", child_unresolved

    generated = _scalar_expression(path, target, source_leaves, variable_sources)
    if generated.unresolved:
        unresolved.append(path)
    return generated.code, unresolved


def _scalar_expression(
    target_path: str,
    target_value: Any,
    source_leaves: list[SourceLeaf],
    variable_sources: list[SourceLeaf],
) -> GeneratedExpression:
    target_leaf = _normalize_segment(target_path.rsplit(".", maxsplit=1)[-1])

    if target_leaf in {"full", "fullname", "name"}:
        first = _find_leaf(source_leaves, {"first", "firstname", "givenname"})
        last = _find_leaf(source_leaves, {"last", "lastname", "surname", "familyname"})
        if first and last:
            return GeneratedExpression(
                f"[{_var_for(first, variable_sources)}, {_var_for(last, variable_sources)}]"
                '.filter(Boolean).join(" ")'
            )

    if target_leaf in {"pronoun", "pronouns"}:
        gender = _find_leaf(source_leaves, {"gender", "sex"})
        if gender:
            return GeneratedExpression(
                "helpers.lookup("
                '{ male: "he", female: "she", other: "they", m: "he", f: "she" }, '
                f"{_var_for(gender, variable_sources)}, "
                f"{json.dumps(target_value)}"
                ")"
            )

    source_match = _best_source_match(target_path, target_value, source_leaves)
    if source_match is not None:
        return GeneratedExpression(_var_for(source_match, variable_sources))

    return GeneratedExpression(
        f"/* TODO: confirm mapping for {target_path}. */ {json.dumps(target_value)}",
        unresolved=True,
    )


def _selected_variable_sources(
    source_leaves: list[SourceLeaf],
    target_sample: Any,
) -> list[SourceLeaf]:
    target_paths = _target_leaf_paths(target_sample)
    selected: list[SourceLeaf] = []
    for path, value in target_paths:
        match = _best_source_match(path, value, source_leaves)
        if match is not None and match not in selected:
            selected.append(match)

    for names in ({"first", "firstname", "givenname"}, {"last", "lastname", "surname"}, {"gender"}):
        match = _find_leaf(source_leaves, names)
        if match is not None and match not in selected:
            selected.append(match)

    return selected


def _best_source_match(
    target_path: str,
    target_value: Any,
    source_leaves: list[SourceLeaf],
) -> SourceLeaf | None:
    target_name = _normalize_path_name(target_path)
    target_leaf = _normalize_segment(target_path.rsplit(".", maxsplit=1)[-1])

    for source_leaf in source_leaves:
        if (
            source_leaf.normalized_leaf == target_leaf
            or source_leaf.normalized_leaf.endswith(target_leaf)
            or target_leaf.endswith(source_leaf.normalized_leaf)
        ) and _same_scalar_type(target_value, source_leaf.value):
            return source_leaf

    for source_leaf in source_leaves:
        if source_leaf.normalized_path == target_name and _same_scalar_type(
            target_value, source_leaf.value
        ):
            return source_leaf

    return None


def _leaf_paths(value: Any, *, path: str = "$") -> list[SourceLeaf]:
    if isinstance(value, dict):
        leaves: list[SourceLeaf] = []
        for key, child in value.items():
            leaves.extend(_leaf_paths(child, path=f"{path}.{key}"))
        return leaves
    if isinstance(value, list):
        leaves = []
        for index, child in enumerate(value[:1]):
            leaves.extend(_leaf_paths(child, path=f"{path}[{index}]"))
        return leaves
    return [
        SourceLeaf(
            path=path,
            value=value,
            normalized_path=_normalize_path_name(path),
            normalized_leaf=_normalize_segment(path.rsplit(".", maxsplit=1)[-1]),
            variable_name=_variable_name(path),
        )
    ]


def _target_leaf_paths(value: Any, *, path: str = "$") -> list[tuple[str, Any]]:
    if isinstance(value, dict):
        leaves: list[tuple[str, Any]] = []
        for key, child in value.items():
            leaves.extend(_target_leaf_paths(child, path=f"{path}.{key}"))
        return leaves
    if isinstance(value, list):
        leaves = []
        for index, child in enumerate(value[:1]):
            leaves.extend(_target_leaf_paths(child, path=f"{path}[{index}]"))
        return leaves
    return [(path, value)]


def _find_leaf(source_leaves: list[SourceLeaf], names: set[str]) -> SourceLeaf | None:
    for leaf in source_leaves:
        if leaf.normalized_leaf in names:
            return leaf
    return None


def _var_for(leaf: SourceLeaf, variable_sources: list[SourceLeaf]) -> str:
    if leaf in variable_sources:
        return leaf.variable_name
    return f"helpers.get(source, {json.dumps(leaf.path)}, {json.dumps(_fallback_for(leaf.value))})"


def _same_scalar_type(left: Any, right: Any) -> bool:
    if left is None or right is None:
        return True
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool)
    if isinstance(left, int | float) or isinstance(right, int | float):
        return isinstance(left, int | float) and isinstance(right, int | float)
    return isinstance(left, str) and isinstance(right, str)


def _normalize_path_name(path: str) -> str:
    parts = re.sub(r"\[\d+\]", "", path).strip("$.").split(".")
    return "_".join(_normalize_segment(part) for part in parts if part)


def _normalize_segment(segment: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", segment.lower())


def _variable_name(path: str) -> str:
    parts = [
        _normalize_segment(part)
        for part in re.sub(r"\[\d+\]", "", path).strip("$.").split(".")
        if part
    ]
    if not parts:
        return "value"
    name = parts[-1]
    for prefix in reversed(parts[:-1]):
        if name not in {"id", "name", "type", "code", "value"}:
            break
        name = f"{prefix}_{name}"
    camel = re.sub(r"_([a-z0-9])", lambda match: match.group(1).upper(), name)
    return camel if not camel[:1].isdigit() else f"value{camel}"


def _fallback_for(value: Any) -> Any:
    if isinstance(value, bool):
        return False
    if isinstance(value, int | float):
        return 0
    return ""


def _is_complete_transform(script: str) -> bool:
    return bool(re.search(r"function\s+transform\s*\(\s*source\s*,\s*helpers\s*\)", script)) and (
        "return" in script
    )
