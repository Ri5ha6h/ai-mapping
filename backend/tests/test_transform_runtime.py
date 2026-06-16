import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.mapping.openrouter_provider import OpenRouterProvider

SCRIPT_FIELD = """function transform(source, helpers) {
  return {
    tracking: {
      number: helpers.get(source, "$.shipment.trackingNumber", "")
    }
  };
}"""


def script_spec(script: str) -> dict:
    return {"engine": "script_js", "script": script}


def test_script_transform_executes_simple_field(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {"shipment": {"trackingNumber": "TRK123"}},
            "mapping_spec": script_spec(SCRIPT_FIELD),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["trace"][0]["step_type"] == "script"
    assert payload["output"] == {"tracking": {"number": "TRK123"}}


def test_script_transform_uses_helpers_for_arrays_cleanup_dates_and_lookups(
    client: TestClient,
) -> None:
    script = """function transform(source, helpers) {
  const packages = helpers.get(source, "$.shipment.packages", []);
  const eventCode = helpers.lookup({ loaded: "AE" }, source.status, "");
  return helpers.omitEmpty({
    eventCode,
    eventDate: helpers.formatDate(source.eventDate),
    packageIds: packages.map((item) => helpers.clean(item.id)),
    weight: helpers.parseNumber(source.weight),
    country: helpers.countryCode(source.country)
  });
}"""
    response = client.post(
        "/api/transform",
        json={
            "source_data": {
                "status": "loaded",
                "eventDate": "20260609",
                "weight": "12.5 KG",
                "country": "USA",
                "shipment": {"packages": [{"id": " PKG 1 "}]},
            },
            "mapping_spec": script_spec(script),
        },
    )

    assert response.status_code == 200
    assert response.json()["output"] == {
        "eventCode": "AE",
        "eventDate": "2026-06-09",
        "packageIds": ["PKG1"],
        "weight": 12.5,
        "country": "US",
    }


def test_script_transform_captures_console_output(client: TestClient) -> None:
    script = """function transform(source, helpers) {
  console.log("source", source);
  console.warn("helper", { path: helpers.get(source, "$.name", "") });
  console.error("done");
  return { name: source.name };
}"""

    response = client.post(
        "/api/transform",
        json={
            "source_data": {"name": "Ada"},
            "mapping_spec": script_spec(script),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["output"] == {"name": "Ada"}
    assert payload["logs"] == [
        {"level": "log", "message": 'source {"name":"Ada"}', "index": 0},
        {"level": "warn", "message": 'helper {"path":"Ada"}', "index": 1},
        {"level": "error", "message": "done", "index": 2},
    ]


def test_script_transform_caps_console_output(client: TestClient) -> None:
    script = """function transform(source, helpers) {
  for (let index = 0; index < 120; index += 1) {
    console.info("line", index, "x".repeat(3000));
  }
  return { ok: true };
}"""

    response = client.post(
        "/api/transform",
        json={
            "source_data": {},
            "mapping_spec": script_spec(script),
        },
    )

    assert response.status_code == 200
    logs = response.json()["logs"]
    assert len(logs) == 100
    assert logs[0]["level"] == "info"
    assert logs[0]["index"] == 0
    assert len(logs[0]["message"]) <= 2000


def test_script_transform_blocks_async_and_runaway_scripts(client: TestClient) -> None:
    async_response = client.post(
        "/api/transform",
        json={
            "source_data": {},
            "mapping_spec": script_spec(
                "function transform(source, helpers) { return Promise.resolve({ ok: true }); }"
            ),
        },
    )
    timeout_response = client.post(
        "/api/transform",
        json={
            "source_data": {},
            "mapping_spec": script_spec(
                "function transform(source, helpers) { while (true) {} return {}; }"
            ),
        },
    )

    assert async_response.status_code == 200
    assert async_response.json()["validation_errors"][0]["code"] == "script_execution_failed"
    assert timeout_response.status_code == 200
    assert timeout_response.json()["validation_errors"][0]["code"] == "script_timeout"


def test_script_transform_reports_missing_function(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {},
            "mapping_spec": script_spec("const notTransform = () => ({});"),
        },
    )

    assert response.status_code == 200
    assert response.json()["validation_errors"][0]["code"] == "script_execution_failed"


def test_script_validate_reports_required_output_and_type_errors(client: TestClient) -> None:
    target_schema = {
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

    response = client.post(
        "/api/validate",
        json={
            "output": {"tracking": {"pieces": "two"}},
            "target_schema": target_schema,
            "mapping_spec": script_spec(SCRIPT_FIELD),
        },
    )

    assert response.status_code == 200
    codes = {error["code"] for error in response.json()["errors"]}
    assert "missing_required_output_field" in codes
    assert "type_mismatch" in codes


def test_script_validate_flattens_nested_wildcard_values(client: TestClient) -> None:
    target_schema = {
        "type": "object",
        "path": "$",
        "required": True,
        "fields": {
            "container": {
                "type": "array",
                "path": "$.container",
                "required": True,
                "items": {
                    "type": "object",
                    "path": "$.container[*]",
                    "required": True,
                    "fields": {
                        "events": {
                            "type": "array",
                            "path": "$.container[*].events",
                            "required": True,
                            "items": {
                                "type": "object",
                                "path": "$.container[*].events[*]",
                                "required": True,
                                "fields": {
                                    "eventCode": {
                                        "type": "string",
                                        "path": "$.container[*].events[*].eventCode",
                                        "required": True,
                                    }
                                },
                            },
                        }
                    },
                },
            }
        },
    }

    response = client.post(
        "/api/validate",
        json={
            "output": {
                "container": [
                    {"events": [{"eventCode": "A"}, {"eventCode": "B"}]},
                    {"events": [{"eventCode": "C"}]},
                ]
            },
            "target_schema": target_schema,
            "mapping_spec": script_spec(SCRIPT_FIELD),
        },
    )

    assert response.status_code == 200
    assert response.json()["errors"] == []


def test_script_draft_generation_returns_starter_script(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    response = client.post(
        "/api/mappings/script/draft",
        json={
            "source_sample": {"shipment": {"trackingNumber": "TRK123"}},
            "target_sample": {"tracking": {"number": "TRK123"}, "status": "new"},
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["mapping_spec"]["engine"] == "script_js"
    assert "function transform" in payload["mapping_spec"]["script"]
    assert payload["unresolved_target_paths"] == ["$.status"]


def test_script_draft_generation_maps_simple_combined_fields(client: TestClient) -> None:
    response = client.post(
        "/api/mappings/script/draft",
        json={
            "source_sample": {"first": "hello", "last": "world", "gender": "other"},
            "target_sample": {"full": "", "pronoun": ""},
            "use_ai": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    script = payload["mapping_spec"]["script"]
    assert "const first" in script
    assert "const last" in script
    assert "const gender" in script
    assert '"full": [first, last].filter(Boolean).join(" ")' in script
    assert '"pronoun": helpers.lookup' in script
    assert payload["unresolved_target_paths"] == []

    transform_response = client.post(
        "/api/transform",
        json={
            "source_data": {"first": "hello", "last": "world", "gender": "other"},
            "mapping_spec": payload["mapping_spec"],
        },
    )
    assert transform_response.status_code == 200
    assert transform_response.json()["output"] == {"full": "hello world", "pronoun": "they"}


def test_script_draft_generation_falls_back_when_ai_fails(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def fail_generate_script(self: OpenRouterProvider, **kwargs: object) -> str:
        raise RuntimeError("provider down")

    monkeypatch.setattr(OpenRouterProvider, "generate_script", fail_generate_script)

    response = client.post(
        "/api/mappings/script/draft",
        json={
            "source_sample": {"first": "hello", "last": "world", "gender": "other"},
            "target_sample": {"full": "", "pronoun": ""},
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert "provider down" in payload["provider_errors"][0]
    assert '"full": [first, last].filter(Boolean).join(" ")' in payload["mapping_spec"]["script"]


def test_script_draft_generation_falls_back_when_ai_returns_invalid_script(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def invalid_generate_script(self: OpenRouterProvider, **kwargs: object) -> str:
        return "const nope = true;"

    monkeypatch.setattr(OpenRouterProvider, "generate_script", invalid_generate_script)

    response = client.post(
        "/api/mappings/script/draft",
        json={
            "source_sample": {"first": "hello", "last": "world", "gender": "other"},
            "target_sample": {"full": "", "pronoun": ""},
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert "invalid transform" in payload["provider_errors"][0]
    assert '"pronoun": helpers.lookup' in payload["mapping_spec"]["script"]


def test_output_diff_reports_path_level_changes(client: TestClient) -> None:
    response = client.post(
        "/api/transform/diff",
        json={
            "expected": {"a": 1, "b": {"c": 2}, "d": [1, 2]},
            "actual": {"a": 1, "b": {"c": 3}, "d": [1], "extra": True},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["equal"] is False
    assert {item["path"]: item["kind"] for item in payload["diffs"]} == {
        "$.b.c": "changed",
        "$.d[1]": "missing",
        "$.extra": "extra",
    }


def test_script_json_to_xml_transform(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {"shipment": {"trackingNumber": "TRK123", "carrier": "MAERSK"}},
            "output_format": "xml",
            "root_element": "ShipmentEvent",
            "mapping_spec": script_spec(
                """function transform(source, helpers) {
  return {
    TrackingNumber: helpers.get(source, "$.shipment.trackingNumber", ""),
    Carrier: helpers.get(source, "$.shipment.carrier", "")
  };
}"""
            ),
        },
    )

    assert response.status_code == 200
    assert response.json()["output"] == (
        "<ShipmentEvent><TrackingNumber>TRK123</TrackingNumber>"
        "<Carrier>MAERSK</Carrier></ShipmentEvent>"
    )


def test_script_json2json_seed_matches_golden(client: TestClient) -> None:
    _assert_seed_template_matches_golden(
        client,
        template_id="example-script-json2json",
        sample_root=Path(__file__).resolve().parents[2] / "samples" / "json2json",
        source_name="source.json",
        source_format="json",
    )


def test_script_xml2json_seed_matches_golden(client: TestClient) -> None:
    _assert_seed_template_matches_golden(
        client,
        template_id="example-script-xml2json",
        sample_root=Path(__file__).resolve().parents[2] / "samples" / "xml2json",
        source_name="source.xml",
        source_format="xml",
    )


def _assert_seed_template_matches_golden(
    client: TestClient,
    *,
    template_id: str,
    sample_root: Path,
    source_name: str,
    source_format: str,
) -> None:
    template = client.get(f"/api/templates/{template_id}").json()
    version = template["versions"][0]
    source_content = (sample_root / source_name).read_text()
    if source_format == "xml":
        source_data = client.post(
            "/api/parse",
            json={"format": "xml", "content": source_content},
        ).json()["canonical"]
    else:
        source_data = json.loads(source_content)

    response = client.post(
        "/api/transform",
        json={
            "source_data": source_data,
            "mapping_spec": version["mapping_spec"],
        },
    )

    assert response.status_code == 200
    assert response.json()["validation_errors"] == []
    assert response.json()["output"] == json.loads((sample_root / "output.json").read_text())
