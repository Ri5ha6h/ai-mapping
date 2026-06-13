import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def test_create_list_read_and_soft_delete_schema_artifact(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "schemas.sqlite3"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))
    content = '{"shipment":{"trackingNumber":"TRK123","pieces":2}}'

    create_response = client.post(
        "/api/schemas",
        json={
            "name": "Shipment Source",
            "description": "Inbound shipment payload",
            "direction": "source",
            "format": "json",
            "content": content,
            "input_method": "upload",
            "original_filename": "shipment.json",
            "original_content_type": "application/json",
        },
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["schema_id"] == "shipment-source"
    assert created["direction"] == "source"
    assert created["format"] == "json"
    assert created["original_content"] == content
    assert created["original_filename"] == "shipment.json"
    assert created["original_content_type"] == "application/json"
    assert created["original_size"] == len(content.encode())
    assert created["input_method"] == "upload"
    assert created["canonical_sample"]["shipment"]["trackingNumber"] == "TRK123"
    assert created["inferred_schema"]["fields"]["shipment"]["fields"]["pieces"]["type"] == "integer"
    assert created["parse_metadata"] == {
        "source_format": "json",
        "schema_direction": "source",
    }
    assert created["deleted_at"] is None

    list_response = client.get("/api/schemas")
    assert list_response.status_code == 200
    assert [schema["schema_id"] for schema in list_response.json()["schemas"]] == [
        "shipment-source"
    ]

    source_list_response = client.get("/api/schemas?direction=source")
    assert source_list_response.status_code == 200
    assert len(source_list_response.json()["schemas"]) == 1

    target_list_response = client.get("/api/schemas?direction=target")
    assert target_list_response.status_code == 200
    assert target_list_response.json()["schemas"] == []

    read_response = client.get("/api/schemas/shipment-source")
    assert read_response.status_code == 200
    assert read_response.json()["original_content"] == content

    delete_response = client.delete("/api/schemas/shipment-source")
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_at"] is not None

    active_list_response = client.get("/api/schemas")
    assert active_list_response.status_code == 200
    assert active_list_response.json()["schemas"] == []

    deleted_read_response = client.get("/api/schemas/shipment-source")
    assert deleted_read_response.status_code == 200
    assert deleted_read_response.json()["deleted_at"] is not None

    include_deleted_response = client.get("/api/schemas?include_deleted=true")
    assert include_deleted_response.status_code == 200
    assert [schema["schema_id"] for schema in include_deleted_response.json()["schemas"]] == [
        "shipment-source"
    ]

    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            select original_content, canonical_sample_json, inferred_schema_json, deleted_at
            from schemas
            where schema_id = 'shipment-source'
            """
        ).fetchone()

    assert row is not None
    assert row[0] == content
    assert '"trackingNumber": "TRK123"' in row[1]
    assert '"type":"object"' in row[2]
    assert row[3] is not None


def test_target_schema_rejects_edi_format_without_writing_row(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "schemas.sqlite3"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))

    response = client.post(
        "/api/schemas",
        json={
            "name": "Bad Target",
            "direction": "target",
            "format": "edi_214",
            "content": "ST*214*0001~SE*2*0001~",
        },
    )

    assert response.status_code == 400
    assert "Target schemas only support JSON and XML" in response.text
    assert not db_path.exists()


@pytest.mark.parametrize(
    ("schema_format", "content", "expected_field"),
    [
        (
            "xml",
            "<Shipment><TrackingNumber>TRK123</TrackingNumber></Shipment>",
            "TrackingNumber",
        ),
        (
            "edi_214",
            "ST*214*0001~B10*REF123*TRK123*MAERSK~AT7*X3*NS***20260608*1030*LT~SE*4*0001~",
            "B10",
        ),
        (
            "edi_856",
            "ST*856*0002~BSN*00*SHIP123*20260608*1030~HL*1**S~SE*4*0002~",
            "BSN",
        ),
    ],
)
def test_create_source_schema_artifacts_for_xml_and_edi_formats(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    schema_format: str,
    content: str,
    expected_field: str,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / f"{schema_format}.sqlite3"))

    response = client.post(
        "/api/schemas",
        json={
            "name": f"{schema_format} Source",
            "direction": "source",
            "format": schema_format,
            "content": content,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["format"] == schema_format
    assert payload["original_content"] == content
    assert payload["parse_metadata"]["source_format"] == schema_format
    assert expected_field in str(payload["canonical_sample"])
    assert payload["inferred_schema"]["type"] == "object"


def test_create_target_xml_schema_artifact(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    content = "<ShipmentEvent><TrackingNumber></TrackingNumber></ShipmentEvent>"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "target-xml.sqlite3"))

    response = client.post(
        "/api/schemas",
        json={
            "name": "Shipment Target XML",
            "direction": "target",
            "format": "xml",
            "content": content,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["direction"] == "target"
    assert payload["format"] == "xml"
    assert payload["original_content"] == content
    assert payload["inferred_schema"]["fields"]["ShipmentEvent"]["type"] == "object"


def test_parse_failure_does_not_create_schema_row(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "schemas.sqlite3"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))

    response = client.post(
        "/api/schemas",
        json={
            "name": "Broken JSON",
            "direction": "source",
            "format": "json",
            "content": "{\"shipment\":",
        },
    )

    assert response.status_code == 400
    assert "Invalid JSON input" in response.text
    assert not db_path.exists()


def test_missing_schema_artifact_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "schemas.sqlite3"))

    read_response = client.get("/api/schemas/missing")
    assert read_response.status_code == 404

    delete_response = client.delete("/api/schemas/missing")
    assert delete_response.status_code == 404
