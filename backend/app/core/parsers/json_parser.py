import json
from typing import Any

from app.core.parsers.errors import ParseError


def parse_json(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ParseError("Invalid JSON input.", detail=str(exc)) from exc

