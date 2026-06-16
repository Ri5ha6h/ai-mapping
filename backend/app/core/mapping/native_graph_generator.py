import re
from typing import Any

from app.api.models import MappingSpec, NativeGraphNode, NativeGraphSpec


def generate_native_graph_draft(
    *,
    source_sample: Any,
    target_sample: Any,
    use_ai: bool = False,
    ai_available: bool = False,
) -> tuple[MappingSpec, list[str], bool, list[str]]:
    source_leaves = _leaf_paths(source_sample)
    target_template, unresolved = _target_template(target_sample, source_leaves)
    provider_errors = []
    if use_ai and not ai_available:
        provider_errors.append("AI graph generation is not configured; used deterministic draft.")

    graph = NativeGraphSpec(
        spec_version=1,
        nodes=[
            NativeGraphNode(
                id="draft-template",
                type="template",
                target_path="$",
                value=target_template,
            )
        ],
    )
    return (
        MappingSpec(engine="native_graph", spec_version=1, rules=[], native_graph=graph),
        unresolved,
        False,
        provider_errors,
    )


def _target_template(
    target: Any,
    source_leaves: dict[str, tuple[str, Any]],
    *,
    path: str = "$",
) -> tuple[Any, list[str]]:
    unresolved: list[str] = []
    if isinstance(target, dict):
        result = {}
        for key, value in target.items():
            child, child_unresolved = _target_template(
                value,
                source_leaves,
                path=f"{path}.{key}",
            )
            result[key] = child
            unresolved.extend(child_unresolved)
        return result, unresolved
    if isinstance(target, list):
        if not target:
            return [], []
        child, child_unresolved = _target_template(target[0], source_leaves, path=f"{path}[0]")
        return [child], child_unresolved

    source_match = _best_source_match(path, target, source_leaves)
    if source_match is None:
        return {"$literal": target}, [path]
    return {"$path": source_match, "default": target}, []


def _leaf_paths(value: Any, *, path: str = "$") -> dict[str, tuple[str, Any]]:
    if isinstance(value, dict):
        leaves: dict[str, tuple[str, Any]] = {}
        for key, child in value.items():
            leaves.update(_leaf_paths(child, path=f"{path}.{key}"))
        return leaves
    if isinstance(value, list):
        leaves = {}
        for index, child in enumerate(value[:1]):
            leaves.update(_leaf_paths(child, path=f"{path}[{index}]"))
        return leaves
    return {_normalize_path_name(path): (path, value)}


def _best_source_match(
    target_path: str,
    target_value: Any,
    source_leaves: dict[str, tuple[str, Any]],
) -> str | None:
    target_name = _normalize_path_name(target_path)
    target_leaf = _normalize_segment(target_path.rsplit(".", maxsplit=1)[-1])
    for source_path, source_value in source_leaves.values():
        source_leaf = _normalize_segment(source_path.rsplit(".", maxsplit=1)[-1])
        if (
            (target_leaf == source_leaf or source_leaf.endswith(target_leaf))
            and _same_scalar_type(target_value, source_value)
        ):
            return source_path
    if target_name in source_leaves:
        return source_leaves[target_name][0]
    candidates = [
        (name, source_path, source_value)
        for name, (source_path, source_value) in source_leaves.items()
        if name.endswith(target_name) or target_name.endswith(name)
    ]
    typed = [
        (name, source_path)
        for name, source_path, source_value in candidates
        if _same_scalar_type(target_value, source_value)
    ]
    if typed:
        return sorted(typed, key=lambda item: len(item[0]))[0][1]
    return None


def _same_scalar_type(left: Any, right: Any) -> bool:
    if left is None or right is None:
        return True
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool)
    if isinstance(left, (int, float)) or isinstance(right, (int, float)):
        return isinstance(left, (int, float)) and isinstance(right, (int, float))
    return isinstance(left, str) and isinstance(right, str)


def _normalize_path_name(path: str) -> str:
    parts = re.sub(r"\[\d+\]", "", path).strip("$.").split(".")
    return "_".join(_normalize_segment(part) for part in parts if part)


def _normalize_segment(segment: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", segment.lower())
