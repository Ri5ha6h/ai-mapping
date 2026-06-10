from datetime import datetime
from typing import Any

from app.api.models import MappingRule, ValidationErrorItem
from app.core.mapping.optional_jsonata_runtime import (
    UnsupportedJsonataExpression,
    evaluate_jsonata_expression,
)
from app.core.mapping.path_utils import MISSING, get_path, relative_item_path, set_path


class TransformExecutionError(RuntimeError):
    def __init__(self, message: str, *, rule_id: str, path: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.rule_id = rule_id
        self.path = path


def execute_rules(
    source_data: Any,
    rules: list[MappingRule],
) -> tuple[dict[str, Any], list[ValidationErrorItem]]:
    output: dict[str, Any] = {}
    errors: list[ValidationErrorItem] = []

    for rule in rules:
        try:
            value = _execute_rule(source_data, rule)
            set_path(output, rule.target_path, value)
        except TransformExecutionError as exc:
            errors.append(
                ValidationErrorItem(
                    code="failed_transformation",
                    path=exc.path,
                    message=exc.message,
                    rule_id=exc.rule_id,
                )
            )
        except ValueError as exc:
            errors.append(
                ValidationErrorItem(
                    code="failed_transformation",
                    path=rule.target_path,
                    message=str(exc),
                    rule_id=rule.id,
                )
            )

    return output, errors


def _execute_rule(source_data: Any, rule: MappingRule) -> Any:
    if rule.jsonata:
        try:
            value = evaluate_jsonata_expression(source_data, rule.jsonata)
        except UnsupportedJsonataExpression:
            value = MISSING
        if value is not MISSING:
            return value

    match rule.type:
        case "field":
            return _required_source_value(source_data, rule)
        case "constant":
            return rule.value
        case "concat":
            values = [
                str(_required_path_value(source_data, path, rule))
                for path in rule.source_paths
            ]
            return rule.separator.join(values)
        case "date_format":
            raw_value = _required_source_value(source_data, rule)
            return datetime.strptime(str(raw_value), rule.input_format).strftime(rule.output_format)
        case "condition":
            if not rule.condition:
                raise TransformExecutionError(
                    "Condition rule is missing condition config.",
                    rule_id=rule.id,
                )
            actual = _required_path_value(source_data, rule.condition.source_path, rule)
            if actual == rule.condition.equals:
                return rule.condition.then
            return rule.condition.otherwise
        case "loop":
            return _execute_loop(source_data, rule)


def _execute_loop(source_data: Any, rule: MappingRule) -> list[Any]:
    if not rule.loop:
        raise TransformExecutionError("Loop rule is missing loop config.", rule_id=rule.id)

    source_items = _required_path_value(source_data, rule.loop.source_path, rule)
    if not isinstance(source_items, list):
        raise TransformExecutionError(
            f"Loop source path {rule.loop.source_path} is not an array.",
            rule_id=rule.id,
            path=rule.loop.source_path,
        )

    mapped_items: list[Any] = []
    for item in source_items:
        item_output: dict[str, Any] = {}
        for child_rule in rule.loop.rules:
            item_rule = child_rule.model_copy(
                update={"source_path": _relative_source(child_rule)}
            )
            value = _execute_rule(item, item_rule)
            set_path(item_output, child_rule.target_path, value)
        mapped_items.append(item_output)
    return mapped_items


def _required_source_value(source_data: Any, rule: MappingRule) -> Any:
    if not rule.source_path:
        raise TransformExecutionError("Rule is missing source_path.", rule_id=rule.id)
    return _required_path_value(source_data, rule.source_path, rule)


def _required_path_value(source_data: Any, path: str, rule: MappingRule) -> Any:
    value = get_path(source_data, path)
    if value is MISSING:
        raise TransformExecutionError(
            f"Source path {path} was not found.",
            rule_id=rule.id,
            path=path,
        )
    return value


def _relative_source(rule: MappingRule) -> str | None:
    return relative_item_path(rule.source_path) if rule.source_path else None
