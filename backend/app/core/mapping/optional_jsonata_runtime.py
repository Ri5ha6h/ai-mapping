import json
import re
from typing import Any

from app.api.models import MappingRule
from app.core.mapping.path_utils import MISSING, get_path


class UnsupportedJsonataExpression(ValueError):
    pass


def jsonata_metadata_only(rules: list[MappingRule]) -> list[str]:
    return [rule.jsonata for rule in rules if rule.jsonata]


def evaluate_jsonata_expression(source_data: Any, expression: str) -> Any:
    expression = expression.strip()
    if not expression:
        raise UnsupportedJsonataExpression("JSONata expression is empty.")

    terms = _split_concat_terms(expression)
    if len(terms) > 1:
        values = [_evaluate_term(source_data, term) for term in terms]
        if any(value is MISSING for value in values):
            return MISSING
        return "".join(str(value) for value in values)

    return _evaluate_term(source_data, expression)


def _split_concat_terms(expression: str) -> list[str]:
    terms: list[str] = []
    current: list[str] = []
    quote: str | None = None
    escaped = False

    for character in expression:
        if quote:
            current.append(character)
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue

        if character in ('"', "'"):
            quote = character
            current.append(character)
            continue

        if character == "&":
            terms.append("".join(current).strip())
            current = []
            continue

        current.append(character)

    if quote:
        raise UnsupportedJsonataExpression("Unclosed JSONata string literal.")

    terms.append("".join(current).strip())
    return terms


def _evaluate_term(source_data: Any, term: str) -> Any:
    if not term:
        raise UnsupportedJsonataExpression("Empty JSONata concatenation term.")

    if _is_string_literal(term):
        return json.loads(term if term.startswith('"') else json.dumps(term[1:-1]))

    if term in {"true", "false", "null"}:
        return json.loads(term)

    if re.fullmatch(r"-?\d+(?:\.\d+)?", term):
        return json.loads(term)

    if re.fullmatch(r"\$?(?:\.?[A-Za-z_][\w-]*)(?:\.[A-Za-z_][\w-]*)*", term):
        return get_path(source_data, _jsonata_path_to_runtime_path(term))

    raise UnsupportedJsonataExpression(f"Unsupported JSONata expression: {term}")


def _is_string_literal(term: str) -> bool:
    return (
        len(term) >= 2
        and ((term[0] == '"' and term[-1] == '"') or (term[0] == "'" and term[-1] == "'"))
    )


def _jsonata_path_to_runtime_path(term: str) -> str:
    if term.startswith("$."):
        return term
    if term.startswith("$"):
        return f"$.{term[1:].lstrip('.')}"
    return f"$.{term}"
