from fastapi import APIRouter

from app.api.models import (
    OutputFormat,
    TransformRequest,
    TransformResponse,
    ValidateRequest,
    ValidateResponse,
)
from app.core.mapping.deterministic_rule_runtime import execute_rules
from app.core.validation.validator import validate_mapping
from app.core.writers.json_writer import write_json
from app.core.writers.xml_writer import write_xml

router = APIRouter(tags=["transform"])


@router.post("/transform", response_model=TransformResponse)
def transform_payload(request: TransformRequest) -> TransformResponse:
    mapped_output, execution_errors = execute_rules(request.source_data, request.rules)
    validation_errors = validate_mapping(
        source_data=request.source_data,
        output=mapped_output,
        rules=request.rules,
        target_schema=request.target_schema,
    )
    errors = execution_errors + validation_errors

    if request.output_format == OutputFormat.xml:
        output = write_xml(mapped_output, root_element=request.root_element)
    else:
        output = write_json(mapped_output)

    return TransformResponse(
        output_format=request.output_format,
        output=output,
        validation_errors=errors,
    )


@router.post("/validate", response_model=ValidateResponse)
def validate_payload(request: ValidateRequest) -> ValidateResponse:
    errors = validate_mapping(
        source_data=request.source_data,
        output=request.output,
        rules=request.rules,
        target_schema=request.target_schema,
    )
    return ValidateResponse(valid=not errors, errors=errors)

