from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
SAMPLES_DIR = Path(__file__).resolve().parents[1] / "samples"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Auto Mapping POC demo scenarios.")
    parser.add_argument(
        "scenario",
        choices=["json-to-json", "xml-to-json", "json-to-xml", "edi-214", "edi-856"],
    )
    args = parser.parse_args()

    try:
        if args.scenario == "json-to-json":
            demo_json_to_json()
        elif args.scenario == "xml-to-json":
            demo_xml_to_json()
        elif args.scenario == "json-to-xml":
            demo_json_to_xml()
        elif args.scenario == "edi-214":
            demo_edi_214()
        elif args.scenario == "edi-856":
            demo_edi_856()
    except urllib.error.URLError as exc:
        print(
            f"API request failed. Is the backend running at {API_BASE_URL}? {exc}",
            file=sys.stderr,
        )
        return 1
    return 0


def demo_json_to_json() -> None:
    source = json.loads(read_sample("source.json"))
    transform(
        "JSON to JSON",
        source,
        "json",
        [
            field("rule_tracking", "$.shipment.trackingNumber", "$.tracking.number"),
            field("rule_carrier", "$.shipment.carrier", "$.tracking.carrierCode"),
            field("rule_status", "$.shipment.status.code", "$.event.statusCode"),
            field("rule_description", "$.shipment.status.description", "$.event.statusDescription"),
            {
                "id": "rule_event_date",
                "type": "date_format",
                "source_path": "$.shipment.eventTime",
                "target_path": "$.event.timestamp",
                "input_format": "%Y%m%d",
                "output_format": "%Y-%m-%d",
            },
            field("rule_city", "$.shipment.location.city", "$.event.city"),
            field("rule_country", "$.shipment.location.country", "$.event.country"),
        ],
    )


def demo_xml_to_json() -> None:
    parsed = parse("xml", read_sample("source.xml"))
    transform(
        "XML to JSON",
        parsed["canonical"],
        "json",
        [
            field("rule_tracking", "$.Shipment.TrackingNumber", "$.tracking.number"),
            field("rule_carrier", "$.Shipment.Carrier", "$.tracking.carrierCode"),
            field("rule_status", "$.Shipment.Status.Code", "$.event.statusCode"),
            field("rule_description", "$.Shipment.Status.Description", "$.event.statusDescription"),
            {
                "id": "rule_event_date",
                "type": "date_format",
                "source_path": "$.Shipment.EventTime",
                "target_path": "$.event.timestamp",
                "input_format": "%Y%m%d",
                "output_format": "%Y-%m-%d",
            },
            field("rule_city", "$.Shipment.Location.City", "$.event.city"),
            field("rule_country", "$.Shipment.Location.Country", "$.event.country"),
        ],
    )


def demo_json_to_xml() -> None:
    source = json.loads(read_sample("source.json"))
    transform(
        "JSON to XML",
        source,
        "xml",
        [
            field("rule_tracking", "$.shipment.trackingNumber", "$.TrackingNumber"),
            field("rule_carrier", "$.shipment.carrier", "$.Carrier"),
            field("rule_status", "$.shipment.status.code", "$.StatusCode"),
            field("rule_description", "$.shipment.status.description", "$.StatusDescription"),
            {
                "id": "rule_event_date",
                "type": "date_format",
                "source_path": "$.shipment.eventTime",
                "target_path": "$.EventTimestamp",
                "input_format": "%Y%m%d",
                "output_format": "%Y-%m-%d",
            },
            field("rule_city", "$.shipment.location.city", "$.City"),
            field("rule_country", "$.shipment.location.country", "$.Country"),
        ],
    )


def demo_edi_214() -> None:
    parsed = parse("edi_214", read_sample("edi_214.edi"))
    rules = [
        field("rule_transaction", "$.edi.transaction_set", "$.ediType"),
        field("rule_tracking", "$.edi.segments[3].elements[1]", "$.trackingNumber"),
        field("rule_carrier", "$.edi.segments[3].elements[2]", "$.carrier"),
        field("rule_status", "$.edi.segments[5].elements[0]", "$.statusCode"),
    ]
    transform("EDI 214 to JSON", parsed["canonical"], "json", rules)
    transform("EDI 214 to XML", parsed["canonical"], "xml", rules, root_element="ShipmentStatus")


def demo_edi_856() -> None:
    parsed = parse("edi_856", read_sample("edi_856.edi"))
    rules = [
        field("rule_transaction", "$.edi.transaction_set", "$.ediType"),
        field("rule_ship_id", "$.edi.segments[3].elements[1]", "$.shipmentId"),
        field("rule_carrier", "$.edi.segments[5].elements[2]", "$.carrier"),
        field("rule_order", "$.edi.segments[6].elements[1]", "$.orderNumber"),
    ]
    transform("EDI 856 to JSON", parsed["canonical"], "json", rules)
    transform("EDI 856 to XML", parsed["canonical"], "xml", rules, root_element="AdvanceShipNotice")


def parse(format_: str, content: str) -> dict[str, Any]:
    response = post("/api/parse", {"format": format_, "content": content})
    print_block(f"Parsed {format_}", response)
    return response


def transform(
    title: str,
    source_data: Any,
    output_format: str,
    rules: list[dict[str, Any]],
    *,
    root_element: str = "ShipmentEvent",
) -> None:
    response = post(
        "/api/transform",
        {
            "source_data": source_data,
            "output_format": output_format,
            "root_element": root_element,
            "rules": rules,
        },
    )
    print_block(title, response)


def field(rule_id: str, source_path: str, target_path: str) -> dict[str, Any]:
    return {
        "id": rule_id,
        "type": "field",
        "source_path": source_path,
        "target_path": target_path,
    }


def post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{API_BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def read_sample(name: str) -> str:
    return (SAMPLES_DIR / name).read_text(encoding="utf-8")


def print_block(title: str, payload: dict[str, Any]) -> None:
    print(f"\n## {title}")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
