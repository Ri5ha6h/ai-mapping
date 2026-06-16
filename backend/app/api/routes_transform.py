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
    ValidationErrorItem,
)
from app.core.mapping.deterministic_rule_runtime import execute_rules
from app.core.mapping.native_graph_runtime import execute_native_graph
from app.core.mapping.output_diff import diff_values
from app.core.validation.native_graph_validator import validate_native_graph
from app.core.validation.validator import validate_mapping
from app.core.writers.json_writer import write_json
from app.core.writers.xml_writer import write_xml

router = APIRouter(tags=["transform"])


@router.post("/transform", response_model=TransformResponse)
def transform_payload(request: TransformRequest) -> TransformResponse:
    mapping_spec = _mapping_spec_from_request(request.mapping_spec, request.rules)
    trace = []
    if mapping_spec.engine == "native_graph":
        if mapping_spec.native_graph is None:
            mapped_output = {}
            execution_errors = []
            validation_errors = [
                _validation_error(
                    "missing_native_graph_spec",
                    "Native graph mapping_spec is missing native_graph.",
                )
            ]
        else:
            mapped_output, execution_errors, trace = execute_native_graph(
                request.source_data,
                mapping_spec.native_graph,
            )
            validation_errors = validate_native_graph(
                source_data=request.source_data,
                graph=mapping_spec.native_graph,
            )
            validation_errors.extend(
                validate_mapping(
                    source_data=None,
                    output=mapped_output,
                    rules=[],
                    target_schema=request.target_schema,
                )
            )
    else:
        mapped_output, execution_errors = execute_rules(request.source_data, mapping_spec.rules)
        validation_errors = validate_mapping(
            source_data=request.source_data,
            output=mapped_output,
            rules=mapping_spec.rules,
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
        trace=trace,
    )


@router.post("/validate", response_model=ValidateResponse)
def validate_payload(request: ValidateRequest) -> ValidateResponse:
    mapping_spec = _mapping_spec_from_request(request.mapping_spec, request.rules)
    if mapping_spec.engine == "native_graph" and mapping_spec.native_graph is not None:
        errors = validate_native_graph(
            source_data=request.source_data,
            graph=mapping_spec.native_graph,
        )
        errors.extend(
            validate_mapping(
                source_data=None,
                output=request.output,
                rules=[],
                target_schema=request.target_schema,
            )
        )
    elif mapping_spec.engine == "native_graph":
        errors = [
            _validation_error(
                "missing_native_graph_spec",
                "Native graph mapping_spec is missing native_graph.",
            )
        ]
    else:
        errors = validate_mapping(
            source_data=request.source_data,
            output=request.output,
            rules=mapping_spec.rules,
            target_schema=request.target_schema,
        )
    return ValidateResponse(valid=not errors, errors=errors)


@router.post("/transform/diff", response_model=OutputDiffResponse)
def diff_output(request: OutputDiffRequest) -> OutputDiffResponse:
    diffs = diff_values(request.expected, request.actual)
    return OutputDiffResponse(equal=not diffs, diffs=diffs)


def _mapping_spec_from_request(
    mapping_spec: MappingSpec | None,
    rules: list,
) -> MappingSpec:
    if mapping_spec is not None:
        return mapping_spec
    return MappingSpec(engine="deterministic_rules", rules=rules)


def _validation_error(code: str, message: str) -> ValidationErrorItem:
    return ValidationErrorItem(code=code, message=message)
