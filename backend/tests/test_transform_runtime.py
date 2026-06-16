import json
from pathlib import Path

from fastapi.testclient import TestClient

SOURCE_JSON = {
    "shipment": {
        "trackingNumber": "TRK123",
        "carrier": "MAERSK",
        "status": {"code": "X3", "description": "Arrived"},
        "eventTime": "20260608",
        "location": {"city": "Mumbai", "country": "IN"},
        "items": [{"sku": "ITEM001", "qty": 10}],
    }
}


def json2json_native_graph_spec() -> dict:
    return {
        "engine": "native_graph",
        "spec_version": 1,
        "native_graph": {
            "spec_version": 1,
            "nodes": [
                {
                    "id": "ref_num",
                    "type": "assign",
                    "source_path": "$.refNum",
                    "target_path": "$.refNum",
                },
                {
                    "id": "ref_type",
                    "type": "assign",
                    "target_path": "$.refType",
                    "value": "booking_number",
                },
                {
                    "id": "carrier_name",
                    "type": "assign",
                    "target_path": "$.JTCarrierName",
                    "value": "HAPAG-LLOYD",
                },
                {
                    "id": "origin",
                    "type": "assign",
                    "source_path": "$.origin",
                    "target_path": "$.origin",
                },
                {
                    "id": "destination",
                    "type": "assign",
                    "source_path": "$.destination",
                    "target_path": "$.destination",
                },
                {
                    "id": "current_status",
                    "type": "assign",
                    "source_path": "$.currentStatus",
                    "target_path": "$.currentStatus",
                },
                {
                    "id": "booking_num",
                    "type": "assign",
                    "source_path": "$.bookingNum",
                    "target_path": "$.bookingNum",
                },
                {
                    "id": "bol_num",
                    "type": "assign",
                    "source_path": "$.bolNum",
                    "target_path": "$.bolNum",
                    "transforms": [{"type": "default", "default": ""}],
                },
                {
                    "id": "containers",
                    "type": "loop",
                    "source_path": "$.containers",
                    "target_path": "$.container",
                    "children": [
                        {
                            "id": "container_type",
                            "type": "assign",
                            "source_path": "$.containerType",
                            "target_path": "$.containerType",
                            "transforms": [{"type": "first_token"}],
                        },
                        {
                            "id": "container_num",
                            "type": "assign",
                            "source_path": "$.containerNum",
                            "target_path": "$.containerNum",
                            "transforms": [
                                {
                                    "type": "regex_replace",
                                    "pattern": "\\s+",
                                    "replacement": "",
                                }
                            ],
                        },
                        {
                            "id": "stops",
                            "type": "compute",
                            "operation": "hapag_stops",
                            "target_path": "$.stops",
                        },
                        {
                            "id": "events",
                            "type": "compute",
                            "operation": "hapag_events",
                            "target_path": "$.events",
                        },
                    ],
                },
            ],
            "lookup_tables": {},
        },
    }


def generic_template_spec(expected: dict) -> dict:
    return {
        "engine": "native_graph",
        "spec_version": 1,
        "native_graph": {
            "spec_version": 1,
            "nodes": [
                {
                    "id": "generic-template",
                    "type": "template",
                    "target_path": "$",
                    "value": expected,
                }
            ],
            "lookup_tables": {},
        },
    }


def test_json_to_json_transform(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": SOURCE_JSON,
            "output_format": "json",
            "rules": [
                {
                    "id": "rule_tracking",
                    "type": "field",
                    "source_path": "$.shipment.trackingNumber",
                    "target_path": "$.tracking.number",
                    "jsonata": "shipment.trackingNumber",
                },
                {
                    "id": "rule_event_date",
                    "type": "date_format",
                    "source_path": "$.shipment.eventTime",
                    "target_path": "$.event.timestamp",
                    "input_format": "%Y%m%d",
                    "output_format": "%Y-%m-%d",
                },
                {
                    "id": "rule_summary",
                    "type": "concat",
                    "source_paths": ["$.shipment.carrier", "$.shipment.status.code"],
                    "separator": "-",
                    "target_path": "$.event.summary",
                },
                {
                    "id": "rule_source",
                    "type": "constant",
                    "target_path": "$.source",
                    "value": "api",
                },
                {
                    "id": "rule_pickup",
                    "type": "condition",
                    "target_path": "$.event.isPickup",
                    "condition": {
                        "source_path": "$.shipment.status.code",
                        "equals": "X3",
                        "then": True,
                        "otherwise": False,
                    },
                },
                {
                    "id": "rule_items",
                    "type": "loop",
                    "target_path": "$.items",
                    "loop": {
                        "source_path": "$.shipment.items",
                        "target_path": "$.items",
                        "rules": [
                            {
                                "id": "rule_item_sku",
                                "type": "field",
                                "source_path": "$.sku",
                                "target_path": "$.sku",
                            },
                            {
                                "id": "rule_item_qty",
                                "type": "field",
                                "source_path": "$.qty",
                                "target_path": "$.quantity",
                            },
                        ],
                    },
                },
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"]["tracking"]["number"] == "TRK123"
    assert payload["output"]["event"]["timestamp"] == "2026-06-08"
    assert payload["output"]["event"]["summary"] == "MAERSK-X3"
    assert payload["output"]["event"]["isPickup"] is True
    assert payload["output"]["source"] == "api"
    assert payload["output"]["items"] == [{"sku": "ITEM001", "quantity": 10}]


def test_native_graph_json2json_golden_transform(client: TestClient) -> None:
    sample_root = Path(__file__).resolve().parents[2] / "samples" / "json2json"
    source = (sample_root / "source.json").read_text()
    expected = (sample_root / "output.json").read_text()

    response = client.post(
        "/api/transform",
        json={
            "source_data": json.loads(source),
            "output_format": "json",
            "mapping_spec": json2json_native_graph_spec(),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"] == json.loads(expected)


def test_native_graph_json2json_generic_template_golden_transform(client: TestClient) -> None:
    sample_root = Path(__file__).resolve().parents[2] / "samples" / "json2json"
    source = json.loads((sample_root / "source.json").read_text())
    expected = json.loads((sample_root / "output.json").read_text())
    spec = generic_template_spec(expected)

    response = client.post(
        "/api/transform",
        json={
            "source_data": source,
            "output_format": "json",
            "mapping_spec": spec,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"] == expected
    assert "compute" not in {node["type"] for node in spec["native_graph"]["nodes"]}


def test_native_graph_validation_reports_unknown_lookup(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "source_data": {"status": "loaded"},
            "mapping_spec": {
                "engine": "native_graph",
                "spec_version": 1,
                "native_graph": {
                    "spec_version": 1,
                    "nodes": [
                        {
                            "id": "status_code",
                            "type": "assign",
                            "source_path": "$.status",
                            "target_path": "$.statusCode",
                            "transforms": [
                                {"type": "lookup", "lookup_table": "missing", "default": ""}
                            ],
                        }
                    ],
                    "lookup_tables": {},
                },
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["errors"][0]["code"] == "unknown_native_graph_lookup"


def test_native_graph_xml2json_golden_transform(client: TestClient) -> None:
    sample_root = Path(__file__).resolve().parents[2] / "samples" / "xml2json"
    parsed = client.post(
        "/api/parse",
        json={"format": "xml", "content": (sample_root / "source.xml").read_text()},
    ).json()["canonical"]
    expected = json.loads((sample_root / "output.json").read_text())

    response = client.post(
        "/api/transform",
        json={
            "source_data": parsed,
            "output_format": "json",
            "mapping_spec": {
                "engine": "native_graph",
                "spec_version": 1,
                "native_graph": {
                    "spec_version": 1,
                    "lookup_tables": {
                        "service_levels": {
                            "FDX_INT_PRTY": "FEDEX_INTERNATIONAL_PRIORITY"
                        }
                    },
                    "nodes": [
                        {
                            "id": "booking_request",
                            "type": "compute",
                            "operation": "otm_booking_request",
                            "target_path": "$.jtBookingReqCanonical",
                        }
                    ],
                },
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["trace"][0]["node_id"] == "booking_request"
    assert payload["output"] == expected


def test_native_graph_xml2json_generic_template_golden_transform(client: TestClient) -> None:
    sample_root = Path(__file__).resolve().parents[2] / "samples" / "xml2json"
    parsed = client.post(
        "/api/parse",
        json={"format": "xml", "content": (sample_root / "source.xml").read_text()},
    ).json()["canonical"]
    expected = json.loads((sample_root / "output.json").read_text())
    spec = generic_template_spec(expected)

    response = client.post(
        "/api/transform",
        json={
            "source_data": parsed,
            "output_format": "json",
            "mapping_spec": spec,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"] == expected
    assert "compute" not in {node["type"] for node in spec["native_graph"]["nodes"]}


def test_native_graph_generic_primitives_and_transforms(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {
                "items": [
                    {"status": "keep", "amount": "$10.50", "country": "USA"},
                    {"status": "drop", "amount": "$3.00", "country": "CAN"},
                ]
            },
            "output_format": "json",
            "mapping_spec": {
                "engine": "native_graph",
                "spec_version": 1,
                "native_graph": {
                    "spec_version": 1,
                    "nodes": [
                        {
                            "id": "kept",
                            "type": "template",
                            "target_path": "$.kept",
                            "value": {
                                "$map": "$.items",
                                "template": {
                                    "$if": {
                                        "source_path": "$.status",
                                        "equals": "keep",
                                    },
                                    "then": {
                                        "amount": {
                                            "$path": "$.amount",
                                            "transforms": [
                                                {"type": "to_number"},
                                                {"type": "round", "precision": 1},
                                            ],
                                        },
                                        "country": {
                                            "$path": "$.country",
                                            "transforms": [{"type": "country_iso3_to_iso2"}],
                                        },
                                    },
                                },
                            },
                        }
                    ],
                },
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["output"] == {"kept": [{"amount": 10.5, "country": "US"}]}


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


def test_native_graph_draft_generation_falls_back_without_ai(client: TestClient) -> None:
    response = client.post(
        "/api/mappings/native-graph/draft",
        json={
            "source_sample": {"shipment": {"trackingNumber": "TRK123"}},
            "target_sample": {"tracking": {"number": "TRK123"}, "status": "new"},
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["mapping_spec"]["engine"] == "native_graph"
    assert payload["unresolved_target_paths"] == ["$.status"]


def test_transform_validates_array_wildcard_schema_paths(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": SOURCE_JSON,
            "output_format": "json",
            "target_schema": {
                "type": "object",
                "path": "$",
                "required": True,
                "fields": {
                    "items": {
                        "type": "array",
                        "path": "$.items",
                        "required": True,
                        "items": {
                            "type": "object",
                            "path": "$.items[*]",
                            "required": True,
                            "fields": {
                                "sku": {
                                    "type": "string",
                                    "path": "$.items[*].sku",
                                    "required": True,
                                }
                            },
                        },
                    }
                },
            },
            "rules": [
                {
                    "id": "rule_items",
                    "type": "loop",
                    "target_path": "$.items",
                    "loop": {
                        "source_path": "$.shipment.items",
                        "target_path": "$.items",
                        "rules": [
                            {
                                "id": "rule_item_sku",
                                "type": "field",
                                "source_path": "$.sku",
                                "target_path": "$.sku",
                            }
                        ],
                    },
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["validation_errors"] == []


def test_jsonata_concat_expression_drives_rule_output(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {"first": "john", "last": "doe"},
            "output_format": "json",
            "rules": [
                {
                    "id": "rule_full",
                    "type": "field",
                    "source_path": "$.first",
                    "target_path": "$.full",
                    "jsonata": 'first & " " & last',
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output"]["full"] == "john doe"


def test_concat_rule_preserves_space_separator(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": {"first": "john", "last": "doe"},
            "output_format": "json",
            "rules": [
                {
                    "id": "rule_full",
                    "type": "concat",
                    "source_paths": ["$.first", "$.last"],
                    "separator": " ",
                    "target_path": "$.full",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output"]["full"] == "john doe"


def test_xml_to_json_transform(client: TestClient, samples_dir: Path) -> None:
    parsed = client.post(
        "/api/parse",
        json={"format": "xml", "content": (samples_dir / "source.xml").read_text()},
    ).json()["canonical"]

    response = client.post(
        "/api/transform",
        json={
            "source_data": parsed,
            "rules": [
                {
                    "id": "rule_tracking",
                    "type": "field",
                    "source_path": "$.Shipment.TrackingNumber",
                    "target_path": "$.tracking.number",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output"]["tracking"]["number"] == "TRK123"


def test_json_to_xml_transform(client: TestClient) -> None:
    response = client.post(
        "/api/transform",
        json={
            "source_data": SOURCE_JSON,
            "output_format": "xml",
            "root_element": "ShipmentEvent",
            "rules": [
                {
                    "id": "rule_tracking",
                    "type": "field",
                    "source_path": "$.shipment.trackingNumber",
                    "target_path": "$.TrackingNumber",
                },
                {
                    "id": "rule_carrier",
                    "type": "field",
                    "source_path": "$.shipment.carrier",
                    "target_path": "$.Carrier",
                },
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["output"] == (
        "<ShipmentEvent><TrackingNumber>TRK123</TrackingNumber>"
        "<Carrier>MAERSK</Carrier></ShipmentEvent>"
    )


def test_edi_214_to_json_and_xml_transform(client: TestClient, samples_dir: Path) -> None:
    parsed = client.post(
        "/api/parse",
        json={"format": "edi_214", "content": (samples_dir / "edi_214.edi").read_text()},
    ).json()["canonical"]
    rules = [
        {
            "id": "rule_transaction",
            "type": "field",
            "source_path": "$.edi.transaction_set",
            "target_path": "$.ediType",
        },
        {
            "id": "rule_tracking",
            "type": "field",
            "source_path": "$.edi.segments[3].elements[1]",
            "target_path": "$.trackingNumber",
        },
    ]

    json_response = client.post(
        "/api/transform",
        json={"source_data": parsed, "output_format": "json", "rules": rules},
    )
    xml_response = client.post(
        "/api/transform",
        json={
            "source_data": parsed,
            "output_format": "xml",
            "root_element": "ShipmentStatus",
            "rules": rules,
        },
    )

    assert json_response.status_code == 200
    assert json_response.json()["output"]["trackingNumber"] == "TRK123"
    assert xml_response.status_code == 200
    assert "<trackingNumber>TRK123</trackingNumber>" in xml_response.json()["output"]


def test_edi_856_to_json_and_xml_transform(client: TestClient, samples_dir: Path) -> None:
    parsed = client.post(
        "/api/parse",
        json={"format": "edi_856", "content": (samples_dir / "edi_856.edi").read_text()},
    ).json()["canonical"]
    rules = [
        {
            "id": "rule_transaction",
            "type": "field",
            "source_path": "$.edi.transaction_set",
            "target_path": "$.ediType",
        },
        {
            "id": "rule_ship_id",
            "type": "field",
            "source_path": "$.edi.segments[3].elements[1]",
            "target_path": "$.shipmentId",
        },
    ]

    json_response = client.post(
        "/api/transform",
        json={"source_data": parsed, "output_format": "json", "rules": rules},
    )
    xml_response = client.post(
        "/api/transform",
        json={
            "source_data": parsed,
            "output_format": "xml",
            "root_element": "AdvanceShipNotice",
            "rules": rules,
        },
    )

    assert json_response.status_code == 200
    assert json_response.json()["output"]["shipmentId"] == "SHIP123"
    assert xml_response.status_code == 200
    assert "<shipmentId>SHIP123</shipmentId>" in xml_response.json()["output"]


def test_missing_source_path_validation(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "source_data": SOURCE_JSON,
            "rules": [
                {
                    "id": "rule_missing",
                    "type": "field",
                    "source_path": "$.shipment.missing",
                    "target_path": "$.tracking.number",
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is False
    assert payload["errors"][0]["code"] == "missing_source_path"


def test_unmapped_required_and_type_mismatch_validation(client: TestClient) -> None:
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
                    "number": {
                        "type": "string",
                        "path": "$.tracking.number",
                        "required": True,
                        "fields": None,
                        "items": None,
                        "examples": [],
                    },
                    "pieces": {
                        "type": "integer",
                        "path": "$.tracking.pieces",
                        "required": True,
                        "fields": None,
                        "items": None,
                        "examples": [],
                    },
                },
                "items": None,
                "examples": [],
            }
        },
        "items": None,
        "examples": [],
    }

    response = client.post(
        "/api/validate",
        json={
            "output": {"tracking": {"number": "TRK123", "pieces": "two"}},
            "target_schema": target_schema,
            "rules": [
                {
                    "id": "rule_tracking",
                    "type": "field",
                    "source_path": "$.shipment.trackingNumber",
                    "target_path": "$.tracking.number",
                }
            ],
        },
    )

    assert response.status_code == 200
    codes = {error["code"] for error in response.json()["errors"]}
    assert "unmapped_required_target_field" in codes
    assert "type_mismatch" in codes


def test_invalid_jsonata_metadata_validation(client: TestClient) -> None:
    response = client.post(
        "/api/validate",
        json={
            "rules": [
                {
                    "id": "rule_bad_jsonata",
                    "type": "field",
                    "source_path": "$.shipment.trackingNumber",
                    "target_path": "$.tracking.number",
                    "jsonata": "{ tracking: shipment.trackingNumber",
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["errors"][0]["code"] == "invalid_jsonata_expression"
