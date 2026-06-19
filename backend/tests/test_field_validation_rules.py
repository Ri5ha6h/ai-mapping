from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def test_target_field_rule_upsert_list_defaults_and_path_uniqueness(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "field-rules.sqlite3"))
    schema_id = _create_schema(client, direction="target")

    empty_response = client.get(f"/api/schemas/{schema_id}/field-rules")
    assert empty_response.status_code == 200
    assert empty_response.json() == {"rules": []}

    create_response = client.put(
        f"/api/schemas/{schema_id}/field-rules/$.shipment.weight",
        json={
            "path": "$.shipment.weight",
            "value_type": "number",
            "required": True,
            "min_value": 1,
            "max_value": 99.5,
            "description": "Billable shipment weight",
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["schema_id"] == schema_id
    assert created["path"] == "$.shipment.weight"
    assert created["required"] is True
    assert created["min_length"] is None

    update_response = client.put(
        f"/api/schemas/{schema_id}/field-rules/$.shipment.weight",
        json={
            "path": "$.shipment.weight",
            "value_type": "integer",
            "required": False,
            "min_value": 2,
            "max_value": 10,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["value_type"] == "integer"
    assert updated["required"] is False
    assert updated["created_at"] == created["created_at"]

    list_response = client.get(f"/api/schemas/{schema_id}/field-rules")
    assert list_response.status_code == 200
    assert [rule["path"] for rule in list_response.json()["rules"]] == [
        "$.shipment.weight"
    ]


def test_field_rules_reject_source_and_missing_schema(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "field-rules.sqlite3"))
    source_id = _create_schema(client, direction="source")

    source_response = client.put(
        f"/api/schemas/{source_id}/field-rules/$.id",
        json={"path": "$.id", "value_type": "string"},
    )
    assert source_response.status_code == 400
    assert "only available for target schemas" in source_response.text

    missing_response = client.get("/api/schemas/missing/field-rules")
    assert missing_response.status_code == 404


def test_archived_target_schema_rules_remain_readable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "field-rules.sqlite3"))
    schema_id = _create_schema(client, direction="target")
    response = client.put(
        f"/api/schemas/{schema_id}/field-rules/$.shipment.id",
        json={"path": "$.shipment.id", "value_type": "string", "required": True},
    )
    assert response.status_code == 200

    delete_response = client.delete(f"/api/schemas/{schema_id}")
    assert delete_response.status_code == 200

    list_response = client.get(f"/api/schemas/{schema_id}/field-rules")
    assert list_response.status_code == 200
    assert list_response.json()["rules"][0]["path"] == "$.shipment.id"


def _create_schema(client: TestClient, *, direction: str) -> str:
    response = client.post(
        "/api/schemas",
        json={
            "name": f"Shipment {direction}",
            "direction": direction,
            "format": "json",
            "content": '{"shipment":{"id":"S1","weight":5}}',
        },
    )
    assert response.status_code == 200
    return str(response.json()["schema_id"])
