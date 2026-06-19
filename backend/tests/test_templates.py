import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SOURCE_SCHEMA = {
    "type": "object",
    "path": "$",
    "required": True,
    "fields": {
        "shipment": {
            "type": "object",
            "path": "$.shipment",
            "required": True,
            "fields": {
                "trackingNumber": {
                    "type": "string",
                    "path": "$.shipment.trackingNumber",
                    "required": True,
                    "examples": ["TRK123"],
                }
            },
            "examples": [],
        }
    },
    "examples": [],
}

TARGET_SCHEMA = {
    "type": "object",
    "path": "$",
    "required": True,
    "fields": {
        "tracking": {
            "type": "object",
            "path": "$.tracking",
            "required": True,
            "fields": {
                "number": {
                    "type": "string",
                    "path": "$.tracking.number",
                    "required": True,
                    "examples": ["TRK123"],
                }
            },
            "examples": [],
        }
    },
    "examples": [],
}

SCRIPT = """function transform(source, helpers) {
  return {
    tracking: {
      number: helpers.get(source, "$.shipment.trackingNumber", "")
    }
  };
}"""


def script_spec(script: str = SCRIPT) -> dict:
    return {"engine": "script_js", "script": script}


def test_save_template_version_one_and_create_version_two(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "templates.sqlite3"
    old_json_path = tmp_path / "templates.json"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))

    create_response = client.post(
        "/api/templates",
        json={
            "name": "Shipment Status",
            "description": "Inbound shipment status transform",
            "source_format": "json",
            "target_format": "json",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": script_spec(),
            "validation_rules": [],
        },
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["template_id"] == "shipment-status"
    assert created["active_version"] == 1
    assert created["versions"][0]["mapping_spec"]["engine"] == "script_js"
    assert "function transform" in created["versions"][0]["mapping_spec"]["script"]

    version_response = client.post(
        "/api/templates/shipment-status/versions",
        json={
            "source_format": "json",
            "target_format": "xml",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": script_spec(
                """function transform(source, helpers) {
  return { TrackingNumber: helpers.get(source, "$.shipment.trackingNumber", "") };
}"""
            ),
            "validation_rules": [
                {
                    "code": "missing_required_output_field",
                    "path": "$.status",
                    "message": "Status is required.",
                    "rule_id": None,
                }
            ],
        },
    )

    assert version_response.status_code == 200
    updated = version_response.json()
    assert updated["active_version"] == 2
    assert [version["version"] for version in updated["versions"]] == [1, 2]
    assert updated["versions"][1]["target_format"] == "xml"
    assert updated["versions"][1]["validation_rules"][0]["code"] == (
        "missing_required_output_field"
    )
    assert db_path.exists()
    assert not old_json_path.exists()

    with sqlite3.connect(db_path) as connection:
        template_count = connection.execute(
            "select count(*) from templates where template_id = 'shipment-status'"
        ).fetchone()[0]
        version_count = connection.execute(
            "select count(*) from template_versions where template_id = 'shipment-status'"
        ).fetchone()[0]

    assert template_count == 1
    assert version_count == 2


def test_template_versions_store_schema_links_and_snapshots(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "templates.sqlite3"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))

    assert (
        client.post(
            "/api/schemas",
            json={
                "schema_id": "shipment-source-schema",
                "name": "Shipment Source",
                "direction": "source",
                "format": "json",
                "content": '{"shipment":{"trackingNumber":"TRK123"}}',
            },
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/schemas",
            json={
                "schema_id": "shipment-target-schema",
                "name": "Shipment Target",
                "direction": "target",
                "format": "json",
                "content": '{"tracking":{"number":""}}',
            },
        ).status_code
        == 200
    )

    create_response = client.post(
        "/api/templates",
        json={
            "name": "Linked Shipment Status",
            "source_format": "json",
            "target_format": "json",
            "source_schema_id": "shipment-source-schema",
            "target_schema_id": "shipment-target-schema",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": script_spec(),
        },
    )

    assert create_response.status_code == 200
    first_version = create_response.json()["versions"][0]
    assert first_version["source_schema_id"] == "shipment-source-schema"
    assert first_version["target_schema_id"] == "shipment-target-schema"

    assert client.delete("/api/schemas/shipment-source-schema").status_code == 200
    assert client.delete("/api/schemas/shipment-target-schema").status_code == 200

    version_response = client.post(
        "/api/templates/linked-shipment-status/versions",
        json={
            "source_format": "json",
            "target_format": "json",
            "source_schema_id": "shipment-source-schema",
            "target_schema_id": "shipment-target-schema",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": script_spec(),
        },
    )

    assert version_response.status_code == 200
    versions = version_response.json()["versions"]
    assert [version["source_schema_id"] for version in versions] == [
        "shipment-source-schema",
        "shipment-source-schema",
    ]
    assert [version["target_schema_id"] for version in versions] == [
        "shipment-target-schema",
        "shipment-target-schema",
    ]

    with sqlite3.connect(db_path) as connection:
        linked_rows = connection.execute(
            """
            select source_schema_id, target_schema_id
            from template_versions
            where template_id = 'linked-shipment-status'
            order by version
            """
        ).fetchall()

    assert linked_rows == [
        ("shipment-source-schema", "shipment-target-schema"),
        ("shipment-source-schema", "shipment-target-schema"),
    ]


def test_script_template_persists_and_executes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))

    create_response = client.post(
        "/api/templates",
        json={
            "name": "Script Shipment",
            "source_format": "json",
            "target_format": "json",
            "mapping_spec": script_spec(),
            "sample_source_content": '{"shipment":{"trackingNumber":"TRK123"}}',
            "sample_target_content": '{"tracking":{"number":"TRK123"}}',
        },
    )

    assert create_response.status_code == 200
    read_response = client.get("/api/templates/script-shipment")
    assert read_response.status_code == 200
    version = read_response.json()["versions"][0]
    assert version["mapping_spec"]["engine"] == "script_js"

    transform_response = client.post(
        "/api/transform",
        json={
            "source_data": {"shipment": {"trackingNumber": "TRK123"}},
            "mapping_spec": version["mapping_spec"],
        },
    )

    assert transform_response.status_code == 200
    assert transform_response.json()["validation_errors"] == []
    assert transform_response.json()["output"] == {"tracking": {"number": "TRK123"}}


def test_template_conflict_and_missing_template_errors(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))
    payload = {
        "template_id": "shipment-status",
        "name": "Shipment Status",
        "source_format": "json",
        "target_format": "json",
        "mapping_spec": script_spec(),
    }

    assert client.post("/api/templates", json=payload).status_code == 200
    assert client.post("/api/templates", json=payload).status_code == 409
    assert client.get("/api/templates/missing").status_code == 404
    assert (
        client.post(
            "/api/templates/missing/versions",
            json={
                "source_format": "json",
                "target_format": "json",
                "mapping_spec": script_spec(),
            },
        ).status_code
        == 404
    )


def test_template_soft_delete_and_restore(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))
    payload = {
        "template_id": "shipment-status",
        "name": "Shipment Status",
        "source_format": "json",
        "target_format": "json",
        "mapping_spec": script_spec(),
    }

    assert client.post("/api/templates", json=payload).status_code == 200

    delete_response = client.delete("/api/templates/shipment-status")
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_at"] is not None
    active_user_templates = [
        template
        for template in client.get("/api/templates").json()["templates"]
        if not template["is_seeded"]
    ]
    assert active_user_templates == []

    all_templates = client.get("/api/templates?include_deleted=true")
    assert all_templates.status_code == 200
    deleted_user_template_ids = [
        template["template_id"]
        for template in all_templates.json()["templates"]
        if not template["is_seeded"] and template["deleted_at"]
    ]
    assert deleted_user_template_ids == [
        "shipment-status"
    ]

    version_response = client.post(
        "/api/templates/shipment-status/versions",
        json={
            "source_format": "json",
            "target_format": "json",
            "mapping_spec": script_spec(),
        },
    )
    assert version_response.status_code == 404

    restore_response = client.post("/api/templates/shipment-status/restore")
    assert restore_response.status_code == 200
    assert restore_response.json()["deleted_at"] is None
    restored_user_template_ids = [
        template["template_id"]
        for template in client.get("/api/templates").json()["templates"]
        if not template["is_seeded"]
    ]
    assert restored_user_template_ids == [
        "shipment-status"
    ]


def test_snapshot_only_template_versions_remain_compatible(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))

    response = client.post(
        "/api/templates",
        json={
            "name": "Snapshot Only",
            "source_format": "json",
            "target_format": "json",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": script_spec(),
        },
    )

    assert response.status_code == 200
    version = response.json()["versions"][0]
    assert version["source_schema_id"] is None
    assert version["target_schema_id"] is None
    assert version["source_schema_snapshot"]["path"] == "$"
