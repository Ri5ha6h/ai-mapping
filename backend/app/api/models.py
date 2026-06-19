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


class FieldValidationRule(BaseModel):
    schema_id: str
    path: str = Field(min_length=1)
    value_type: str = "mixed"
    required: bool = False
    min_value: float | None = None
    max_value: float | None = None
    min_length: int | None = Field(default=None, ge=0)
    max_length: int | None = Field(default=None, ge=0)
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class FieldValidationRuleUpsertRequest(BaseModel):
    path: str = Field(min_length=1)
    value_type: str = "mixed"
    required: bool = False
    min_value: float | None = None
    max_value: float | None = None
    min_length: int | None = Field(default=None, ge=0)
    max_length: int | None = Field(default=None, ge=0)
    description: str | None = None


class FieldValidationRuleListResponse(BaseModel):
    rules: list[FieldValidationRule]


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
    source_path: str
    target_path: str
    required: bool = True
    confidence: float = Field(ge=0, le=1)
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


class ValidationErrorItem(BaseModel):
    code: str
    path: str | None = None
    message: str
    rule_id: str | None = None


class TransformTraceItem(BaseModel):
    step_id: str
    step_type: str
    target_path: str | None = None
    status: Literal["executed", "failed", "skipped"] = "executed"
    message: str = ""


class ScriptLogItem(BaseModel):
    level: Literal["log", "info", "warn", "error"]
    message: str
    index: int


class MappingSpec(BaseModel):
    engine: Literal["script_js"] = "script_js"
    script_version: int = 1
    script: str = Field(default="", description="JavaScript transform(source, helpers) function.")


class TransformRequest(BaseModel):
    source_data: JsonValue
    mapping_spec: MappingSpec | None = None
    output_format: OutputFormat = OutputFormat.json
    root_element: str = "Output"
    target_schema: SchemaNode | None = None
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)


class TransformResponse(BaseModel):
    output_format: OutputFormat
    output: JsonValue | str
    validation_errors: list[ValidationErrorItem] = Field(default_factory=list)
    trace: list[TransformTraceItem] = Field(default_factory=list)
    logs: list[ScriptLogItem] = Field(default_factory=list)


class ValidateRequest(BaseModel):
    source_data: JsonValue | None = None
    output: JsonValue | None = None
    mapping_spec: MappingSpec | None = None
    target_schema: SchemaNode | None = None
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)
    output_format: OutputFormat = OutputFormat.json


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationErrorItem] = Field(default_factory=list)
    policy: str | None = None


class OutputDiffItem(BaseModel):
    path: str
    kind: Literal["missing", "extra", "changed"]
    expected: JsonValue = None
    actual: JsonValue = None


class OutputDiffRequest(BaseModel):
    expected: JsonValue
    actual: JsonValue
    output_format: OutputFormat = OutputFormat.json


class OutputDiffResponse(BaseModel):
    equal: bool
    diffs: list[OutputDiffItem] = Field(default_factory=list)
    supported: bool = True
    message: str | None = None


class ScriptDraftRequest(BaseModel):
    source_sample: JsonValue
    target_sample: JsonValue
    source_schema: SchemaNode | None = None
    target_schema: SchemaNode | None = None
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)
    domain_context: str = ""
    use_ai: bool = False


class ScriptDraftResponse(BaseModel):
    mapping_spec: MappingSpec
    explanation: str = ""
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
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)
    sample_source_content: str | None = None
    sample_target_content: str | None = None
    created_at: datetime


class MappingTemplate(BaseModel):
    template_id: str
    name: str
    description: str = ""
    active_version: int
    is_seeded: bool = False
    deleted_at: datetime | None = None
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
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)
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
    field_validation_rules: list[FieldValidationRuleUpsertRequest] = Field(default_factory=list)
    sample_source_content: str | None = None
    sample_target_content: str | None = None


class TemplateListResponse(BaseModel):
    templates: list[MappingTemplate]
