import json
from typing import Any

import httpx
from pydantic import TypeAdapter, ValidationError

from app.api.models import MappingSuggestion, SchemaNode, SuggestionSource

OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterSuggestionError(RuntimeError):
    pass


class OpenRouterProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str | None = None,
        http_referer: str | None = None,
        app_title: str | None = None,
        timeout_seconds: float = 20,
    ) -> None:
        self.api_key = api_key
        self.model = model or "openai/gpt-4o-mini"
        self.http_referer = http_referer
        self.app_title = app_title
        self.timeout_seconds = timeout_seconds

    def suggest(
        self,
        source_schema: SchemaNode,
        target_schema: SchemaNode,
        domain_context: str,
    ) -> list[MappingSuggestion]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.http_referer:
            headers["HTTP-Referer"] = self.http_referer
        if self.app_title:
            headers["X-Title"] = self.app_title

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You suggest field mappings for logistics data integrations. "
                        "Return only JSON with a top-level suggestions array."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "domain_context": domain_context,
                            "source_schema": source_schema.model_dump(by_alias=True),
                            "target_schema": target_schema.model_dump(by_alias=True),
                            "required_shape": {
                                "suggestions": [
                                    {
                                        "id": "ai_001",
                                        "type": "field",
                                        "source_path": "$.source.path",
                                        "target_path": "$.target.path",
                                        "required": True,
                                        "confidence": 0.85,
                                        "jsonata": "source.path",
                                        "explanation": "short explanation",
                                    }
                                ]
                            },
                        }
                    ),
                },
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    OPENROUTER_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OpenRouterSuggestionError(f"OpenRouter request failed: {exc}") from exc

        return self._parse_suggestions(response.json())

    def _parse_suggestions(self, response_payload: dict[str, Any]) -> list[MappingSuggestion]:
        try:
            content = response_payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise OpenRouterSuggestionError(
                "OpenRouter response did not include message content."
            ) from exc

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise OpenRouterSuggestionError(
                "OpenRouter response content was not valid JSON."
            ) from exc

        suggestions_payload = parsed.get("suggestions")
        if not isinstance(suggestions_payload, list):
            raise OpenRouterSuggestionError("OpenRouter JSON did not include a suggestions array.")

        normalized: list[dict[str, Any]] = []
        for index, suggestion in enumerate(suggestions_payload, start=1):
            if not isinstance(suggestion, dict):
                continue
            normalized.append(
                {
                    **suggestion,
                    "id": suggestion.get("id") or f"ai_{index:03d}",
                    "source": SuggestionSource.openrouter,
                }
            )

        try:
            return TypeAdapter(list[MappingSuggestion]).validate_python(normalized)
        except ValidationError as exc:
            raise OpenRouterSuggestionError("OpenRouter suggestions failed validation.") from exc
