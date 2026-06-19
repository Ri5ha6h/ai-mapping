from typing import Any

from app.api.models import (
    FieldValidationRuleUpsertRequest,
    MappingSpec,
    OutputFormat,
    SchemaNode,
    ValidationErrorItem,
)
from app.core.mapping.path_utils import MISSING, get_path
from app.core.validation.policy import validation_policy_for


def validate_script_mapping(
    *,
    mapping_spec: MappingSpec | None,
    output: Any | None,
    target_schema: SchemaNode | None,
    output_format: OutputFormat = OutputFormat.json,
    field_validation_rules: list[FieldValidationRuleUpsertRequest] | None = None,
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    if mapping_spec is None or mapping_spec.engine != "script_js":
        errors.append(
            ValidationErrorItem(
                code="missing_script_mapping",
                message="A script_js mapping specification is required.",
                rule_id="script",
            )
        )
    elif not mapping_spec.script.strip():
        errors.append(
            ValidationErrorItem(
                code="missing_script",
                message="Transform function is required.",
                rule_id="script",
            )
        )

    policy = validation_policy_for(output_format)
    if policy.validates_target_schema and output is not None:
        if target_schema is not None:
            errors.extend(_validate_required_output(output, target_schema))
            errors.extend(_validate_output_types(output, target_schema))
        errors.extend(_validate_field_rules(output, field_validation_rules or []))
    return errors


def _validate_field_rules(
    output: Any,
    rules: list[FieldValidationRuleUpsertRequest],
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    for rule in rules:
        value = get_path(output, rule.path)
        values = _flatten_values(value) if isinstance(value, list) else [value]
        present_values = [item for item in values if item is not MISSING and item is not None and item != ""]
        if rule.required and not present_values:
            errors.append(
                ValidationErrorItem(
                    code="field_rule_required",
                    path=rule.path,
                    message=f"Field rule requires {rule.path} to be present.",
                    rule_id=rule.path,
                )
            )
            continue
        if value is MISSING or not present_values:
            continue
        for item in present_values:
            if not _matches_schema_type(item, rule.value_type):
                errors.append(
                    ValidationErrorItem(
                        code="field_rule_type_mismatch",
                        path=rule.path,
                        message=f"Field rule expects {rule.path} to be {rule.value_type}.",
                        rule_id=rule.path,
                    )
                )
                break
        errors.extend(_validate_rule_bounds(rule, present_values))
    return errors


def _validate_rule_bounds(
    rule: FieldValidationRuleUpsertRequest,
    values: list[Any],
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    for value in values:
        if rule.min_length is not None and hasattr(value, "__len__") and len(value) < rule.min_length:
            errors.append(_field_rule_error("field_rule_min_length", rule, f"Field rule expects {rule.path} length to be at least {rule.min_length}."))
            break
        if rule.max_length is not None and hasattr(value, "__len__") and len(value) > rule.max_length:
            errors.append(_field_rule_error("field_rule_max_length", rule, f"Field rule expects {rule.path} length to be at most {rule.max_length}."))
            break
        if isinstance(value, int | float) and not isinstance(value, bool):
            if rule.min_value is not None and value < rule.min_value:
                errors.append(_field_rule_error("field_rule_min_value", rule, f"Field rule expects {rule.path} to be at least {rule.min_value}."))
                break
            if rule.max_value is not None and value > rule.max_value:
                errors.append(_field_rule_error("field_rule_max_value", rule, f"Field rule expects {rule.path} to be at most {rule.max_value}."))
                break
    return errors


def _field_rule_error(
    code: str,
    rule: FieldValidationRuleUpsertRequest,
    message: str,
) -> ValidationErrorItem:
    return ValidationErrorItem(code=code, path=rule.path, message=message, rule_id=rule.path)


def _validate_required_output(output: Any, target_schema: SchemaNode) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    for leaf in _required_leaf_nodes(target_schema):
        value = get_path(output, leaf.path)
        if value is MISSING or (isinstance(value, list) and not _flatten_values(value)):
            errors.append(
                ValidationErrorItem(
                    code="missing_required_output_field",
                    path=leaf.path,
                    message=f"Required target field {leaf.path} is missing from output.",
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
            if any(not _matches_schema_type(item, leaf.type) for item in _flatten_values(value)):
                errors.append(
                    ValidationErrorItem(
                        code="type_mismatch",
                        path=leaf.path,
                        message=(
                            f"Output value at {leaf.path} does not match target type {leaf.type}."
                        ),
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


def _flatten_values(values: list[Any]) -> list[Any]:
    flattened: list[Any] = []
    for value in values:
        if isinstance(value, list):
            flattened.extend(_flatten_values(value))
        else:
            flattened.append(value)
    return flattened


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
