import re
from typing import Any

MISSING = object()
WILDCARD = "*"


def get_path(data: Any, path: str) -> Any:
    return _get_tokens(data, _parse_path(path))


def _get_tokens(current: Any, tokens: list[str | int]) -> Any:
    if not tokens:
        return current

    token, *remaining = tokens
    if token == WILDCARD:
        if not isinstance(current, list):
            return MISSING
        values = [_get_tokens(item, remaining) for item in current]
        return [value for value in values if value is not MISSING]

    if isinstance(token, int):
        if not isinstance(current, list) or token >= len(current):
            return MISSING
        return _get_tokens(current[token], remaining)

    if not isinstance(current, dict) or token not in current:
        return MISSING
    return _get_tokens(current[token], remaining)


def set_path(data: dict[str, Any], path: str, value: Any) -> None:
    tokens = _parse_path(path)
    if not tokens:
        raise ValueError("Cannot set root path.")

    current: Any = data
    for index, token in enumerate(tokens[:-1]):
        next_token = tokens[index + 1]
        if isinstance(token, int):
            raise ValueError(
                f"Array assignment is only supported at the final path segment: {path}"
            )

        if token not in current or not isinstance(current[token], dict | list):
            current[token] = [] if isinstance(next_token, int) else {}
        current = current[token]

    final = tokens[-1]
    if isinstance(final, int):
        if not isinstance(current, list):
            raise ValueError(f"Expected list before array index in path: {path}")
        while len(current) <= final:
            current.append(None)
        current[final] = value
    else:
        if not isinstance(current, dict):
            raise ValueError(f"Expected object before field in path: {path}")
        current[final] = value


def relative_item_path(path: str) -> str:
    return path if path.startswith("$.") else f"$.{path.lstrip('.')}"


def _parse_path(path: str) -> list[str | int]:
    if path == "$":
        return []
    if not path.startswith("$."):
        raise ValueError(f"Path must start with '$.': {path}")

    tokens: list[str | int] = []
    for part in path[2:].split("."):
        if not part:
            continue
        match = re.fullmatch(r"([^\[]+)(?:\[(\d+|\*)])?", part)
        if not match:
            raise ValueError(f"Unsupported path segment: {part}")
        tokens.append(match.group(1))
        if match.group(2) is not None:
            tokens.append(WILDCARD if match.group(2) == WILDCARD else int(match.group(2)))
    return tokens
