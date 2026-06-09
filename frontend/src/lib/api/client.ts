import type {
  MappingRule,
  MappingTemplate,
  MappingCapabilities,
  OutputFormat,
  ParseResponse,
  SourceFormat,
  SuggestResponse,
  TemplateCreateRequest,
  TemplateListResponse,
  TemplateVersionCreateRequest,
  TransformResponse,
} from "@/types/mapping"
import type { SchemaNode } from "@/types/schema"
import type { ValidationErrorItem } from "@/types/validation"

type SchemaInferResponse = {
  schema: SchemaNode
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function parsePayload(format: SourceFormat, content: string): Promise<ParseResponse> {
  return postJson<ParseResponse>("/api/parse", { format, content })
}

export async function inferSchema(data: unknown): Promise<SchemaInferResponse> {
  return postJson<SchemaInferResponse>("/api/schema/infer", { data })
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

export async function transformPayload(params: {
  sourceData: unknown
  rules: MappingRule[]
  outputFormat: OutputFormat
  targetSchema?: SchemaNode | null
}): Promise<TransformResponse> {
  return postJson<TransformResponse>("/api/transform", {
    source_data: params.sourceData,
    rules: params.rules,
    output_format: params.outputFormat,
    root_element: "ShipmentEvent",
    target_schema: params.targetSchema ?? null,
  })
}

export async function validatePayload(params: {
  sourceData: unknown
  output?: unknown
  rules: MappingRule[]
  targetSchema?: SchemaNode | null
}): Promise<{ valid: boolean; errors: ValidationErrorItem[] }> {
  return postJson("/api/validate", {
    source_data: params.sourceData,
    output: params.output ?? null,
    rules: params.rules,
    target_schema: params.targetSchema ?? null,
  })
}

export async function createTemplate(request: TemplateCreateRequest): Promise<MappingTemplate> {
  return postJson<MappingTemplate>("/api/templates", request)
}

export async function listTemplates(): Promise<TemplateListResponse> {
  return getJson<TemplateListResponse>("/api/templates")
}

export async function getTemplate(templateId: string): Promise<MappingTemplate> {
  return getJson<MappingTemplate>(`/api/templates/${encodeURIComponent(templateId)}`)
}

export async function createTemplateVersion(
  templateId: string,
  request: TemplateVersionCreateRequest,
): Promise<MappingTemplate> {
  return postJson<MappingTemplate>(`/api/templates/${encodeURIComponent(templateId)}/versions`, request)
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? JSON.stringify(payload.detail)
        : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  return payload as TResponse
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? JSON.stringify(payload.detail)
        : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  return payload as TResponse
}
