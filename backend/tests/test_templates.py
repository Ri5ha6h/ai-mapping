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
            "description": "Inbound shipment status map",
            "source_format": "json",
            "target_format": "json",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": {
                "engine": "deterministic_rules",
                "rules": [
                    {
                        "id": "rule_tracking",
                        "type": "field",
                        "source_path": "$.shipment.trackingNumber",
                        "target_path": "$.tracking.number",
                        "jsonata": "shipment.trackingNumber",
                    }
                ],
                "full_jsonata_expression": "[\"shipment.trackingNumber\"]",
            },
            "validation_rules": [],
        },
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["template_id"] == "shipment-status"
    assert created["active_version"] == 1
    assert created["versions"][0]["version"] == 1
    assert created["versions"][0]["mapping_spec"]["rules"][0]["target_path"] == "$.tracking.number"

    list_response = client.get("/api/templates")
    assert list_response.status_code == 200
    template_ids = {template["template_id"] for template in list_response.json()["templates"]}
    assert "shipment-status" in template_ids

    read_response = client.get("/api/templates/shipment-status")
    assert read_response.status_code == 200
    source_snapshot = read_response.json()["versions"][0]["source_schema_snapshot"]
    assert source_snapshot["path"] == SOURCE_SCHEMA["path"]
    assert source_snapshot["fields"]["shipment"]["fields"]["trackingNumber"]["path"] == (
        "$.shipment.trackingNumber"
    )

    version_response = client.post(
        "/api/templates/shipment-status/versions",
        json={
            "source_format": "json",
            "target_format": "xml",
            "source_schema_snapshot": SOURCE_SCHEMA,
            "target_schema_snapshot": TARGET_SCHEMA,
            "mapping_spec": {
                "engine": "deterministic_rules",
                "rules": [
                    {
                        "id": "rule_tracking_xml",
                        "type": "field",
                        "source_path": "$.shipment.trackingNumber",
                        "target_path": "$.TrackingNumber",
                    }
                ],
            },
            "validation_rules": [
                {
                    "code": "unmapped_required_target",
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
    assert updated["versions"][1]["validation_rules"][0]["code"] == "unmapped_required_target"
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

    source_schema_response = client.post(
        "/api/schemas",
        json={
            "schema_id": "shipment-source-schema",
            "name": "Shipment Source",
            "direction": "source",
            "format": "json",
            "content": '{"shipment":{"trackingNumber":"TRK123"}}',
        },
    )
    target_schema_response = client.post(
        "/api/schemas",
        json={
            "schema_id": "shipment-target-schema",
            "name": "Shipment Target",
            "direction": "target",
            "format": "json",
            "content": '{"tracking":{"number":""}}',
        },
    )
    assert source_schema_response.status_code == 200
    assert target_schema_response.status_code == 200

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
            "mapping_spec": {
                "rules": [
                    {
                        "id": "rule_tracking",
                        "type": "field",
                        "source_path": "$.shipment.trackingNumber",
                        "target_path": "$.tracking.number",
                    }
                ],
            },
        },
    )

    assert create_response.status_code == 200
    first_version = create_response.json()["versions"][0]
    assert first_version["source_schema_id"] == "shipment-source-schema"
    assert first_version["target_schema_id"] == "shipment-target-schema"
    assert first_version["source_schema_snapshot"]["path"] == "$"
    assert first_version["target_schema_snapshot"]["path"] == "$"

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
            "mapping_spec": {
                "rules": [
                    {
                        "id": "rule_tracking_v2",
                        "type": "field",
                        "source_path": "$.shipment.trackingNumber",
                        "target_path": "$.tracking.number",
                    }
                ],
            },
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

    read_response = client.get("/api/templates/linked-shipment-status")
    assert read_response.status_code == 200
    read_versions = read_response.json()["versions"]
    assert read_versions[1]["source_schema_id"] == "shipment-source-schema"
    assert read_versions[1]["target_schema_id"] == "shipment-target-schema"
    assert read_versions[1]["source_schema_snapshot"]["fields"]["shipment"]["path"] == (
        "$.shipment"
    )

    with sqlite3.connect(db_path) as connection:
        columns = {
            row[1] for row in connection.execute("pragma table_info(template_versions)")
        }
        linked_rows = connection.execute(
            """
            select source_schema_id, target_schema_id
            from template_versions
            where template_id = 'linked-shipment-status'
            order by version
            """
        ).fetchall()

    assert {"source_schema_id", "target_schema_id"}.issubset(columns)
    assert linked_rows == [
        ("shipment-source-schema", "shipment-target-schema"),
        ("shipment-source-schema", "shipment-target-schema"),
    ]


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
        "mapping_spec": {
            "rules": [
                {
                    "id": "rule_tracking",
                    "type": "field",
                    "source_path": "$.shipment.trackingNumber",
                    "target_path": "$.tracking.number",
                }
            ],
        },
    }

    assert client.post("/api/templates", json=payload).status_code == 200
    assert client.post("/api/templates", json=payload).status_code == 409

    read_response = client.get("/api/templates/missing")
    assert read_response.status_code == 404

    version_response = client.post(
        "/api/templates/missing/versions",
        json={
            "source_format": "json",
            "target_format": "json",
            "mapping_spec": {"rules": []},
        },
    )
    assert version_response.status_code == 404


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
            "mapping_spec": {"rules": []},
        },
    )

    assert response.status_code == 200
    version = response.json()["versions"][0]
    assert version["source_schema_id"] is None
    assert version["target_schema_id"] is None
    assert version["source_schema_snapshot"]["path"] == "$"
