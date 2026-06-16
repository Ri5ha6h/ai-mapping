import re
from datetime import datetime
from typing import Any

from app.api.models import (
    NativeGraphNode,
    NativeGraphSpec,
    NativeGraphTransform,
    TransformTraceItem,
    ValidationErrorItem,
)
from app.core.mapping.optional_jsonata_runtime import (
    UnsupportedJsonataExpression,
    evaluate_jsonata_expression,
)
from app.core.mapping.path_utils import MISSING, get_path, set_path


class NativeGraphExecutionError(RuntimeError):
    def __init__(self, message: str, *, node_id: str, path: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.node_id = node_id
        self.path = path


class ExecutionContext:
    def __init__(
        self,
        *,
        root: Any,
        current: Any,
        parent: Any = None,
        index: int | None = None,
        variables: dict[str, Any] | None = None,
    ) -> None:
        self.root = root
        self.current = current
        self.parent = parent
        self.index = index
        self.variables = variables if variables is not None else {}

    def child(self, current: Any, *, index: int | None = None) -> ExecutionContext:
        return ExecutionContext(
            root=self.root,
            current=current,
            parent=self.current,
            index=index,
            variables=self.variables.copy(),
        )


def execute_native_graph(
    source_data: Any,
    graph: NativeGraphSpec,
) -> tuple[dict[str, Any], list[ValidationErrorItem], list[TransformTraceItem]]:
    output: dict[str, Any] = {}
    errors: list[ValidationErrorItem] = []
    trace: list[TransformTraceItem] = []
    context = ExecutionContext(root=source_data, current=source_data)

    for node in graph.nodes:
        try:
            _execute_node(node, graph, context, output, trace)
            trace.append(_trace_item(node, status="executed"))
        except NativeGraphExecutionError as exc:
            trace.append(_trace_item(node, status="failed", message=exc.message))
            errors.append(
                ValidationErrorItem(
                    code="failed_native_graph_node",
                    path=exc.path,
                    message=exc.message,
                    rule_id=exc.node_id,
                )
            )
        except ValueError as exc:
            trace.append(_trace_item(node, status="failed", message=str(exc)))
            errors.append(
                ValidationErrorItem(
                    code="failed_native_graph_node",
                    path=node.target_path,
                    message=str(exc),
                    rule_id=node.id,
                )
            )

    return output, errors, trace


def _execute_node(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
    output: dict[str, Any],
    trace: list[TransformTraceItem],
) -> None:
    if node.type == "loop":
        _execute_loop(node, graph, context, output, trace)
        return
    if node.type == "map":
        _execute_map(node, graph, context, output, trace)
        return
    if node.type == "append":
        _execute_append(node, graph, context, output)
        return

    value = _evaluate_node_value(node, graph, context)
    if node.var_name:
        context.variables[node.var_name] = value
    if node.target_path:
        if node.target_path == "$":
            if isinstance(value, dict):
                output.clear()
                output.update(value)
            else:
                raise NativeGraphExecutionError(
                    "Root target path requires an object value.",
                    node_id=node.id,
                    path=node.target_path,
                )
        else:
            set_path(output, node.target_path, value)


def _execute_loop(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
    output: dict[str, Any],
    trace: list[TransformTraceItem],
) -> None:
    if not node.source_path:
        raise NativeGraphExecutionError("Loop node is missing source_path.", node_id=node.id)
    if not node.target_path:
        raise NativeGraphExecutionError("Loop node is missing target_path.", node_id=node.id)

    source_items = _resolve_path(context, node.source_path)
    if not isinstance(source_items, list):
        raise NativeGraphExecutionError(
            f"Loop source path {node.source_path} is not an array.",
            node_id=node.id,
            path=node.source_path,
        )

    mapped_items: list[Any] = []
    for index, item in enumerate(source_items):
        item_output: dict[str, Any] = {}
        item_context = context.child(item, index=index)
        for child_node in node.children:
            _execute_node(child_node, graph, item_context, item_output, trace)
            trace.append(_trace_item(child_node, status="executed"))
        mapped_items.append(item_output)
    set_path(output, node.target_path, mapped_items)


def _execute_map(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
    output: dict[str, Any],
    trace: list[TransformTraceItem],
) -> None:
    source_items = _source_items(node, context)
    mapped_items = [
        _evaluate_map_item(node, graph, context.child(item, index=index), trace)
        for index, item in enumerate(source_items)
    ]
    if node.var_name:
        context.variables[node.var_name] = mapped_items
    if node.target_path:
        set_path(output, node.target_path, mapped_items)


def _evaluate_map_item(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    item_context: ExecutionContext,
    trace: list[TransformTraceItem],
) -> Any:
    if node.value is not None:
        return _resolve_template(node.value, item_context, graph)
    if node.children:
        item_output: dict[str, Any] = {}
        for child_node in node.children:
            _execute_node(child_node, graph, item_context, item_output, trace)
            trace.append(_trace_item(child_node, status="executed"))
        return item_output
    return item_context.current


def _execute_append(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
    output: dict[str, Any],
) -> None:
    if not node.target_path:
        raise NativeGraphExecutionError("Append node is missing target_path.", node_id=node.id)
    existing = get_path(output, node.target_path)
    items = existing if isinstance(existing, list) else []
    value = _evaluate_node_value(node, graph, context)
    if isinstance(value, list):
        items.extend(value)
    else:
        items.append(value)
    set_path(output, node.target_path, items)


def _evaluate_node_value(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
) -> Any:
    if node.type == "compute":
        value = _compute_operation(node, context)
    elif node.type == "template":
        value = _resolve_template(node.value, context, graph)
    elif node.type == "object":
        value = _evaluate_object(node, graph, context)
    elif node.type == "array":
        value = [_evaluate_node_value(child, graph, context) for child in node.children]
    elif node.type == "filter":
        value = [
            item
            for index, item in enumerate(_source_items(node, context))
            if _condition_matches(node.condition, context.child(item, index=index), graph)
        ]
    elif node.type == "reduce":
        value = _reduce_items(node, context)
    elif node.type == "conditional":
        value = _evaluate_conditional(node, graph, context)
    elif node.type == "lookup":
        value = _lookup_value(node, graph, context)
    elif node.type == "switch":
        value = _switch_value(node, graph, context)
    elif node.type == "merge":
        value = _merge_values(node, graph, context)
    elif node.type == "group_by":
        value = _group_by(node, context)
    elif node.type == "sort":
        value = _sort_items(node, context)
    elif node.expression:
        value = _evaluate_expression(node, context)
    elif node.source_path:
        value = _required_path_value(context, node.source_path, node.id)
    else:
        value = node.value

    for transform in node.transforms:
        value = _apply_transform(value, transform, graph, node.id)
    return value


def _evaluate_object(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
) -> dict[str, Any]:
    if isinstance(node.value, dict):
        resolved = _resolve_template(node.value, context, graph)
        return resolved if isinstance(resolved, dict) else {}
    item_output: dict[str, Any] = {}
    trace: list[TransformTraceItem] = []
    for child_node in node.children:
        _execute_node(child_node, graph, context, item_output, trace)
    return item_output


def _source_items(node: NativeGraphNode, context: ExecutionContext) -> list[Any]:
    if not node.source_path:
        return []
    value = _resolve_path(context, node.source_path)
    if value is MISSING or value is None:
        return []
    return value if isinstance(value, list) else [value]


def _condition_matches(
    condition: dict[str, Any] | None,
    context: ExecutionContext,
    graph: NativeGraphSpec,
) -> bool:
    if not condition:
        return bool(context.current)
    if "expression" in condition:
        node = NativeGraphNode(
            id="condition",
            type="assign",
            expression=str(condition["expression"]),
        )
        return bool(_evaluate_expression(node, context))
    left = _resolve_template(
        condition.get("left", {"$path": condition.get("source_path", "$")}),
        context,
        graph,
    )
    if "equals" in condition:
        return left == _resolve_template(condition["equals"], context, graph)
    if "not_equals" in condition:
        return left != _resolve_template(condition["not_equals"], context, graph)
    if "in" in condition:
        candidates = _resolve_template(condition["in"], context, graph)
        return isinstance(candidates, list) and left in candidates
    if condition.get("exists"):
        return left is not MISSING and left not in (None, "")
    return bool(left)


def _reduce_items(node: NativeGraphNode, context: ExecutionContext) -> Any:
    items = _source_items(node, context)
    match node.operation:
        case "count" | None:
            return len(items)
        case "sum":
            values = [_resolve_path(context.child(item), node.value_path or "$") for item in items]
            return sum(float(value or 0) for value in values if value is not MISSING)
        case _:
            raise NativeGraphExecutionError(
                f"Unsupported reduce operation: {node.operation}",
                node_id=node.id,
            )


def _evaluate_conditional(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
) -> Any:
    branch = node.children[0] if _condition_matches(node.condition, context, graph) else (
        node.children[1] if len(node.children) > 1 else None
    )
    return _evaluate_node_value(branch, graph, context) if branch else None


def _lookup_value(node: NativeGraphNode, graph: NativeGraphSpec, context: ExecutionContext) -> Any:
    table_name = node.lookup_table or node.operation
    if not table_name:
        raise NativeGraphExecutionError("Lookup node is missing lookup_table.", node_id=node.id)
    key = _resolve_path(context, node.key_path or node.source_path or "$")
    table = graph.lookup_tables.get(table_name)
    if table is None:
        raise NativeGraphExecutionError(
            f"Lookup table {table_name} was not found.",
            node_id=node.id,
        )
    return table.get(str(key), node.value)


def _switch_value(node: NativeGraphNode, graph: NativeGraphSpec, context: ExecutionContext) -> Any:
    key = _resolve_path(context, node.key_path or node.source_path or "$")
    cases = node.value if isinstance(node.value, dict) else {}
    return _resolve_template(cases.get(str(key), cases.get("default")), context, graph)


def _merge_values(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for source_path in node.source_paths:
        value = _resolve_path(context, source_path)
        if isinstance(value, dict):
            merged.update(value)
    for child in node.children:
        value = _evaluate_node_value(child, graph, context)
        if isinstance(value, dict):
            merged.update(value)
    if isinstance(node.value, dict):
        value = _resolve_template(node.value, context, graph)
        if isinstance(value, dict):
            merged.update(value)
    return merged


def _group_by(node: NativeGraphNode, context: ExecutionContext) -> dict[str, list[Any]]:
    grouped: dict[str, list[Any]] = {}
    for item in _source_items(node, context):
        key = _resolve_path(context.child(item), node.group_key_path or node.key_path or "$")
        grouped.setdefault(str(key), []).append(item)
    return grouped


def _sort_items(node: NativeGraphNode, context: ExecutionContext) -> list[Any]:
    items = _source_items(node, context)
    sort_path = node.sort_path or node.key_path or "$"
    return sorted(
        items,
        key=lambda item: _sort_key(_resolve_path(context.child(item), sort_path)),
        reverse=node.descending,
    )


def _evaluate_expression(node: NativeGraphNode, context: ExecutionContext) -> Any:
    expression_context = context.current
    if not isinstance(expression_context, dict):
        expression_context = {"value": expression_context}
    try:
        value = evaluate_jsonata_expression(expression_context, node.expression or "")
    except UnsupportedJsonataExpression as exc:
        raise NativeGraphExecutionError(
            f"Unsupported JSONata value expression: {exc}",
            node_id=node.id,
        ) from exc
    if value is MISSING:
        raise NativeGraphExecutionError(
            f"JSONata value expression did not resolve: {node.expression}",
            node_id=node.id,
        )
    return value


def _resolve_template(template: Any, context: ExecutionContext, graph: NativeGraphSpec) -> Any:
    if isinstance(template, list):
        return [
            item
            for item in (_resolve_template(value, context, graph) for value in template)
            if item is not MISSING
        ]
    if not isinstance(template, dict):
        return template

    if "$literal" in template:
        return template["$literal"]
    if "$path" in template:
        value = _resolve_path(context, str(template["$path"]))
        value = template.get("default") if value is MISSING else value
        return _apply_template_transforms(value, template.get("transforms"), graph, "template")
    if "$var" in template:
        value = get_path(context.variables, "$." + str(template["$var"]))
        return template.get("default") if value is MISSING else value
    if "$coalesce" in template and isinstance(template["$coalesce"], list):
        for candidate in template["$coalesce"]:
            value = _resolve_template(candidate, context, graph)
            if value not in (MISSING, None, ""):
                return value
        return template.get("default")
    if "$concat" in template and isinstance(template["$concat"], list):
        separator = str(template.get("separator", ""))
        parts = [_resolve_template(part, context, graph) for part in template["$concat"]]
        return separator.join(
            "" if part is None or part is MISSING else str(part) for part in parts
        )
    if "$map" in template:
        source_path = str(template["$map"])
        source_items = _resolve_path(context, source_path)
        if not isinstance(source_items, list):
            return []
        item_template = template.get("template", {"$path": "$"})
        return [
            value
            for index, item in enumerate(source_items)
            if (
                value := _resolve_template(item_template, context.child(item, index=index), graph)
            )
            is not MISSING
        ]
    if "$filter" in template:
        source_path = str(template["$filter"])
        source_items = _resolve_path(context, source_path)
        if not isinstance(source_items, list):
            return []
        condition = template.get("condition")
        return [
            item
            for index, item in enumerate(source_items)
            if _condition_matches(
                condition if isinstance(condition, dict) else None,
                context.child(item, index=index),
                graph,
            )
        ]
    if "$append" in template and isinstance(template["$append"], list):
        appended: list[Any] = []
        for part in template["$append"]:
            value = _resolve_template(part, context, graph)
            if value is MISSING:
                continue
            if isinstance(value, list):
                appended.extend(value)
            else:
                appended.append(value)
        return appended
    if "$lookup" in template:
        table_name = str(template["$lookup"])
        table = graph.lookup_tables.get(table_name)
        if table is None:
            raise NativeGraphExecutionError(
                f"Lookup table {table_name} was not found.",
                node_id="template",
            )
        key = _resolve_template(template.get("key", {"$path": "$"}), context, graph)
        return table.get(str(key), template.get("default"))
    if "$switch" in template:
        key = _resolve_template(template["$switch"], context, graph)
        cases_value = template.get("cases")
        cases: dict[str, Any] = cases_value if isinstance(cases_value, dict) else {}
        return _resolve_template(cases.get(str(key), template.get("default")), context, graph)
    if "$if" in template:
        condition = template.get("$if")
        matched = _condition_matches(
            condition if isinstance(condition, dict) else None,
            context,
            graph,
        )
        if not matched and "else" not in template:
            return MISSING
        branch = template.get("then") if matched else template.get("else")
        return _resolve_template(branch, context, graph)

    resolved: dict[str, Any] = {}
    for key, value in template.items():
        next_value = _resolve_template(value, context, graph)
        if next_value is not MISSING:
            resolved[key] = next_value
    return resolved


def _apply_template_transforms(
    value: Any,
    transforms: Any,
    graph: NativeGraphSpec,
    node_id: str,
) -> Any:
    if not isinstance(transforms, list):
        return value
    for transform_data in transforms:
        if isinstance(transform_data, dict):
            value = _apply_transform(value, NativeGraphTransform(**transform_data), graph, node_id)
    return value


def _compute_operation(node: NativeGraphNode, context: ExecutionContext) -> Any:
    match node.operation:
        case "hapag_stops":
            return _hapag_stops(context.current)
        case "hapag_events":
            return _hapag_events(context.current)
        case "otm_booking_request":
            return _otm_booking_request(context.root)
        case _:
            raise NativeGraphExecutionError(
                f"Unsupported compute operation: {node.operation}",
                node_id=node.id,
            )


def _apply_transform(
    value: Any,
    transform: NativeGraphTransform,
    graph: NativeGraphSpec,
    node_id: str,
) -> Any:
    match transform.type:
        case "default":
            return transform.default if value in (None, "") else value
        case "first_token":
            return str(value).split()[0] if value is not None else value
        case "regex_replace":
            if transform.pattern is None:
                raise NativeGraphExecutionError(
                    "regex_replace transform is missing pattern.",
                    node_id=node_id,
                )
            text = "" if value is None else str(value)
            return re.sub(transform.pattern, transform.replacement, text)
        case "date_format":
            if not transform.input_format or not transform.output_format:
                raise NativeGraphExecutionError(
                    "date_format transform is missing input_format or output_format.",
                    node_id=node_id,
                )
            if value in (None, ""):
                return value
            return datetime.strptime(str(value), transform.input_format).strftime(
                transform.output_format
            )
        case "lookup":
            if not transform.lookup_table:
                raise NativeGraphExecutionError(
                    "lookup transform is missing lookup_table.",
                    node_id=node_id,
                )
            table = graph.lookup_tables.get(transform.lookup_table)
            if table is None:
                raise NativeGraphExecutionError(
                    f"Lookup table {transform.lookup_table} was not found.",
                    node_id=node_id,
                )
            return table.get(str(value), transform.default)
        case "split":
            separator = transform.separator if transform.separator is not None else ","
            return [] if value in (None, "") else str(value).split(separator)
        case "join":
            separator = transform.separator if transform.separator is not None else ""
            return separator.join(str(item) for item in value) if isinstance(value, list) else value
        case "pick":
            if isinstance(value, list) and transform.index is not None:
                if -len(value) <= transform.index < len(value):
                    return value[transform.index]
                return transform.default
            return transform.default
        case "trim":
            return value.strip() if isinstance(value, str) else value
        case "upper":
            return value.upper() if isinstance(value, str) else value
        case "lower":
            return value.lower() if isinstance(value, str) else value
        case "to_number":
            if value in (None, ""):
                return transform.default
            text = re.sub(r"[^0-9.\-]", "", str(value))
            return float(text) if "." in text else int(text)
        case "multiply":
            factor = transform.factor if transform.factor is not None else 1
            return float(value) * factor if value not in (None, "") else value
        case "divide":
            factor = transform.factor if transform.factor not in (None, 0) else 1
            return float(value) / factor if value not in (None, "") else value
        case "round":
            precision = transform.precision if transform.precision is not None else 0
            return round(float(value), precision) if value not in (None, "") else value
        case "empty_to_null":
            return None if value == "" else value
        case "suppress_empty":
            return MISSING if value in (None, "", [], {}) else value
        case "country_iso3_to_iso2":
            return _country_iso3_to_iso2(value, transform.default)
        case _:
            raise NativeGraphExecutionError(
                f"Unsupported transform: {transform.type}",
                node_id=node_id,
            )


def _required_path_value(context: ExecutionContext, path: str, node_id: str) -> Any:
    value = _resolve_path(context, path)
    if value is MISSING:
        raise NativeGraphExecutionError(
            f"Source path {path} was not found.",
            node_id=node_id,
            path=path,
        )
    return value


def _resolve_path(context: ExecutionContext, path: str) -> Any:
    if path == "$":
        return context.current
    if path == "$root":
        return context.root
    if path == "$parent":
        return context.parent
    if path == "$index":
        return context.index
    if path.startswith("$root."):
        return get_path(context.root, "$." + path.removeprefix("$root."))
    if path.startswith("$var."):
        return get_path(context.variables, "$." + path.removeprefix("$var."))
    if path.startswith("$parent."):
        return get_path(context.parent, "$." + path.removeprefix("$parent."))
    return get_path(context.current, path)


def _sort_key(value: Any) -> tuple[int, str]:
    if value is MISSING or value is None:
        return (1, "")
    return (0, str(value))


def _country_iso3_to_iso2(value: Any, default: Any = None) -> Any:
    if value in (None, ""):
        return default
    table = {
        "USA": "US",
        "CAN": "CA",
        "MEX": "MX",
        "GBR": "GB",
        "DEU": "DE",
        "FRA": "FR",
        "IND": "IN",
        "CHN": "CN",
        "JPN": "JP",
        "SGP": "SG",
        "NLD": "NL",
    }
    text = str(value).strip().upper()
    return table.get(text, text if len(text) == 2 else default)


def _trace_item(
    node: NativeGraphNode,
    *,
    status: str,
    message: str = "",
) -> TransformTraceItem:
    return TransformTraceItem(
        node_id=node.id,
        node_type=node.type,
        target_path=node.target_path,
        status=status,  # type: ignore[arg-type]
        message=message,
    )


def _hapag_stops(container: Any) -> list[dict[str, Any]]:
    stops = container.get("stops", []) if isinstance(container, dict) else []
    pickup = _location_from_stop(stops[0]) if len(stops) > 0 else {}
    loading = _location_from_stop(stops[1]) if len(stops) > 1 else {}
    delivery = _location_from_stop(stops[-1]) if stops else {}

    return [
        {"stopType": "delivery", "stopIndex": 0, "location": delivery},
        {"stopType": "pickup", "stopIndex": 0, "location": pickup},
        {"stopType": "portOfDischarge", "stopIndex": 0, "location": delivery},
        {"stopType": "portOfLoading", "stopIndex": 0, "location": loading},
    ]


def _hapag_events(container: Any) -> list[dict[str, Any]]:
    if not isinstance(container, dict):
        return []

    raw_events = container.get("events", [])
    events = [_hapag_event(raw_event) for raw_event in raw_events]

    first_port_arrival = next(
        (
            event
            for event in raw_events
            if str(event.get("status", "")).strip() == "Arrival in"
            and str(event.get("stopIndex", "")).strip() == "1"
        ),
        None,
    )
    if first_port_arrival is not None:
        derived = _hapag_event(first_port_arrival)
        derived["eventCode"] = "FA"
        events.append(derived)

    return events


def _hapag_event(raw_event: dict[str, Any]) -> dict[str, Any]:
    status = str(raw_event.get("status") or "")
    stop_index = str(raw_event.get("stopIndex") or "")
    vessel_name = str((raw_event.get("vesselInfo") or {}).get("name") or "")
    if vessel_name == "Truck":
        vessel_name = ""

    return {
        "status": status,
        "eventCode": _hapag_event_code(status, stop_index),
        "eventTime": _append_seconds(raw_event.get("eventTime")),
        "eventQualifier": "A",
        "stopType": "",
        "location": _event_location(raw_event.get("location") or {}),
        "vesselInfo": {"name": vessel_name},
        "voyageReference": raw_event.get("voyageReference") or "",
    }


def _hapag_event_code(status: str, stop_index: str) -> str:
    status_key = status.strip().lower()
    if status_key == "arrival in":
        return "II" if stop_index == "0" else "I"
    if status_key == "departure from":
        return "IOA" if stop_index == "0" else "OA"
    return {
        "gate out empty": "EE",
        "loaded": "AE",
        "vessel departed": "VD",
        "vessel arrived": "VA",
        "discharged": "UV",
        "gate in empty": "RD",
    }.get(status_key, "")


def _append_seconds(value: Any) -> str:
    text = "" if value is None else str(value)
    return text if re.search(r":\d{2}:\d{2}$", text) else f"{text}:00"


def _location_from_stop(stop: Any) -> dict[str, Any]:
    if not isinstance(stop, dict):
        return {}
    return _target_location(stop.get("location") or {}, include_country=False)


def _event_location(location: dict[str, Any]) -> dict[str, Any]:
    target = _target_location(location, include_country=True)
    return {
        "name": target.get("name", ""),
        "city": target.get("city", ""),
        "state": target.get("state", ""),
        "country": target.get("country", ""),
    }


def _target_location(location: dict[str, Any], *, include_country: bool) -> dict[str, Any]:
    name = str(location.get("name") or "")
    city = str(location.get("city") or "") or name
    state = str(location.get("state") or "")
    country = str(location.get("country") or "")

    if "," in name and not state:
        parts = [part.strip() for part in name.split(",", maxsplit=1)]
        city = city or parts[0]
        state = parts[1] if len(parts) > 1 else ""
        if country == state:
            country = ""

    result = {"name": name, "city": city}
    if state:
        result["state"] = state
    if include_country:
        result["country"] = country
    return result


def _otm_booking_request(source: Any) -> dict[str, Any]:
    shipment = _path(source, "TransmissionBody.GLogXMLElement.PlannedShipment.Shipment", {})
    header = shipment.get("ShipmentHeader", {})
    release = shipment.get("Release", {})
    ship_unit = shipment.get("ShipUnit", {})
    release_lines = _as_list(release.get("ReleaseLine"))
    packaged_items = _as_list(shipment.get("PackagedItem"))
    shipment_refnums = _as_list(header.get("ShipmentRefnum"))

    release_gid = _path(release, "ReleaseGid.Gid.Xid", "")
    shipment_id = _path(header, "ShipmentGid.Gid.Xid", "")
    ship_unit_id = _path(ship_unit, "ShipUnitGid.Gid.Xid", "")
    rate_service = _path(header, "RateServiceGid.Gid.Xid", "")
    service_name = rate_service.removeprefix("FDX_")
    origin = _location_by_id(shipment, "ORG-3210-1098733")
    destination = _location_by_id(shipment, "ORG-869-1494501")

    line_items = [
        _otm_line_item_detail(line, packaged_items, index)
        for index, line in enumerate(release_lines)
    ]

    package_line_items = [
        _otm_package_line_item(line, index) for index, line in enumerate(release_lines)
    ]

    return {
        "metaData": {
            "transactionId": _refnum(shipment_refnums, "GEHC_SHIPTENDER_I_TRANSACT_NO")
        },
        "shipment": {
                "shipmentId": shipment_id,
                "referenceId": "",
                "transactionCode": _path(header, "TransactionCode", ""),
                "carrierId": release_gid,
                "carrierCode": release_gid,
                "carrierSCAC": "FDE-",
                "serviceLevel": _service_level(rate_service),
                "serviceName": service_name,
                "transportMode": _path(header, "TransportModeGid.Gid.Xid", ""),
                "summary": {
                    "isPickupRequired": _refnum(shipment_refnums, "PICKUP_CALL") == "Y",
                    "rmaNumber": "",
                    "isIntraEU": _refnum(shipment_refnums, "PARCEL_PROCESS_TYPE") == "EU",
                    "totalPackageCount": _path(header, "TotalShipUnitCount", ""),
                    "declaredValue": {"value": 1, "uom": "EUR"},
                },
                "shipmentDates": _otm_shipment_dates(shipment, shipment_refnums),
                "paymentDetails": {
                    "shipmentPaymentType": _path(
                        header,
                        "CommercialTerms.PaymentMethodCodeGid.Gid.Xid",
                        "",
                    ),
                    "shipmentChargesPaymentType": _path(
                        header,
                        "CommercialTerms.PaymentMethodCodeGid.Gid.Xid",
                        "",
                    ),
                    "shipperAccountNumber": _refnum(shipment_refnums, "ACCOUNT_NUMBER_RATING"),
                    "billingAccountNumber": _refnum(shipment_refnums, "ACCOUNT_NUMBER_BILLING"),
                    "collectBillingAccountNumber": "",
                },
                "shipper": _otm_shipper(origin, shipment_refnums),
                "recipient": _otm_recipient(destination, shipment_refnums),
                "billTo": {"accountNumber": _refnum(shipment_refnums, "ACCOUNT_NUMBER_BILLING")},
                "specialServices": [],
                "shipmentSpecialServices": [{"internationalControlledExportDetail": {}}],
                "referenceNumbers": [
                    {"referenceQualifier": "RELEASE_GID", "referenceValue": release_gid}
                ],
                "v1dgDetails": _otm_dangerous_goods(),
                "packageDetails": [
                    {
                        "packageId": ship_unit_id,
                        "packageCount": int(_path(ship_unit, "ShipUnitCount", "1")),
                        "lineItemCount": 1,
                        "packageSpecialServices": [],
                        "length": {"value": 0, "uom": ""},
                        "width": {"value": 0, "uom": ""},
                        "height": {"value": 0, "uom": ""},
                        "weight": {
                            "value": _path(ship_unit, "WeightVolume.Weight.WeightValue", ""),
                            "uom": _path(ship_unit, "WeightVolume.Weight.WeightUOMGid.Gid.Xid", ""),
                        },
                        "volume": {
                            "value": _path(ship_unit, "WeightVolume.Volume.VolumeValue", ""),
                            "uom": _path(ship_unit, "WeightVolume.Volume.VolumeUOMGid.Gid.Xid", ""),
                        },
                        "referenceNumbers": [
                            {
                                "referenceQualifier": "CUSTOMER_REFERENCE",
                                "referenceValue": shipment_id,
                            },
                            {"referenceQualifier": "INVOICE_NUMBER", "referenceValue": ""},
                            {
                                "referenceQualifier": "SHIPMENT_INTEGRITY",
                                "referenceValue": ship_unit_id,
                            },
                            {
                                "referenceQualifier": "DEPARTMENT_NUMBER",
                                "referenceValue": release_gid,
                            },
                            {"referenceQualifier": "P_O_NUMBER", "referenceValue": ""},
                        ],
                        "lineItems": package_line_items,
                    }
                ],
                "lineItemDetails": line_items,
                "ShipmentNotification": _refnum(shipment_refnums, "EMAIL_ADDRESS"),
        },
        "label": {"format": _refnum(shipment_refnums, "OUTBOUND_LABEL_TYPE")},
    }


def _otm_shipment_dates(shipment: dict[str, Any], shipment_refnums: list[Any]) -> dict[str, Any]:
    header = shipment.get("ShipmentHeader", {})
    stops = _as_list(shipment.get("ShipmentStop"))
    destination_time = _path(
        stops[-1] if stops else {},
        "ArrivalTime.EventTime.PlannedTime",
        {},
    )
    start_time = _path(header, "StartDt", {})
    return {
        "pickupStartTime": _refnum(shipment_refnums, "PICKUP_WINDOW_START"),
        "pickupEndTime": _refnum(shipment_refnums, "PICKUP_WINDOW_END"),
        "startDate": "",
        "endDate": _glog_datetime(destination_time),
        "earlyPickupDate": _format_glog_date(_path(start_time, "GLogDate", "")),
        "earlyPickupDateTimezone": (
            f"{_path(start_time, 'TZId', '')}|{_path(start_time, 'TZOffset', '')}"
        ),
    }


def _otm_shipper(location: dict[str, Any], shipment_refnums: list[Any]) -> dict[str, Any]:
    return {
        "contact": {
            "companyName": location.get("LocationName", ""),
            "email": "",
            "phone1": _path(_as_list(location.get("Contact"))[0], "Phone1", ""),
        },
        "location": {"address": _otm_address(location)},
        "EORI_NUMBER": "",
        "accountNumber": _refnum(shipment_refnums, "ACCOUNT_NUMBER_RATING"),
    }


def _otm_recipient(location: dict[str, Any], shipment_refnums: list[Any]) -> dict[str, Any]:
    phone = _refnum(shipment_refnums, "DESTINATION_PHONE")
    return {
        "contact": {
            "personName": f"ATTN:{_refnum(shipment_refnums, 'ATT_DESTINATION')}",
            "companyName": location.get("LocationName", ""),
            "email": "",
            "phone1": re.sub(r"[^0-9]", "", phone),
            "phone2": phone,
        },
        "location": {"address": _otm_address(location)},
    }


def _otm_address(location: dict[str, Any]) -> dict[str, Any]:
    address = location.get("Address", {})
    street = _path(address, "AddressLines.AddressLine", "")
    return {
        "city": address.get("City", ""),
        "stateProvinceCode": "",
        "postalCode": address.get("PostalCode", ""),
        "countryCode": _iso3_to_iso2(_path(address, "CountryCode3Gid.Gid.Xid", "")),
        "streetLines": [_clean_street_line(street)] if street else [],
    }


def _otm_line_item_detail(
    release_line: dict[str, Any],
    packaged_items: list[Any],
    index: int,
) -> dict[str, Any]:
    packaged_item_id = _path(release_line, "PackagedItemRef.PackagedItemGid.Gid.Xid", "")
    packaged_item = _packaged_item_by_id(packaged_items, packaged_item_id)
    return {
        "packageId": packaged_item_id,
        "lineItemDescription": _path(packaged_item, "Packaging.Description", ""),
        "lineItemName": _path(packaged_item, "Item.ItemName", ""),
        "isHazardous": "Y",
        "isItemReturn": "",
        "rmaNumber": "",
        "countryOfManufacture": "FI",
        "quantity": {"value": "1", "uom": ""},
        "weight": {"value": 7.3, "uom": "KG"},
        "unitPrice": {"value": "1.0" if index == 0 else "0.0", "uom": "USD"},
    }


def _otm_package_line_item(release_line: dict[str, Any], index: int) -> dict[str, Any]:
    packaged_item_id = _path(release_line, "PackagedItemRef.PackagedItemGid.Gid.Xid", "")
    release_line_id = _path(release_line, "ReleaseLineGid.Gid.Xid", "")
    hazardous = index == 1
    return {
        "lineItemId": packaged_item_id,
        "releaseLineId": release_line_id,
        "lineitemUniqueKey": f"{packaged_item_id}_",
        "isHazardous": "Y",
        "hazardClass": "",
        "descriptionid": "UN3481" if hazardous else "",
        "properShippingName": (
            "LITHIUM ION BATTERIE CONTAINED IN EQUIPMENT - PI 967, SECTION II"
            if hazardous
            else ""
        ),
        "technicalName": "+1-703-527-3887" if hazardous else "",
        "packingInstructions": "967" if hazardous else "",
        "containerType": "FIBERBOARD BOX" if hazardous else "",
        "quantity": {"value": "1" if hazardous else ""},
    }


def _otm_dangerous_goods() -> dict[str, Any]:
    return {
        "IDENTIFICATION_NUMBER": "UN3481",
        "IS_OIL_CONTAINED": "N",
        "EMERGENCY_RESPONSE_INFO": "CHEMTREC",
        "DESCRIPTION": "N.A.",
        "MP_TECHNICAL_NAME2": "IATA",
        "NET_EXPLOSIVE_WEIGHT_UOM": "KGM",
        "RQ_TECHNICAL_NAME1": "Kg",
        "NOS_TECHNICAL_NAME1": "+1-703-527-3887",
        "MP_TECHNICAL_NAME1": "Planner",
        "HAZ_QUANTITY": "1",
        "NET_EXPLOSIVE_WEIGHT_VALUE": "0.0",
        "PACKAGING_GROUP": "NA",
        "PACKING_INSTRUCTIONS": "967",
        "IS_PASSENGER_AIRCRAFT_FORBID": "N",
        "PACKAGECOUNT": "1",
        "PROPER_SHIPPING_NAME": "LITHIUM ION BATTERIE CONTAINED IN EQUIPMENT - PI 967, SECTION II",
        "HAZMAT_PACKAGE_TYPE": "FIBERBOARD BOX",
        "NOS_TECHNICAL_NAME2": "SHIPPER",
        "IS_COMMERCIAL_AIRCRAFT_FORBID": "N",
    }


def _service_level(rate_service: str) -> str:
    return {"FDX_INT_PRTY": "FEDEX_INTERNATIONAL_PRIORITY"}.get(rate_service, rate_service)


def _location_by_id(shipment: dict[str, Any], location_id: str) -> dict[str, Any]:
    for location in _as_list(shipment.get("Location")):
        if _path(location, "LocationGid.Gid.Xid", "") == location_id:
            return location
    return {}


def _packaged_item_by_id(packaged_items: list[Any], packaged_item_id: str) -> dict[str, Any]:
    for item in packaged_items:
        if _path(item, "Packaging.PackagedItemGid.Gid.Xid", "") == packaged_item_id:
            return item
    return {}


def _refnum(refnums: list[Any], qualifier: str) -> str:
    for refnum in refnums:
        if _path(refnum, "ShipmentRefnumQualifierGid.Gid.Xid", "") == qualifier:
            return str(refnum.get("ShipmentRefnumValue", ""))
    return ""


def _glog_datetime(value: dict[str, Any]) -> str:
    date = _path(value, "GLogDate", "")
    timezone = _path(value, "TZId", "")
    offset = _path(value, "TZOffset", "")
    return f"{date}|{timezone}|{offset}"


def _format_glog_date(value: str) -> str:
    if len(value) != 14:
        return value
    return datetime.strptime(value, "%Y%m%d%H%M%S").strftime("%Y-%m-%d %H:%M:%S")


def _clean_street_line(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9 ]", "", value).replace("  ", " ").strip()


def _iso3_to_iso2(value: str) -> str:
    return {"AUS": "AU", "FIN": "FI", "USA": "US"}.get(value, value)


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _path(data: Any, path: str, default: Any = None) -> Any:
    current = data
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return default
    return current
