from typing import Any

from fastapi import APIRouter

from app.api.models import (
    MappingCapabilitiesResponse,
    MappingSuggestion,
    MappingSuggestionRequest,
    MappingSuggestionResponse,
    ScriptDraftRequest,
    ScriptDraftResponse,
)
from app.config.settings import get_settings
from app.core.mapping.openrouter_provider import (
    OpenRouterProvider,
    OpenRouterScriptGenerationError,
    OpenRouterSuggestionError,
)
from app.core.mapping.rule_based_suggester import suggest_rule_based_mappings
from app.core.mapping.script_generator import generate_script_draft

router = APIRouter(prefix="/mappings", tags=["mappings"])


@router.get("/capabilities", response_model=MappingCapabilitiesResponse)
def mapping_capabilities() -> MappingCapabilitiesResponse:
    return MappingCapabilitiesResponse(
        ai_mapping_available=bool(get_settings().openrouter_api_key),
        ai_provider="openrouter",
    )


@router.post("/suggest", response_model=MappingSuggestionResponse)
def suggest_mappings(request: MappingSuggestionRequest) -> MappingSuggestionResponse:
    suggestions = suggest_rule_based_mappings(request.source_schema, request.target_schema)
    provider_errors: list[str] = []
    used_ai = False
    current_settings = get_settings()

    if request.use_ai and current_settings.openrouter_api_key:
        provider = OpenRouterProvider(
            api_key=current_settings.openrouter_api_key,
            model=current_settings.openrouter_model,
            http_referer=current_settings.openrouter_http_referer,
            app_title=current_settings.openrouter_app_title,
        )
        try:
            ai_suggestions = provider.suggest(
                request.source_schema,
                request.target_schema,
                request.domain_context,
            )
        except OpenRouterSuggestionError as exc:
            provider_errors.append(str(exc))
        else:
            suggestions = _merge_suggestions(suggestions, ai_suggestions)
            used_ai = True

    return MappingSuggestionResponse(
        suggestions=suggestions,
        used_ai=used_ai,
        provider_errors=provider_errors,
    )


@router.post("/script/draft", response_model=ScriptDraftResponse)
def generate_script(request: ScriptDraftRequest) -> ScriptDraftResponse:
    current_settings = get_settings()
    field_hints = (
        suggest_rule_based_mappings(request.source_schema, request.target_schema)
        if request.source_schema is not None and request.target_schema is not None
        else []
    )
    provider = (
        OpenRouterProvider(
            api_key=current_settings.openrouter_api_key,
            model=current_settings.openrouter_model,
            http_referer=current_settings.openrouter_http_referer,
            app_title=current_settings.openrouter_app_title,
        )
        if current_settings.openrouter_api_key
        else None
    )

    def ai_generator(
        source_sample: Any,
        target_sample: Any,
        source_schema: Any,
        target_schema: Any,
        field_hints_arg: Any,
        domain_context: str,
        local_script: str,
    ) -> str:
        if provider is None:
            raise OpenRouterScriptGenerationError("OpenRouter is not configured.")
        return provider.generate_script(
            source_sample=source_sample,
            target_sample=target_sample,
            source_schema=source_schema,
            target_schema=target_schema,
            field_hints=field_hints_arg,
            domain_context=domain_context,
            local_script=local_script,
        )

    mapping_spec, explanation, unresolved, used_ai, provider_errors = generate_script_draft(
        source_sample=request.source_sample,
        target_sample=request.target_sample,
        source_schema=request.source_schema,
        target_schema=request.target_schema,
        field_hints=field_hints,
        domain_context=request.domain_context,
        use_ai=request.use_ai,
        ai_available=provider is not None,
        ai_generator=ai_generator,
    )
    return ScriptDraftResponse(
        mapping_spec=mapping_spec,
        explanation=explanation,
        unresolved_target_paths=unresolved,
        used_ai=used_ai,
        provider_errors=provider_errors,
    )


def _merge_suggestions(
    rule_based: list[MappingSuggestion],
    ai_suggestions: list[MappingSuggestion],
) -> list[MappingSuggestion]:
    by_target = {suggestion.target_path: suggestion for suggestion in rule_based}
    for suggestion in ai_suggestions:
        existing = by_target.get(suggestion.target_path)
        if existing is None or suggestion.confidence > existing.confidence:
            by_target[suggestion.target_path] = suggestion
    return list(by_target.values())
