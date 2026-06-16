from typing import Any

from app.api.models import NativeGraphNode, NativeGraphSpec, ValidationErrorItem
from app.core.mapping.path_utils import MISSING, get_path

ALLOWED_NODE_TYPES = {
    "assign",
    "loop",
    "compute",
    "template",
    "object",
    "array",
    "map",
    "filter",
    "reduce",
    "conditional",
    "lookup",
    "switch",
    "append",
    "merge",
    "group_by",
    "sort",
}
ALLOWED_COMPUTE_OPERATIONS = {"hapag_stops", "hapag_events", "otm_booking_request"}
ALLOWED_TRANSFORMS = {
    "default",
    "first_token",
    "regex_replace",
    "date_format",
    "lookup",
    "split",
    "join",
    "pick",
    "trim",
    "upper",
    "lower",
    "to_number",
    "multiply",
    "divide",
    "round",
    "empty_to_null",
    "suppress_empty",
    "country_iso3_to_iso2",
}


def validate_native_graph(
    *,
    source_data: Any | None,
    graph: NativeGraphSpec,
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []
    seen_ids: set[str] = set()
    errors.extend(_validate_nodes(graph.nodes, graph, seen_ids=seen_ids, source_data=source_data))
    return errors


def _validate_nodes(
    nodes: list[NativeGraphNode],
    graph: NativeGraphSpec,
    *,
    seen_ids: set[str],
    source_data: Any | None,
) -> list[ValidationErrorItem]:
    errors: list[ValidationErrorItem] = []

    for node in nodes:
        if node.id in seen_ids:
            errors.append(
                ValidationErrorItem(
                    code="duplicate_native_graph_node_id",
                    message=f"Native graph node id {node.id} is duplicated.",
                    rule_id=node.id,
                )
            )
        seen_ids.add(node.id)

        if node.type not in ALLOWED_NODE_TYPES:
            errors.append(
                ValidationErrorItem(
                    code="invalid_native_graph_node_type",
                    message=f"Native graph node {node.id} has unsupported type {node.type}.",
                    rule_id=node.id,
                )
            )

        if node.type in {
            "assign",
            "compute",
            "template",
            "object",
            "array",
            "map",
            "filter",
            "reduce",
            "conditional",
            "lookup",
            "switch",
            "merge",
            "group_by",
            "sort",
        } and not node.target_path and not node.var_name:
            errors.append(
                ValidationErrorItem(
                    code="native_graph_missing_destination",
                    message=f"Native graph node {node.id} must set target_path or var_name.",
                    rule_id=node.id,
                )
            )

        if node.type == "loop":
            if not node.source_path or not node.target_path:
                errors.append(
                    ValidationErrorItem(
                        code="invalid_native_graph_loop",
                        message=f"Loop node {node.id} must define source_path and target_path.",
                        rule_id=node.id,
                    )
                )
            elif source_data is not None and get_path(source_data, node.source_path) is MISSING:
                errors.append(
                    ValidationErrorItem(
                        code="missing_source_path",
                        path=node.source_path,
                        message=f"Source path {node.source_path} was not found.",
                        rule_id=node.id,
                    )
                )

        if node.type == "compute" and node.operation not in ALLOWED_COMPUTE_OPERATIONS:
            errors.append(
                ValidationErrorItem(
                    code="invalid_native_graph_operation",
                    message=f"Compute node {node.id} has unsupported operation {node.operation}.",
                    rule_id=node.id,
                )
            )

        if node.expression and node.type not in {"assign", "conditional"}:
            errors.append(
                ValidationErrorItem(
                    code="invalid_native_graph_expression",
                    message="JSONata expressions are only allowed on value assignment nodes.",
                    rule_id=node.id,
                )
            )

        if node.source_path and source_data is not None and node.type != "loop":
            root_path = node.source_path.removeprefix("$root.")
            path = f"$.{root_path}" if node.source_path.startswith("$root.") else node.source_path
            if path.startswith("$.") and get_path(source_data, path) is MISSING:
                errors.append(
                    ValidationErrorItem(
                        code="missing_source_path",
                        path=node.source_path,
                        message=f"Source path {node.source_path} was not found.",
                        rule_id=node.id,
                    )
                )

        for transform in node.transforms:
            if transform.type not in ALLOWED_TRANSFORMS:
                errors.append(
                    ValidationErrorItem(
                        code="invalid_native_graph_transform",
                        message=f"Node {node.id} has unsupported transform {transform.type}.",
                        rule_id=node.id,
                    )
                )
            if transform.type == "lookup" and transform.lookup_table not in graph.lookup_tables:
                errors.append(
                    ValidationErrorItem(
                        code="unknown_native_graph_lookup",
                        message=f"Lookup table {transform.lookup_table} was not found.",
                        rule_id=node.id,
                    )
                )

        lookup_table_name = node.lookup_table or node.operation
        if node.type == "lookup" and lookup_table_name not in graph.lookup_tables:
            errors.append(
                ValidationErrorItem(
                    code="unknown_native_graph_lookup",
                    message=f"Lookup table {lookup_table_name} was not found.",
                    rule_id=node.id,
                )
            )

        errors.extend(
            _validate_nodes(
                node.children,
                graph,
                seen_ids=seen_ids,
                source_data=None,
            )
        )

    return errors
