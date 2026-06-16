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
        script_for_paths("shipment", xml_output=False),
    )


def demo_xml_to_json() -> None:
    parsed = parse("xml", read_sample("source.xml"))
    transform(
        "XML to JSON",
        parsed["canonical"],
        "json",
        script_for_paths("Shipment", xml_output=False),
    )


def demo_json_to_xml() -> None:
    source = json.loads(read_sample("source.json"))
    transform(
        "JSON to XML",
        source,
        "xml",
        script_for_paths("shipment", xml_output=True),
    )


def demo_edi_214() -> None:
    parsed = parse("edi_214", read_sample("edi_214.edi"))
    script = edi_script("trackingNumber")
    transform("EDI 214 to JSON", parsed["canonical"], "json", script)
    transform("EDI 214 to XML", parsed["canonical"], "xml", script, root_element="ShipmentStatus")


def demo_edi_856() -> None:
    parsed = parse("edi_856", read_sample("edi_856.edi"))
    script = edi_script("shipmentId")
    transform("EDI 856 to JSON", parsed["canonical"], "json", script)
    transform(
        "EDI 856 to XML",
        parsed["canonical"],
        "xml",
        script,
        root_element="AdvanceShipNotice",
    )


def parse(format_: str, content: str) -> dict[str, Any]:
    response = post("/api/parse", {"format": format_, "content": content})
    print_block(f"Parsed {format_}", response)
    return response


def transform(
    title: str,
    source_data: Any,
    output_format: str,
    script: str,
    *,
    root_element: str = "ShipmentEvent",
) -> None:
    response = post(
        "/api/transform",
        {
            "source_data": source_data,
            "output_format": output_format,
            "root_element": root_element,
            "mapping_spec": {"engine": "script_js", "script": script},
        },
    )
    print_block(title, response)


def script_for_paths(root: str, *, xml_output: bool) -> str:
    if xml_output:
        return f"""function transform(source, helpers) {{
  return {{
    TrackingNumber: helpers.get(source, "$.{root}.trackingNumber", ""),
    Carrier: helpers.get(source, "$.{root}.carrier", ""),
    StatusCode: helpers.get(source, "$.{root}.status.code", ""),
    StatusDescription: helpers.get(source, "$.{root}.status.description", ""),
    EventTimestamp: helpers.formatDate(helpers.get(source, "$.{root}.eventTime", "")),
    City: helpers.get(source, "$.{root}.location.city", ""),
    Country: helpers.get(source, "$.{root}.location.country", "")
  }};
}}"""
    return f"""function transform(source, helpers) {{
  return {{
    tracking: {{
      number: helpers.get(source, "$.{root}.trackingNumber", ""),
      carrierCode: helpers.get(source, "$.{root}.carrier", "")
    }},
    event: {{
      statusCode: helpers.get(source, "$.{root}.status.code", ""),
      statusDescription: helpers.get(source, "$.{root}.status.description", ""),
      timestamp: helpers.formatDate(helpers.get(source, "$.{root}.eventTime", "")),
      city: helpers.get(source, "$.{root}.location.city", ""),
      country: helpers.get(source, "$.{root}.location.country", "")
    }}
  }};
}}"""


def edi_script(identifier_key: str) -> str:
    return f"""function transform(source, helpers) {{
  return {{
    ediType: helpers.get(source, "$.edi.transaction_set", ""),
    {identifier_key}: helpers.get(source, "$.edi.segments[3].elements[1]", ""),
    carrier: helpers.get(source, "$.edi.segments[3].elements[2]", ""),
    statusCode: helpers.get(source, "$.edi.segments[5].elements[0]", "")
  }};
}}"""


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
