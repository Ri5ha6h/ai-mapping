from fastapi import APIRouter

from app.api.models import (
    MappingSpec,
    OutputDiffRequest,
    OutputDiffResponse,
    OutputFormat,
    TransformRequest,
    TransformResponse,
    ValidateRequest,
    ValidateResponse,
)
from app.core.mapping.output_diff import diff_values
from app.core.mapping.script_runtime import execute_script_transform
from app.core.validation.validator import validate_script_mapping
from app.core.writers.json_writer import write_json
from app.core.writers.xml_writer import write_xml

router = APIRouter(tags=["transform"])


@router.post("/transform", response_model=TransformResponse)
def transform_payload(request: TransformRequest) -> TransformResponse:
    mapping_spec = _mapping_spec_from_request(request.mapping_spec)
    script_result = execute_script_transform(request.source_data, mapping_spec.script)
    validation_errors = validate_script_mapping(
        mapping_spec=mapping_spec,
        output=script_result.output,
        target_schema=request.target_schema,
    )
    errors = script_result.errors + validation_errors

    if request.output_format == OutputFormat.xml:
        output = write_xml(script_result.output, root_element=request.root_element)
    else:
        output = write_json(script_result.output)

    return TransformResponse(
        output_format=request.output_format,
        output=output,
        validation_errors=errors,
        trace=script_result.trace,
        logs=script_result.logs,
    )


@router.post("/validate", response_model=ValidateResponse)
def validate_payload(request: ValidateRequest) -> ValidateResponse:
    errors = validate_script_mapping(
        mapping_spec=request.mapping_spec,
        output=request.output,
        target_schema=request.target_schema,
    )
    return ValidateResponse(valid=not errors, errors=errors)


@router.post("/transform/diff", response_model=OutputDiffResponse)
def diff_output(request: OutputDiffRequest) -> OutputDiffResponse:
    diffs = diff_values(request.expected, request.actual)
    return OutputDiffResponse(equal=not diffs, diffs=diffs)


def _mapping_spec_from_request(mapping_spec: MappingSpec | None) -> MappingSpec:
    if mapping_spec is not None:
        return mapping_spec
    return MappingSpec(engine="script_js", script="")
