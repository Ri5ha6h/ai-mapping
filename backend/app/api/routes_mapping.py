from fastapi import APIRouter

from app.api.models import (
    MappingCapabilitiesResponse,
    MappingSuggestion,
    MappingSuggestionRequest,
    MappingSuggestionResponse,
    NativeGraphDraftRequest,
    NativeGraphDraftResponse,
)
from app.config.settings import get_settings
from app.core.mapping.native_graph_generator import generate_native_graph_draft
from app.core.mapping.openrouter_provider import OpenRouterProvider, OpenRouterSuggestionError
from app.core.mapping.rule_based_suggester import suggest_rule_based_mappings

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


@router.post("/native-graph/draft", response_model=NativeGraphDraftResponse)
def generate_native_graph(request: NativeGraphDraftRequest) -> NativeGraphDraftResponse:
    mapping_spec, unresolved, used_ai, provider_errors = generate_native_graph_draft(
        source_sample=request.source_sample,
        target_sample=request.target_sample,
        use_ai=request.use_ai,
        ai_available=bool(get_settings().openrouter_api_key),
    )
    return NativeGraphDraftResponse(
        mapping_spec=mapping_spec,
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
