from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

JsonValue = dict[str, Any] | list[Any] | str | int | float | bool | None
SchemaType = Literal["object", "array", "string", "integer", "number", "boolean", "null", "mixed"]


class SourceFormat(StrEnum):
    json = "json"
    xml = "xml"
    edi_214 = "edi_214"
    edi_856 = "edi_856"


class SchemaDirection(StrEnum):
    source = "source"
    target = "target"


class SchemaInputMethod(StrEnum):
    paste = "paste"
    upload = "upload"


class ParseRequest(BaseModel):
    format: SourceFormat
    content: str = Field(min_length=1)


class ParseResponse(BaseModel):
    format: SourceFormat
    canonical: JsonValue
    metadata: dict[str, Any] = Field(default_factory=dict)


class SchemaInferRequest(BaseModel):
    data: JsonValue


class SchemaNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: SchemaType
    path: str
    required: bool = True
    fields: dict[str, SchemaNode] | None = None
    items: SchemaNode | None = None
    examples: list[JsonValue] = Field(default_factory=list)


class SchemaInferResponse(BaseModel):
    schema_: SchemaNode = Field(alias="schema")


class SchemaArtifactCreateRequest(BaseModel):
    schema_id: str | None = None
    name: str = Field(min_length=1)
    description: str = ""
    direction: SchemaDirection
    format: SourceFormat
    content: str = Field(min_length=1)
    input_method: SchemaInputMethod = SchemaInputMethod.paste
    original_filename: str | None = None
    original_content_type: str | None = None
    original_size: int | None = Field(default=None, ge=0)


class SchemaArtifact(BaseModel):
    schema_id: str
    name: str
    description: str = ""
    direction: SchemaDirection
    format: SourceFormat
    original_content: str
    original_filename: str | None = None
    original_content_type: str | None = None
    original_size: int
    input_method: SchemaInputMethod
    canonical_sample: JsonValue
    inferred_schema: SchemaNode
    parse_metadata: dict[str, Any] = Field(default_factory=dict)
    deleted_at: datetime | None = None
    created_at: datetime


class SchemaArtifactListResponse(BaseModel):
    schemas: list[SchemaArtifact]


class RuleType(StrEnum):
    field = "field"
    constant = "constant"
    concat = "concat"
    date_format = "date_format"
    condition = "condition"
    loop = "loop"


class SuggestionSource(StrEnum):
    rule_based = "rule_based"
    openrouter = "openrouter"


class MappingSuggestionRequest(BaseModel):
    source_schema: SchemaNode
    target_schema: SchemaNode
    domain_context: str = "logistics and supply chain integration mapping"
    use_ai: bool = True


class MappingSuggestion(BaseModel):
    id: str
    type: RuleType = RuleType.field
    source_path: str
    target_path: str
    required: bool = True
    confidence: float = Field(ge=0, le=1)
    jsonata: str
    explanation: str
    source: SuggestionSource = SuggestionSource.rule_based


class MappingSuggestionResponse(BaseModel):
    suggestions: list[MappingSuggestion]
    used_ai: bool = False
    provider_errors: list[str] = Field(default_factory=list)


class MappingCapabilitiesResponse(BaseModel):
    ai_mapping_available: bool
    ai_provider: str | None = None


class OutputFormat(StrEnum):
    json = "json"
    xml = "xml"


class ConditionSpec(BaseModel):
    source_path: str
    equals: JsonValue
    then: JsonValue
    otherwise: JsonValue = None


class LoopRuleSpec(BaseModel):
    source_path: str
    target_path: str
    rules: list[MappingRule]


class MappingRule(BaseModel):
    id: str
    type: RuleType
    target_path: str
    source_path: str | None = None
    required: bool = True
    confidence: float | None = Field(default=None, ge=0, le=1)
    jsonata: str | None = None
    value: JsonValue = None
    source_paths: list[str] = Field(default_factory=list)
    separator: str = ""
    input_format: str = "%Y%m%d"
    output_format: str = "%Y-%m-%d"
    condition: ConditionSpec | None = None
    loop: LoopRuleSpec | None = None


class ValidationErrorItem(BaseModel):
    code: str
    path: str | None = None
    message: str
    rule_id: str | None = None


class TransformTraceItem(BaseModel):
    node_id: str
    node_type: str
    target_path: str | None = None
    status: Literal["executed", "failed", "skipped"] = "executed"
    message: str = ""


class NativeGraphTransform(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    pattern: str | None = None
    replacement: str = ""
    input_format: str | None = None
    output_format: str | None = None
    lookup_table: str | None = None
    default: JsonValue = None
    factor: float | None = None
    separator: str | None = None
    index: int | None = None
    precision: int | None = None


class NativeGraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal[
        "assign",
        "loop",
        "compute",
        "template",
        "object",
        "array",
        "map",
        "filter",
        "reduce",
        "conditional",
        "lookup",
        "switch",
        "append",
        "merge",
        "group_by",
        "sort",
    ]
    target_path: str | None = None
    source_path: str | None = None
    source_paths: list[str] = Field(default_factory=list)
    var_name: str | None = None
    value: JsonValue = None
    expression: str | None = None
    operation: str | None = None
    condition: dict[str, JsonValue] | None = None
    lookup_table: str | None = None
    key_path: str | None = None
    value_path: str | None = None
    sort_path: str | None = None
    group_key_path: str | None = None
    descending: bool = False
    include_empty: bool = True
    transforms: list[NativeGraphTransform] = Field(default_factory=list)
    children: list[NativeGraphNode] = Field(default_factory=list)


class NativeGraphSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spec_version: int = 1
    nodes: list[NativeGraphNode]
    lookup_tables: dict[str, dict[str, JsonValue]] = Field(default_factory=dict)


class MappingSpec(BaseModel):
    engine: str = "deterministic_rules"
    spec_version: int | None = None
    rules: list[MappingRule] = Field(default_factory=list)
    native_graph: NativeGraphSpec | None = None
    full_jsonata_expression: str | None = None


class TransformRequest(BaseModel):
    source_data: JsonValue
    rules: list[MappingRule] = Field(default_factory=list)
    mapping_spec: MappingSpec | None = None
    output_format: OutputFormat = OutputFormat.json
    root_element: str = "Output"
    target_schema: SchemaNode | None = None


class TransformResponse(BaseModel):
    output_format: OutputFormat
    output: JsonValue | str
    validation_errors: list[ValidationErrorItem] = Field(default_factory=list)
    trace: list[TransformTraceItem] = Field(default_factory=list)


class ValidateRequest(BaseModel):
    source_data: JsonValue | None = None
    output: JsonValue | None = None
    rules: list[MappingRule] = Field(default_factory=list)
    mapping_spec: MappingSpec | None = None
    target_schema: SchemaNode | None = None


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationErrorItem] = Field(default_factory=list)


class OutputDiffItem(BaseModel):
    path: str
    kind: Literal["missing", "extra", "changed"]
    expected: JsonValue = None
    actual: JsonValue = None


class OutputDiffRequest(BaseModel):
    expected: JsonValue
    actual: JsonValue


class OutputDiffResponse(BaseModel):
    equal: bool
    diffs: list[OutputDiffItem] = Field(default_factory=list)


class NativeGraphDraftRequest(BaseModel):
    source_sample: JsonValue
    target_sample: JsonValue
    source_schema: SchemaNode | None = None
    target_schema: SchemaNode | None = None
    domain_context: str = ""
    use_ai: bool = False


class NativeGraphDraftResponse(BaseModel):
    mapping_spec: MappingSpec
    unresolved_target_paths: list[str] = Field(default_factory=list)
    used_ai: bool = False
    provider_errors: list[str] = Field(default_factory=list)


class TemplateVersion(BaseModel):
    version: int
    source_format: SourceFormat
    target_format: OutputFormat
    source_schema_id: str | None = None
    target_schema_id: str | None = None
    source_schema_snapshot: SchemaNode | None = None
    target_schema_snapshot: SchemaNode | None = None
    mapping_spec: MappingSpec
    validation_rules: list[ValidationErrorItem] = Field(default_factory=list)
    sample_source_content: str | None = None
    sample_target_content: str | None = None
    created_at: datetime


class MappingTemplate(BaseModel):
    template_id: str
    name: str
    description: str = ""
    active_version: int
    is_seeded: bool = False
    versions: list[TemplateVersion]


class TemplateCreateRequest(BaseModel):
    template_id: str | None = None
    name: str = Field(min_length=1)
    description: str = ""
    source_format: SourceFormat
    target_format: OutputFormat
    source_schema_id: str | None = None
    target_schema_id: str | None = None
    source_schema_snapshot: SchemaNode | None = None
    target_schema_snapshot: SchemaNode | None = None
    mapping_spec: MappingSpec
    validation_rules: list[ValidationErrorItem] = Field(default_factory=list)
    sample_source_content: str | None = None
    sample_target_content: str | None = None


class TemplateVersionCreateRequest(BaseModel):
    source_format: SourceFormat
    target_format: OutputFormat
    source_schema_id: str | None = None
    target_schema_id: str | None = None
    source_schema_snapshot: SchemaNode | None = None
    target_schema_snapshot: SchemaNode | None = None
    mapping_spec: MappingSpec
    validation_rules: list[ValidationErrorItem] = Field(default_factory=list)
    sample_source_content: str | None = None
    sample_target_content: str | None = None


class TemplateListResponse(BaseModel):
    templates: list[MappingTemplate]
