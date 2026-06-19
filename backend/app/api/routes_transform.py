from fastapi import APIRouter

from app.api.models import (
    OutputDiffRequest,
    OutputDiffResponse,
    TransformRequest,
    TransformResponse,
    ValidateRequest,
    ValidateResponse,
)
from app.core.mapping.output_diff import diff_values
from app.core.mapping.run_service import MappingRunService
from app.core.validation.validator import validate_script_mapping

router = APIRouter(tags=["transform"])


@router.post("/transform", response_model=TransformResponse)
def transform_payload(request: TransformRequest) -> TransformResponse:
    return MappingRunService().run(request)


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
