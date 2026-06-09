from collections.abc import Mapping, Sequence
from typing import Any

from app.api.models import JsonValue, SchemaNode, SchemaType


def infer_schema(data: JsonValue, path: str = "$") -> SchemaNode:
    if isinstance(data, Mapping):
        return SchemaNode(
            type="object",
            path=path,
            fields={
                str(key): infer_schema(value, _child_path(path, str(key)))
                for key, value in data.items()
            },
        )

    if isinstance(data, list):
        return SchemaNode(type="array", path=path, items=_infer_array_items(data, path))

    return SchemaNode(type=_primitive_type(data), path=path, examples=_example_values(data))


def _infer_array_items(values: Sequence[Any], path: str) -> SchemaNode:
    item_path = f"{path}[*]"
    if not values:
        return SchemaNode(type="mixed", path=item_path)

    inferred = [infer_schema(value, item_path) for value in values]
    first = inferred[0]

    if all(node.type == first.type for node in inferred):
        if first.type == "object":
            return _merge_object_nodes(inferred, item_path)
        if first.type == "array":
            return _merge_array_nodes(inferred, item_path)
        examples: list[JsonValue] = []
        for node in inferred:
            examples.extend(node.examples)
        return SchemaNode(type=first.type, path=item_path, examples=_dedupe_examples(examples))

    return SchemaNode(type="mixed", path=item_path)


def _merge_object_nodes(nodes: list[SchemaNode], path: str) -> SchemaNode:
    all_keys: set[str] = set()
    for node in nodes:
        all_keys.update((node.fields or {}).keys())

    fields: dict[str, SchemaNode] = {}
    for key in sorted(all_keys):
        present_nodes = [node.fields[key] for node in nodes if node.fields and key in node.fields]
        merged = present_nodes[0] if len(present_nodes) == 1 else _merge_nodes(present_nodes)
        fields[key] = merged.model_copy(update={"required": len(present_nodes) == len(nodes)})

    return SchemaNode(type="object", path=path, fields=fields)


def _merge_array_nodes(nodes: list[SchemaNode], path: str) -> SchemaNode:
    item_nodes = [node.items for node in nodes if node.items is not None]
    if not item_nodes:
        return SchemaNode(
            type="array",
            path=path,
            items=SchemaNode(type="mixed", path=f"{path}[*]"),
        )
    return SchemaNode(type="array", path=path, items=_merge_nodes(item_nodes))


def _merge_nodes(nodes: list[SchemaNode]) -> SchemaNode:
    first = nodes[0]
    if not all(node.type == first.type for node in nodes):
        return SchemaNode(type="mixed", path=first.path)
    if first.type == "object":
        return _merge_object_nodes(nodes, first.path)
    if first.type == "array":
        return _merge_array_nodes(nodes, first.path)

    examples: list[JsonValue] = []
    for node in nodes:
        examples.extend(node.examples)
    return SchemaNode(type=first.type, path=first.path, examples=_dedupe_examples(examples))


def _child_path(parent_path: str, key: str) -> str:
    return f"{parent_path}.{key}" if parent_path != "$" else f"$.{key}"


def _primitive_type(value: Any) -> SchemaType:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    return "string"


def _example_values(value: Any) -> list[JsonValue]:
    return [value] if value is not None else []


def _dedupe_examples(values: list[JsonValue]) -> list[JsonValue]:
    deduped: list[JsonValue] = []
    for value in values:
        if value not in deduped:
            deduped.append(value)
        if len(deduped) == 3:
            break
    return deduped
