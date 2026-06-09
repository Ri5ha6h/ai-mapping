import re
from dataclasses import dataclass

from app.api.models import MappingSuggestion, RuleType, SchemaNode, SuggestionSource


@dataclass(frozen=True)
class FieldInfo:
    path: str
    type: str
    required: bool
    tokens: set[str]
    canonical_tokens: set[str]


SYNONYM_GROUPS: tuple[set[str], ...] = (
    {"tracking", "trackingnumber", "trackingno", "track", "number", "trk"},
    {"shipment", "shipmentid", "ship", "shipid", "load", "loadid"},
    {"carrier", "carriercode", "scac", "maersk"},
    {"event", "status", "statuscode", "code"},
    {"date", "datetime", "timestamp", "time", "eventtime"},
    {"location", "city", "state", "country", "address"},
    {"quantity", "qty", "count", "pieces", "units"},
    {"item", "sku", "product", "part", "line"},
    {"container", "equipment", "trailer"},
    {"order", "orderno", "purchaseorder", "po", "bol", "billoflading"},
)

CANONICAL_SYNONYMS: dict[str, str] = {
    token: sorted(group)[0] for group in SYNONYM_GROUPS for token in group
}

TYPE_COMPATIBILITY: dict[str, set[str]] = {
    "string": {"string", "integer", "number", "boolean"},
    "integer": {"integer", "number", "string"},
    "number": {"number", "integer", "string"},
    "boolean": {"boolean", "string"},
}


def suggest_rule_based_mappings(
    source_schema: SchemaNode,
    target_schema: SchemaNode,
) -> list[MappingSuggestion]:
    source_fields = _flatten_leaf_fields(source_schema)
    target_fields = _flatten_leaf_fields(target_schema)
    suggestions: list[MappingSuggestion] = []

    for target in target_fields:
        ranked = sorted(
            (
                (_score_candidate(source, target), source)
                for source in source_fields
                if _is_mappable_type(source.type) and _is_mappable_type(target.type)
            ),
            key=lambda item: item[0],
            reverse=True,
        )
        if not ranked:
            continue

        score, source = ranked[0]
        if score < 0.35:
            continue

        suggestions.append(
            MappingSuggestion(
                id=f"rule_{len(suggestions) + 1:03d}",
                type=RuleType.field,
                source_path=source.path,
                target_path=target.path,
                required=target.required,
                confidence=round(score, 2),
                jsonata=_jsonata_for_source_path(source.path),
                explanation=_explanation(source, target, score),
                source=SuggestionSource.rule_based,
            )
        )

    return suggestions


def _flatten_leaf_fields(schema: SchemaNode) -> list[FieldInfo]:
    fields: list[FieldInfo] = []
    _walk_schema(schema, fields)
    return fields


def _walk_schema(node: SchemaNode, fields: list[FieldInfo]) -> None:
    if node.type == "object" and node.fields:
        for child in node.fields.values():
            _walk_schema(child, fields)
        return

    if node.type == "array" and node.items:
        _walk_schema(node.items, fields)
        return

    fields.append(
        FieldInfo(
            path=node.path,
            type=node.type,
            required=node.required,
            tokens=_path_tokens(node.path),
            canonical_tokens=_canonical_tokens(_path_tokens(node.path)),
        )
    )


def _score_candidate(source: FieldInfo, target: FieldInfo) -> float:
    exact_token_score = _jaccard(source.tokens, target.tokens)
    synonym_score = _jaccard(source.canonical_tokens, target.canonical_tokens)
    ending_score = 1.0 if _last_token(source.path) == _last_token(target.path) else 0.0
    type_score = _type_score(source.type, target.type)

    score = (
        0.35 * synonym_score
        + 0.25 * exact_token_score
        + 0.2 * ending_score
        + 0.2 * type_score
    )
    return min(score, 1.0)


def _path_tokens(path: str) -> set[str]:
    tokens: set[str] = set()
    for part in re.split(r"[.\[\]_*@#-]+", path.lower().replace("$", "")):
        if not part:
            continue
        tokens.update(_split_camel(part))
        tokens.add(part)
    return tokens


def _split_camel(value: str) -> set[str]:
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", value)
    return {token.lower() for token in re.split(r"\W+", spaced) if token}


def _canonical_tokens(tokens: set[str]) -> set[str]:
    return {CANONICAL_SYNONYMS.get(token, token) for token in tokens}


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _last_token(path: str) -> str:
    tokens = _path_tokens(path)
    parts = [part for part in re.split(r"[.\[\]]+", path.lower().replace("$", "")) if part]
    if not parts:
        return ""
    last_part_tokens = _path_tokens(parts[-1])
    return next(iter(_canonical_tokens(last_part_tokens or tokens)), "")


def _type_score(source_type: str, target_type: str) -> float:
    if source_type == target_type:
        return 1.0
    if source_type in TYPE_COMPATIBILITY.get(target_type, set()):
        return 0.7
    return 0.0


def _is_mappable_type(schema_type: str) -> bool:
    return schema_type in {"string", "integer", "number", "boolean", "null", "mixed"}


def _jsonata_for_source_path(path: str) -> str:
    if path == "$":
        return "$"
    return path.removeprefix("$.").replace("[*]", "")


def _explanation(source: FieldInfo, target: FieldInfo, score: float) -> str:
    return (
        f"Matched {source.path} to {target.path} using name, synonym, path ending, "
        f"and type similarity; confidence {score:.2f}."
    )

