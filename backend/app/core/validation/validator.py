from typing import Any

from app.api.models import MappingRule, SchemaNode, ValidationErrorItem
from app.core.mapping.path_utils import MISSING, get_path


def validate_mapping(
    *,
    source_data: Any | None,
    output: Any | None,
    rules: list[MappingRule],
    target_schema: SchemaNode | None,
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    errors.extend(_validate_source_paths(source_data, rules))
    errors.extend(_validate_jsonata_metadata(rules))

    if target_schema is not None:
        errors.extend(_validate_required_targets(rules, target_schema))
        if output is not None:
            errors.extend(_validate_output_types(output, target_schema))

    return errors


def _validate_source_paths(
    source_data: Any | None,
    rules: list[MappingRule],
) -> list[ValidationErrorItem]:
    if source_data is None:
        return []

    errors: list[ValidationErrorItem] = []
    for rule in rules:
        paths = _rule_source_paths(rule)
        for path in paths:
            if get_path(source_data, path) is MISSING:
                errors.append(
                    ValidationErrorItem(
                        code="missing_source_path",
                        path=path,
                        message=f"Source path {path} was not found.",
                        rule_id=rule.id,
                    )
                )
    return errors


def _validate_jsonata_metadata(rules: list[MappingRule]) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    for rule in rules:
        if rule.jsonata and not _balanced_expression(rule.jsonata):
            errors.append(
                ValidationErrorItem(
                    code="invalid_jsonata_expression",
                    path=rule.target_path,
                    message=f"JSONata metadata for rule {rule.id} has unbalanced delimiters.",
                    rule_id=rule.id,
                )
            )
    return errors


def _validate_required_targets(
    rules: list[MappingRule],
    target_schema: SchemaNode,
) -> list[ValidationErrorItem]:
    mapped_paths = {_normalize_target_path(path) for rule in rules for path in _rule_target_paths(rule)}
    errors: list[ValidationErrorItem] = []

    for leaf in _required_leaf_nodes(target_schema):
        if _normalize_target_path(leaf.path) not in mapped_paths:
            errors.append(
                ValidationErrorItem(
                    code="unmapped_required_target_field",
                    path=leaf.path,
                    message=f"Required target field {leaf.path} is not mapped.",
                )
            )
    return errors


def _validate_output_types(output: Any, target_schema: SchemaNode) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    for leaf in _required_leaf_nodes(target_schema):
        value = get_path(output, leaf.path)
        if value is MISSING:
            continue
        if isinstance(value, list):
            if any(not _matches_schema_type(item, leaf.type) for item in value):
                errors.append(
                    ValidationErrorItem(
                        code="type_mismatch",
                        path=leaf.path,
                        message=f"Output value at {leaf.path} does not match target type {leaf.type}.",
                    )
                )
            continue
        if not _matches_schema_type(value, leaf.type):
            errors.append(
                ValidationErrorItem(
                    code="type_mismatch",
                    path=leaf.path,
                    message=f"Output value at {leaf.path} does not match target type {leaf.type}.",
                )
            )
    return errors


def _rule_source_paths(rule: MappingRule) -> list[str]:
    match rule.type:
        case "field" | "date_format":
            return [rule.source_path] if rule.source_path else []
        case "concat":
            return rule.source_paths
        case "condition":
            return [rule.condition.source_path] if rule.condition else []
        case "loop":
            return [rule.loop.source_path] if rule.loop else []
        case "constant":
            return []
    return []


def _rule_target_paths(rule: MappingRule) -> list[str]:
    if rule.type != "loop" or not rule.loop:
        return [rule.target_path]

    target_paths = [rule.target_path]
    for child_rule in rule.loop.rules:
        child_path = child_rule.target_path.removeprefix("$.")
        target_paths.append(f"{rule.target_path}[*].{child_path}")
    return target_paths


def _required_leaf_nodes(schema: SchemaNode) -> list[SchemaNode]:
    if schema.type == "object" and schema.fields:
        nodes: list[SchemaNode] = []
        for child in schema.fields.values():
            nodes.extend(_required_leaf_nodes(child))
        return nodes

    if schema.type == "array" and schema.items:
        return _required_leaf_nodes(schema.items)

    return [schema] if schema.required else []


def _matches_schema_type(value: Any, schema_type: str) -> bool:
    match schema_type:
        case "string":
            return isinstance(value, str)
        case "integer":
            return isinstance(value, int) and not isinstance(value, bool)
        case "number":
            return isinstance(value, int | float) and not isinstance(value, bool)
        case "boolean":
            return isinstance(value, bool)
        case "null":
            return value is None
        case "mixed":
            return True
        case _:
            return True


def _balanced_expression(expression: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    for character in expression:
        if character in "([{":
            stack.append(character)
        elif character in pairs and (not stack or stack.pop() != pairs[character]):
            return False
    return not stack


def _normalize_target_path(path: str) -> str:
    return path.replace("[*]", "")
