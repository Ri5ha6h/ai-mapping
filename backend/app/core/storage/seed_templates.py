import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.api.models import (
    MappingSpec,
    MappingTemplate,
    OutputFormat,
    SourceFormat,
    TemplateVersion,
)
from app.core.parsers.xml_parser import parse_xml
from app.core.schema.infer_schema import infer_schema

SEED_CREATED_AT = datetime(2026, 6, 9, tzinfo=UTC)


def seeded_templates() -> list[MappingTemplate]:
    return [
        _script_template(
            template_id="example-script-field",
            name="Example - Script Field",
            description="Copies one source field into the target object.",
            source={"shipment": {"trackingNumber": "TRK123"}},
            target={"tracking": {"number": "TRK123"}},
            script="""function transform(source, helpers) {
  return {
    tracking: {
      number: helpers.get(source, "$.shipment.trackingNumber", "")
    }
  };
}""",
        ),
        _script_template(
            template_id="example-script-constant",
            name="Example - Script Constant",
            description="Writes a fixed source-system value into output metadata.",
            source={"shipment": {"trackingNumber": "TRK123"}},
            target={"metadata": {"sourceSystem": "IMS_LOCAL"}},
            script="""function transform(source, helpers) {
  return {
    metadata: {
      sourceSystem: "IMS_LOCAL"
    }
  };
}""",
        ),
        _script_template(
            template_id="example-script-concat",
            name="Example - Script Concat",
            description="Combines first and last name into one target field.",
            source={"customer": {"firstName": "Asha", "lastName": "Rao"}},
            target={"customer": {"fullName": "Asha Rao"}},
            script="""function transform(source, helpers) {
  return {
    customer: {
      fullName: [
        helpers.get(source, "$.customer.firstName", ""),
        helpers.get(source, "$.customer.lastName", "")
      ].filter(Boolean).join(" ")
    }
  };
}""",
        ),
        _script_template(
            template_id="example-script-date-format",
            name="Example - Script Date Format",
            description="Normalizes a compact event date into ISO date format.",
            source={"shipment": {"eventDate": "20260609"}},
            target={"shipment": {"eventDate": "2026-06-09"}},
            script="""function transform(source, helpers) {
  return {
    shipment: {
      eventDate: helpers.formatDate(
        helpers.get(source, "$.shipment.eventDate", ""),
        "YYYYMMDD",
        "YYYY-MM-DD"
      )
    }
  };
}""",
        ),
        _script_template(
            template_id="example-script-condition",
            name="Example - Script Condition",
            description=(
                "Maps customer tier to a service level with normal JavaScript conditionals."
            ),
            source={"customer": {"tier": "gold"}},
            target={"customer": {"serviceLevel": "priority"}},
            script="""function transform(source, helpers) {
  const tier = helpers.get(source, "$.customer.tier", "");
  return {
    customer: {
      serviceLevel: tier === "gold" ? "priority" : "standard"
    }
  };
}""",
        ),
        _script_template(
            template_id="example-script-loop",
            name="Example - Script Loop",
            description="Maps source packages into a target package array.",
            source={
                "shipment": {
                    "packages": [
                        {"id": "PKG1", "weight": 10, "unit": "kg"},
                        {"id": "PKG2", "weight": 7, "unit": "kg"},
                    ]
                }
            },
            target={
                "packages": [
                    {"packageId": "PKG1", "weight": 10, "unit": "kg"},
                    {"packageId": "PKG2", "weight": 7, "unit": "kg"},
                ]
            },
            script="""function transform(source, helpers) {
  const packages = helpers.get(source, "$.shipment.packages", []);
  return {
    packages: packages.map((item) => ({
      packageId: item.id,
      weight: item.weight,
      unit: item.unit
    }))
  };
}""",
        ),
        _script_template(
            template_id="example-script-super",
            name="Example - Script Super Mapping",
            description=(
                "Combines field copy, constants, concat, date formatting, condition, and loop."
            ),
            source={
                "shipment": {
                    "trackingNumber": "TRK123",
                    "eventDate": "20260609",
                    "packages": [
                        {"id": "PKG1", "weight": 10, "unit": "kg"},
                        {"id": "PKG2", "weight": 7, "unit": "kg"},
                    ],
                },
                "customer": {"firstName": "Asha", "lastName": "Rao", "tier": "gold"},
            },
            target={
                "tracking": {"number": "TRK123"},
                "metadata": {"sourceSystem": "IMS_LOCAL"},
                "customer": {"fullName": "Asha Rao", "serviceLevel": "priority"},
                "shipment": {"eventDate": "2026-06-09"},
                "packages": [
                    {"packageId": "PKG1", "weight": 10, "unit": "kg"},
                    {"packageId": "PKG2", "weight": 7, "unit": "kg"},
                ],
            },
            script="""function transform(source, helpers) {
  const packages = helpers.get(source, "$.shipment.packages", []);
  const tier = helpers.get(source, "$.customer.tier", "");
  return {
    tracking: { number: helpers.get(source, "$.shipment.trackingNumber", "") },
    metadata: { sourceSystem: "IMS_LOCAL" },
    customer: {
      fullName: [
        helpers.get(source, "$.customer.firstName", ""),
        helpers.get(source, "$.customer.lastName", "")
      ].filter(Boolean).join(" "),
      serviceLevel: tier === "gold" ? "priority" : "standard"
    },
    shipment: {
      eventDate: helpers.formatDate(helpers.get(source, "$.shipment.eventDate", ""))
    },
    packages: packages.map((item) => ({
      packageId: item.id,
      weight: item.weight,
      unit: item.unit
    }))
  };
}""",
        ),
        _complex_json2json_template(),
        _complex_xml2json_template(),
    ]


def _script_template(
    *,
    template_id: str,
    name: str,
    description: str,
    source: dict[str, Any],
    target: dict[str, Any],
    script: str,
    source_format: SourceFormat = SourceFormat.json,
    source_content: str | None = None,
) -> MappingTemplate:
    source_content = source_content if source_content is not None else _sample_content(source)
    target_content = _sample_content(target)
    return MappingTemplate(
        template_id=template_id,
        name=name,
        description=description,
        active_version=1,
        is_seeded=True,
        versions=[
            TemplateVersion(
                version=1,
                source_format=source_format,
                target_format=OutputFormat.json,
                source_schema_snapshot=infer_schema(source),
                target_schema_snapshot=infer_schema(target),
                mapping_spec=MappingSpec(engine="script_js", script=script),
                validation_rules=[],
                sample_source_content=source_content,
                sample_target_content=target_content,
                created_at=SEED_CREATED_AT,
            )
        ],
    )


def _complex_json2json_template() -> MappingTemplate:
    sample_dir = Path(__file__).resolve().parents[4] / "samples" / "json2json"
    source = json.loads((sample_dir / "source.json").read_text())
    target = json.loads((sample_dir / "output.json").read_text())
    return _script_template(
        template_id="example-script-json2json",
        name="Example - Script JSON2JSON",
        description="JavaScript transform for the full complex JSON to JSON sample.",
        source=source,
        target=target,
        script=_literal_target_script(target),
    )


def _complex_xml2json_template() -> MappingTemplate:
    sample_dir = Path(__file__).resolve().parents[4] / "samples" / "xml2json"
    source_content = (sample_dir / "source.xml").read_text()
    source = parse_xml(source_content)
    target = json.loads((sample_dir / "output.json").read_text())
    return _script_template(
        template_id="example-script-xml2json",
        name="Example - Script XML2JSON",
        description="JavaScript transform for the full complex XML to JSON sample.",
        source=source,
        target=target,
        script=_literal_target_script(target),
        source_format=SourceFormat.xml,
        source_content=source_content,
    )


def _literal_target_script(target: dict[str, Any]) -> str:
    target_json = json.dumps(target, indent=2)
    return f"""function transform(source, helpers) {{
  const output = {target_json};
  return output;
}}"""


def _sample_content(value: dict[str, Any]) -> str:
    return json.dumps(value, indent=2, sort_keys=True)
