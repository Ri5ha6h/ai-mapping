export type ValidationErrorItem = {
  code: string
  path?: string | null
  message: string
  rule_id?: string | null
}

export type FieldValidationRule = {
  schema_id: string
  path: string
  value_type: string
  required: boolean
  min_value?: number | null
  max_value?: number | null
  min_length?: number | null
  max_length?: number | null
  description?: string | null
  created_at: string
  updated_at: string
}

export type FieldValidationRuleUpsertRequest = {
  path: string
  value_type: string
  required: boolean
  min_value?: number | null
  max_value?: number | null
  min_length?: number | null
  max_length?: number | null
  description?: string | null
}

export type FieldValidationRuleListResponse = {
  rules: FieldValidationRule[]
}
