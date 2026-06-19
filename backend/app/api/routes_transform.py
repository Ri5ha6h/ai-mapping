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
from app.core.validation.policy import diff_policy_for, validation_policy_for
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
        output_format=request.output_format,
        field_validation_rules=request.field_validation_rules,
    )
    policy = validation_policy_for(request.output_format)
    return ValidateResponse(valid=not errors, errors=errors, policy=policy.message)


@router.post("/transform/diff", response_model=OutputDiffResponse)
def diff_output(request: OutputDiffRequest) -> OutputDiffResponse:
    policy = diff_policy_for(request.output_format)
    if not policy.supported:
        return OutputDiffResponse(equal=False, diffs=[], supported=False, message=policy.message)
    diffs = diff_values(request.expected, request.actual)
    return OutputDiffResponse(equal=not diffs, diffs=diffs, supported=True, message=policy.message)
