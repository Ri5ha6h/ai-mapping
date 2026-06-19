from fastapi.testclient import TestClient

from app.api.models import OutputFormat
from app.core.validation.policy import diff_policy_for, validation_policy_for


def script_spec(script: str = "function transform(source, helpers) { return {}; }") -> dict:
    return {"engine": "script_js", "script": script}


def required_tracking_schema() -> dict:
    return {
        "type": "object",
        "path": "$",
        "required": True,
        "fields": {
            "tracking": {
                "type": "object",
                "path": "$.tracking",
                "required": True,
                "fields": {
                    "number": {"type": "string", "path": "$.tracking.number", "required": True},
                    "pieces": {"type": "integer", "path": "$.tracking.pieces", "required": True},
                },
            }
        },
    }


def test_json_validation_policy_keeps_required_field_and_type_checks(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "output_format": "json",
            "output": {"tracking": {"pieces": "two"}},
            "target_schema": required_tracking_schema(),
            "mapping_spec": script_spec(),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is False
    assert "JSON outputs are checked" in payload["policy"]
    assert {error["code"] for error in payload["errors"]} == {
        "missing_required_output_field",
        "type_mismatch",
    }


def test_xml_validation_policy_skips_json_shaped_schema_checks(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "output_format": "xml",
            "output": {"tracking": {"pieces": "two"}},
            "target_schema": required_tracking_schema(),
            "mapping_spec": script_spec(),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is True
    assert payload["errors"] == []
    assert "XML outputs are validated as serializable XML" in payload["policy"]


def test_json_validation_policy_applies_field_rules_without_target_schema(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "output_format": "json",
            "output": {"tracking": {"number": "A", "pieces": 0}},
            "mapping_spec": script_spec(),
            "field_validation_rules": [
                {"path": "$.tracking.carrier", "value_type": "string", "required": True},
                {"path": "$.tracking.number", "value_type": "string", "min_length": 2},
                {"path": "$.tracking.pieces", "value_type": "integer", "min_value": 1},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is False
    assert {error["code"] for error in payload["errors"]} == {
        "field_rule_required",
        "field_rule_min_length",
        "field_rule_min_value",
    }
    assert {error["rule_id"] for error in payload["errors"]} == {
        "$.tracking.carrier",
        "$.tracking.number",
        "$.tracking.pieces",
    }


def test_xml_validation_policy_skips_field_rules(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "output_format": "xml",
            "output": {"tracking": {}},
            "mapping_spec": script_spec(),
            "field_validation_rules": [
                {"path": "$.tracking.number", "value_type": "string", "required": True},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is True
    assert payload["errors"] == []


def test_xml_transform_serializes_output_without_json_schema_diff_guarantee(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {"tracking": "TRK123"},
            "output_format": "xml",
            "root_element": "ShipmentEvent",
            "target_schema": required_tracking_schema(),
            "mapping_spec": script_spec(
                'function transform(source, helpers) { return { TrackingNumber: source.tracking }; }'
            ),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"] == "<TrackingNumber>TRK123</TrackingNumber>"


def test_diff_policy_exposes_json_support_and_xml_limitation(client: TestClient) -> None:
    json_response = client.post(
        "/api/transform/diff",
        json={"output_format": "json", "expected": {"a": 1}, "actual": {"a": 2}},
    )
    xml_response = client.post(
        "/api/transform/diff",
        json={"output_format": "xml", "expected": {"a": 1}, "actual": {"a": 2}},
    )

    assert json_response.status_code == 200
    assert json_response.json()["supported"] is True
    assert json_response.json()["diffs"][0]["path"] == "$.a"
    assert xml_response.status_code == 200
    assert xml_response.json() == {
        "equal": False,
        "diffs": [],
        "supported": False,
        "message": "XML output diff is not available; compare serialized XML samples externally.",
    }


def test_policy_helpers_describe_format_specific_behavior() -> None:
    assert validation_policy_for(OutputFormat.json).validates_target_schema is True
    assert validation_policy_for(OutputFormat.xml).validates_target_schema is False
    assert diff_policy_for(OutputFormat.json).supported is True
    assert diff_policy_for(OutputFormat.xml).supported is False
