import type {
  MappingSpec,
  MappingTemplate,
  MappingCapabilities,
  OutputDiffResponse,
  OutputFormat,
  ParseResponse,
  ScriptDraftResponse,
  SourceFormat,
  SuggestResponse,
  TemplateCreateRequest,
  TemplateListResponse,
  TemplateVersionCreateRequest,
  TransformResponse,
} from "@/types/mapping"
import type {
  SchemaArtifact,
  SchemaArtifactCreateRequest,
  SchemaArtifactListResponse,
  SchemaDirection,
  SchemaNode,
} from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"

type SchemaInferResponse = {
  schema: SchemaNode
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function parsePayload(
  format: SourceFormat,
  content: string
): Promise<ParseResponse> {
  return postJson<ParseResponse>("/api/parse", { format, content })
}

export async function inferSchema(data: unknown): Promise<SchemaInferResponse> {
  return postJson<SchemaInferResponse>("/api/schema/infer", { data })
}

export async function createSchemaArtifact(
  request: SchemaArtifactCreateRequest
): Promise<SchemaArtifact> {
  return postJson<SchemaArtifact>("/api/schemas", request)
}

export async function listSchemaArtifacts(params?: {
  direction?: SchemaDirection
  includeDeleted?: boolean
}): Promise<SchemaArtifactListResponse> {
  const search = new URLSearchParams()
  if (params?.direction) search.set("direction", params.direction)
  if (params?.includeDeleted) search.set("include_deleted", "true")
  const query = search.toString()
  return getJson<SchemaArtifactListResponse>(
    query ? `/api/schemas?${query}` : "/api/schemas"
  )
}

export async function getSchemaArtifact(
  schemaId: string
): Promise<SchemaArtifact> {
  return getJson<SchemaArtifact>(`/api/schemas/${encodeURIComponent(schemaId)}`)
}

export async function deleteSchemaArtifact(
  schemaId: string
): Promise<SchemaArtifact> {
  return requestJson<SchemaArtifact>(
    `/api/schemas/${encodeURIComponent(schemaId)}`,
    { method: "DELETE" }
  )
}

export async function suggestMappings(params: {
  sourceSchema: SchemaNode
  targetSchema: SchemaNode
  useAi: boolean
}): Promise<SuggestResponse> {
  return postJson<SuggestResponse>("/api/mappings/suggest", {
    source_schema: params.sourceSchema,
    target_schema: params.targetSchema,
    use_ai: params.useAi,
  })
}

export async function getMappingCapabilities(): Promise<MappingCapabilities> {
  return getJson<MappingCapabilities>("/api/mappings/capabilities")
}

export async function generateScriptDraft(params: {
  sourceSample: unknown
  targetSample: unknown
  sourceSchema?: SchemaNode | null
  targetSchema?: SchemaNode | null
  useAi: boolean
}): Promise<ScriptDraftResponse> {
  return postJson<ScriptDraftResponse>("/api/mappings/script/draft", {
    source_sample: params.sourceSample,
    target_sample: params.targetSample,
    source_schema: params.sourceSchema ?? null,
    target_schema: params.targetSchema ?? null,
    use_ai: params.useAi,
  })
}

export async function transformPayload(params: {
  sourceData: unknown
  mappingSpec: MappingSpec
  outputFormat: OutputFormat
  targetSchema?: SchemaNode | null
}): Promise<TransformResponse> {
  return postJson<TransformResponse>("/api/transform", {
    source_data: params.sourceData,
    mapping_spec: params.mappingSpec,
    output_format: params.outputFormat,
    root_element: "ShipmentEvent",
    target_schema: params.targetSchema ?? null,
  })
}

export async function validatePayload(params: {
  sourceData: unknown
  output?: unknown
  mappingSpec: MappingSpec
  targetSchema?: SchemaNode | null
}): Promise<{ valid: boolean; errors: ValidationErrorItem[] }> {
  return postJson("/api/validate", {
    source_data: params.sourceData,
    output: params.output ?? null,
    mapping_spec: params.mappingSpec,
    target_schema: params.targetSchema ?? null,
  })
}

export async function diffOutput(params: {
  expected: unknown
  actual: unknown
}): Promise<OutputDiffResponse> {
  return postJson<OutputDiffResponse>("/api/transform/diff", params)
}

export async function createTemplate(
  request: TemplateCreateRequest
): Promise<MappingTemplate> {
  return postJson<MappingTemplate>("/api/templates", request)
}

export async function listTemplates(): Promise<TemplateListResponse> {
  return getJson<TemplateListResponse>("/api/templates")
}

export async function getTemplate(
  templateId: string
): Promise<MappingTemplate> {
  return getJson<MappingTemplate>(
    `/api/templates/${encodeURIComponent(templateId)}`
  )
}

export async function createTemplateVersion(
  templateId: string,
  request: TemplateVersionCreateRequest
): Promise<MappingTemplate> {
  return postJson<MappingTemplate>(
    `/api/templates/${encodeURIComponent(templateId)}/versions`,
    request
  )
}

async function postJson<TResponse>(
  path: string,
  body: unknown
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  return requestJson<TResponse>(path)
}

async function requestJson<TResponse>(
  path: string,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? JSON.stringify(payload.detail)
        : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  return payload as TResponse
}
