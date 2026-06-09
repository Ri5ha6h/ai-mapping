from typing import Protocol

from app.api.models import MappingSuggestion, SchemaNode


class AiSuggester(Protocol):
    def suggest(
        self,
        source_schema: SchemaNode,
        target_schema: SchemaNode,
        domain_context: str,
    ) -> list[MappingSuggestion]:
        ...
