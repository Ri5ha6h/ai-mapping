from app.api.models import FieldValidationRuleUpsertRequest, MappingSpec, OutputFormat, SchemaNode, TransformRequest
from app.core.mapping.run_service import MappingRunService


def _script_spec(script: str) -> MappingSpec:
    return MappingSpec(engine="script_js", script=script)


def test_mapping_run_service_returns_json_output() -> None:
    response = MappingRunService().run(
        TransformRequest(
            source_data={"shipment": {"trackingNumber": "TRK123"}},
            mapping_spec=_script_spec(
                """function transform(source, helpers) {
  return { tracking: { number: helpers.get(source, "$.shipment.trackingNumber", "") } };
}"""
            ),
        )
    )

    assert response.output_format == OutputFormat.json
    assert response.output == {"tracking": {"number": "TRK123"}}
    assert response.validation_errors == []
    assert response.trace[0].step_type == "script"


def test_mapping_run_service_returns_xml_output() -> None:
    response = MappingRunService().run(
        TransformRequest(
            source_data={"shipment": {"trackingNumber": "TRK123", "carrier": "MAERSK"}},
            output_format=OutputFormat.xml,
            root_element="ShipmentEvent",
            mapping_spec=_script_spec(
                """function transform(source, helpers) {
  return {
    TrackingNumber: helpers.get(source, "$.shipment.trackingNumber", ""),
    Carrier: helpers.get(source, "$.shipment.carrier", "")
  };
}"""
            ),
        )
    )

    assert response.output_format == OutputFormat.xml
    assert response.output == (
        "<ShipmentEvent><TrackingNumber>TRK123</TrackingNumber>"
        "<Carrier>MAERSK</Carrier></ShipmentEvent>"
    )
    assert response.validation_errors == []


def test_mapping_run_service_reports_script_errors() -> None:
    response = MappingRunService().run(
        TransformRequest(
            source_data={},
            mapping_spec=_script_spec("function transform(source, helpers) { throw new Error('boom'); }"),
        )
    )

    assert response.output == {}
    assert response.validation_errors[0].code == "script_execution_failed"
    assert response.trace[0].status == "failed"


def test_mapping_run_service_reports_validation_errors() -> None:
    target_schema = SchemaNode(
        type="object",
        path="$",
        fields={
            "tracking": SchemaNode(
                type="object",
                path="$.tracking",
                fields={
                    "number": SchemaNode(type="string", path="$.tracking.number"),
                    "pieces": SchemaNode(type="integer", path="$.tracking.pieces"),
                },
            )
        },
    )

    response = MappingRunService().run(
        TransformRequest(
            source_data={},
            target_schema=target_schema,
            mapping_spec=_script_spec(
                "function transform(source, helpers) { return { tracking: { pieces: 'two' } }; }"
            ),
        )
    )

    codes = {error.code for error in response.validation_errors}
    assert "missing_required_output_field" in codes
    assert "type_mismatch" in codes


def test_mapping_run_service_reports_field_rule_validation_errors() -> None:
    response = MappingRunService().run(
        TransformRequest(
            source_data={},
            field_validation_rules=[
                FieldValidationRuleUpsertRequest(
                    path="$.tracking.pieces",
                    value_type="integer",
                    required=True,
                    min_value=1,
                )
            ],
            mapping_spec=_script_spec(
                "function transform(source, helpers) { return { tracking: { pieces: 0 } }; }"
            ),
        )
    )

    assert response.validation_errors[0].code == "field_rule_min_value"
    assert response.validation_errors[0].path == "$.tracking.pieces"
    assert response.validation_errors[0].rule_id == "$.tracking.pieces"


def test_mapping_run_service_preserves_logs_and_trace() -> None:
    response = MappingRunService().run(
        TransformRequest(
            source_data={"name": "Ada"},
            mapping_spec=_script_spec(
                """function transform(source, helpers) {
  console.log("source", source);
  return { name: source.name };
}"""
            ),
        )
    )

    assert response.output == {"name": "Ada"}
    assert response.logs[0].level == "log"
    assert response.logs[0].message == 'source {"name":"Ada"}'
    assert response.trace[0].step_id == "transform"
    assert response.trace[0].status == "executed"
