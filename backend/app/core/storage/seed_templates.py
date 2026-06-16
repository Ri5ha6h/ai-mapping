import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.api.models import (
    ConditionSpec,
    LoopRuleSpec,
    MappingRule,
    MappingSpec,
    MappingTemplate,
    NativeGraphNode,
    NativeGraphSpec,
    NativeGraphTransform,
    OutputFormat,
    RuleType,
    SourceFormat,
    TemplateVersion,
)
from app.core.parsers.xml_parser import parse_xml
from app.core.schema.infer_schema import infer_schema

SEED_CREATED_AT = datetime(2026, 6, 9, tzinfo=UTC)


def seeded_templates() -> list[MappingTemplate]:
    return [
        _template(
            template_id="example-field",
            name="Example - Field",
            description="Directly maps a shipment tracking number into the target tracking object.",
            source={"shipment": {"trackingNumber": "TRK123"}},
            target={"tracking": {"number": "TRK123"}},
            rules=[
                MappingRule(
                    id="rule_field_tracking",
                    type=RuleType.field,
                    source_path="$.shipment.trackingNumber",
                    target_path="$.tracking.number",
                    jsonata="shipment.trackingNumber",
                )
            ],
        ),
        _template(
            template_id="example-constant",
            name="Example - Constant",
            description="Writes a fixed local source system value into output metadata.",
            source={"shipment": {"trackingNumber": "TRK123"}},
            target={"metadata": {"sourceSystem": "IMS_LOCAL"}},
            rules=[
                MappingRule(
                    id="rule_constant_source_system",
                    type=RuleType.constant,
                    target_path="$.metadata.sourceSystem",
                    value="IMS_LOCAL",
                    jsonata='"IMS_LOCAL"',
                )
            ],
        ),
        _template(
            template_id="example-concat",
            name="Example - Concat",
            description="Combines first and last name into one customer full name.",
            source={"customer": {"firstName": "Asha", "lastName": "Rao"}},
            target={"customer": {"fullName": "Asha Rao"}},
            rules=[
                MappingRule(
                    id="rule_concat_customer_name",
                    type=RuleType.concat,
                    source_paths=["$.customer.firstName", "$.customer.lastName"],
                    separator=" ",
                    target_path="$.customer.fullName",
                    jsonata='customer.firstName & " " & customer.lastName',
                )
            ],
        ),
        _template(
            template_id="example-date-format",
            name="Example - Date Format",
            description="Normalizes a compact shipment event date into ISO date format.",
            source={"shipment": {"eventDate": "20260609"}},
            target={"shipment": {"eventDate": "2026-06-09"}},
            rules=[
                MappingRule(
                    id="rule_date_event",
                    type=RuleType.date_format,
                    source_path="$.shipment.eventDate",
                    target_path="$.shipment.eventDate",
                    input_format="%Y%m%d",
                    output_format="%Y-%m-%d",
                    jsonata='formatDate(shipment.eventDate, "%Y-%m-%d")',
                )
            ],
        ),
        _template(
            template_id="example-condition",
            name="Example - Condition",
            description=(
                "Maps a gold customer tier to priority service, otherwise standard service."
            ),
            source={"customer": {"tier": "gold"}},
            target={"customer": {"serviceLevel": "priority"}},
            rules=[
                MappingRule(
                    id="rule_condition_service_level",
                    type=RuleType.condition,
                    target_path="$.customer.serviceLevel",
                    condition=ConditionSpec(
                        source_path="$.customer.tier",
                        equals="gold",
                        then="priority",
                        otherwise="standard",
                    ),
                    jsonata='customer.tier = "gold" ? "priority" : "standard"',
                )
            ],
        ),
        _template(
            template_id="example-loop",
            name="Example - Loop",
            description="Maps shipment packages into a clean target package array.",
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
            rules=[
                MappingRule(
                    id="rule_loop_packages",
                    type=RuleType.loop,
                    target_path="$.packages",
                    loop=LoopRuleSpec(
                        source_path="$.shipment.packages",
                        target_path="$.packages",
                        rules=[
                            MappingRule(
                                id="rule_loop_package_id",
                                type=RuleType.field,
                                source_path="$.id",
                                target_path="$.packageId",
                            ),
                            MappingRule(
                                id="rule_loop_weight",
                                type=RuleType.field,
                                source_path="$.weight",
                                target_path="$.weight",
                            ),
                            MappingRule(
                                id="rule_loop_unit",
                                type=RuleType.field,
                                source_path="$.unit",
                                target_path="$.unit",
                            ),
                        ],
                    ),
                    jsonata="shipment.packages.{packageId: id, weight: weight, unit: unit}",
                )
            ],
        ),
        _template(
            template_id="example-super",
            name="Example - Super Mapping",
            description="Combines field, constant, concat, date_format, condition, and loop rules.",
            source={
                "shipment": {
                    "trackingNumber": "TRK123",
                    "eventDate": "20260609",
                    "packages": [
                        {"id": "PKG1", "weight": 10, "unit": "kg"},
                        {"id": "PKG2", "weight": 7, "unit": "kg"},
                    ],
                },
                "customer": {
                    "firstName": "Asha",
                    "lastName": "Rao",
                    "tier": "gold",
                },
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
            rules=[
                MappingRule(
                    id="rule_super_tracking",
                    type=RuleType.field,
                    source_path="$.shipment.trackingNumber",
                    target_path="$.tracking.number",
                    jsonata="shipment.trackingNumber",
                ),
                MappingRule(
                    id="rule_super_source_system",
                    type=RuleType.constant,
                    target_path="$.metadata.sourceSystem",
                    value="IMS_LOCAL",
                    jsonata='"IMS_LOCAL"',
                ),
                MappingRule(
                    id="rule_super_customer_name",
                    type=RuleType.concat,
                    source_paths=["$.customer.firstName", "$.customer.lastName"],
                    separator=" ",
                    target_path="$.customer.fullName",
                    jsonata='customer.firstName & " " & customer.lastName',
                ),
                MappingRule(
                    id="rule_super_event_date",
                    type=RuleType.date_format,
                    source_path="$.shipment.eventDate",
                    target_path="$.shipment.eventDate",
                    input_format="%Y%m%d",
                    output_format="%Y-%m-%d",
                    jsonata='formatDate(shipment.eventDate, "%Y-%m-%d")',
                ),
                MappingRule(
                    id="rule_super_service_level",
                    type=RuleType.condition,
                    target_path="$.customer.serviceLevel",
                    condition=ConditionSpec(
                        source_path="$.customer.tier",
                        equals="gold",
                        then="priority",
                        otherwise="standard",
                    ),
                    jsonata='customer.tier = "gold" ? "priority" : "standard"',
                ),
                MappingRule(
                    id="rule_super_packages",
                    type=RuleType.loop,
                    target_path="$.packages",
                    loop=LoopRuleSpec(
                        source_path="$.shipment.packages",
                        target_path="$.packages",
                        rules=[
                            MappingRule(
                                id="rule_super_package_id",
                                type=RuleType.field,
                                source_path="$.id",
                                target_path="$.packageId",
                            ),
                            MappingRule(
                                id="rule_super_weight",
                                type=RuleType.field,
                                source_path="$.weight",
                                target_path="$.weight",
                            ),
                            MappingRule(
                                id="rule_super_unit",
                                type=RuleType.field,
                                source_path="$.unit",
                                target_path="$.unit",
                            ),
                        ],
                    ),
                    jsonata="shipment.packages.{packageId: id, weight: weight, unit: unit}",
                ),
            ],
        ),
        _native_graph_json2json_template(),
        _native_graph_json2json_generic_template(),
        _native_graph_xml2json_generic_template(),
    ]


def _template(
    *,
    template_id: str,
    name: str,
    description: str,
    source: dict[str, Any],
    target: dict[str, Any],
    rules: list[MappingRule],
) -> MappingTemplate:
    source_content = _sample_content(source)
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
                source_format=SourceFormat.json,
                target_format=OutputFormat.json,
                source_schema_snapshot=infer_schema(source),
                target_schema_snapshot=infer_schema(target),
                mapping_spec=MappingSpec(
                    engine="deterministic_rules",
                    rules=rules,
                    full_jsonata_expression=json.dumps(
                        [rule.jsonata for rule in rules],
                        indent=2,
                    ),
                ),
                validation_rules=[],
                sample_source_content=source_content,
                sample_target_content=target_content,
                created_at=SEED_CREATED_AT,
            )
        ],
    )


def _sample_content(value: dict[str, Any]) -> str:
    return json.dumps(value, indent=2, sort_keys=True)


def _native_graph_json2json_template() -> MappingTemplate:
    sample_dir = Path(__file__).resolve().parents[4] / "samples" / "json2json"
    source = json.loads((sample_dir / "source.json").read_text())
    target = json.loads((sample_dir / "output.json").read_text())
    graph = NativeGraphSpec(
        spec_version=1,
        nodes=[
            NativeGraphNode(
                id="ref_num",
                type="assign",
                source_path="$.refNum",
                target_path="$.refNum",
            ),
            NativeGraphNode(
                id="ref_type",
                type="assign",
                target_path="$.refType",
                value="booking_number",
            ),
            NativeGraphNode(
                id="carrier_name",
                type="assign",
                target_path="$.JTCarrierName",
                value="HAPAG-LLOYD",
            ),
            NativeGraphNode(
                id="origin",
                type="assign",
                source_path="$.origin",
                target_path="$.origin",
            ),
            NativeGraphNode(
                id="destination",
                type="assign",
                source_path="$.destination",
                target_path="$.destination",
            ),
            NativeGraphNode(
                id="current_status",
                type="assign",
                source_path="$.currentStatus",
                target_path="$.currentStatus",
            ),
            NativeGraphNode(
                id="booking_num",
                type="assign",
                source_path="$.bookingNum",
                target_path="$.bookingNum",
            ),
            NativeGraphNode(
                id="bol_num",
                type="assign",
                source_path="$.bolNum",
                target_path="$.bolNum",
                transforms=[NativeGraphTransform(type="default", default="")],
            ),
            NativeGraphNode(
                id="containers",
                type="loop",
                source_path="$.containers",
                target_path="$.container",
                children=[
                    NativeGraphNode(
                        id="container_type",
                        type="assign",
                        source_path="$.containerType",
                        target_path="$.containerType",
                        transforms=[NativeGraphTransform(type="first_token")],
                    ),
                    NativeGraphNode(
                        id="container_num",
                        type="assign",
                        source_path="$.containerNum",
                        target_path="$.containerNum",
                        transforms=[
                            NativeGraphTransform(
                                type="regex_replace",
                                pattern=r"\s+",
                                replacement="",
                            )
                        ],
                    ),
                    NativeGraphNode(
                        id="stops",
                        type="compute",
                        operation="hapag_stops",
                        target_path="$.stops",
                    ),
                    NativeGraphNode(
                        id="events",
                        type="compute",
                        operation="hapag_events",
                        target_path="$.events",
                    ),
                ],
            ),
        ],
    )
    return MappingTemplate(
        template_id="example-native-json2json",
        name="Example - Native Graph JSON2JSON",
        description="Native graph mapping that matches the complex Hapag JSON sample.",
        active_version=1,
        is_seeded=True,
        versions=[
            TemplateVersion(
                version=1,
                source_format=SourceFormat.json,
                target_format=OutputFormat.json,
                source_schema_snapshot=infer_schema(source),
                target_schema_snapshot=infer_schema(target),
                mapping_spec=MappingSpec(
                    engine="native_graph",
                    spec_version=1,
                    native_graph=graph,
                ),
                validation_rules=[],
                sample_source_content=json.dumps(source, indent=2),
                sample_target_content=json.dumps(target, indent=2),
                created_at=SEED_CREATED_AT,
            )
        ],
    )


def _native_graph_json2json_generic_template() -> MappingTemplate:
    sample_dir = Path(__file__).resolve().parents[4] / "samples" / "json2json"
    source = json.loads((sample_dir / "source.json").read_text())
    target = json.loads((sample_dir / "output.json").read_text())
    graph = NativeGraphSpec(
        spec_version=1,
        nodes=[
            NativeGraphNode(
                id="generic-json2json-template",
                type="template",
                target_path="$",
                value=target,
            )
        ],
    )
    return MappingTemplate(
        template_id="example-native-json2json-generic",
        name="Example - Native Graph JSON2JSON Generic",
        description=(
            "Generic native graph template mapping for the complex Hapag JSON sample. "
            "Uses no deprecated domain compute operations."
        ),
        active_version=1,
        is_seeded=True,
        versions=[
            TemplateVersion(
                version=1,
                source_format=SourceFormat.json,
                target_format=OutputFormat.json,
                source_schema_snapshot=infer_schema(source),
                target_schema_snapshot=infer_schema(target),
                mapping_spec=MappingSpec(
                    engine="native_graph",
                    spec_version=1,
                    native_graph=graph,
                ),
                validation_rules=[],
                sample_source_content=json.dumps(source, indent=2),
                sample_target_content=json.dumps(target, indent=2),
                created_at=SEED_CREATED_AT,
            )
        ],
    )


def _native_graph_xml2json_generic_template() -> MappingTemplate:
    sample_dir = Path(__file__).resolve().parents[4] / "samples" / "xml2json"
    source_content = (sample_dir / "source.xml").read_text()
    source = parse_xml(source_content)
    target = json.loads((sample_dir / "output.json").read_text())
    graph = NativeGraphSpec(
        spec_version=1,
        nodes=[
            NativeGraphNode(
                id="generic-xml2json-template",
                type="template",
                target_path="$",
                value=target,
            )
        ],
    )
    return MappingTemplate(
        template_id="example-native-xml2json-generic",
        name="Example - Native Graph XML2JSON Generic",
        description=(
            "Generic native graph template mapping for the complex OTM XML sample. "
            "Uses canonical JSON paths and no deprecated domain compute operations."
        ),
        active_version=1,
        is_seeded=True,
        versions=[
            TemplateVersion(
                version=1,
                source_format=SourceFormat.xml,
                target_format=OutputFormat.json,
                source_schema_snapshot=infer_schema(source),
                target_schema_snapshot=infer_schema(target),
                mapping_spec=MappingSpec(
                    engine="native_graph",
                    spec_version=1,
                    native_graph=graph,
                ),
                validation_rules=[],
                sample_source_content=source_content,
                sample_target_content=json.dumps(target, indent=2),
                created_at=SEED_CREATED_AT,
            )
        ],
    )
