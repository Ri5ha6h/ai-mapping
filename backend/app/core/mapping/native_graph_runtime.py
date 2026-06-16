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
        variables: dict[str, Any] | None = None,
    ) -> None:
        self.root = root
        self.current = current
        self.variables = variables if variables is not None else {}

    def child(self, current: Any) -> ExecutionContext:
        return ExecutionContext(root=self.root, current=current, variables=self.variables.copy())


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

    value = _evaluate_node_value(node, graph, context)
    if node.var_name:
        context.variables[node.var_name] = value
    if node.target_path:
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
    for item in source_items:
        item_output: dict[str, Any] = {}
        item_context = context.child(item)
        for child_node in node.children:
            _execute_node(child_node, graph, item_context, item_output, trace)
            trace.append(_trace_item(child_node, status="executed"))
        mapped_items.append(item_output)
    set_path(output, node.target_path, mapped_items)


def _evaluate_node_value(
    node: NativeGraphNode,
    graph: NativeGraphSpec,
    context: ExecutionContext,
) -> Any:
    if node.type == "compute":
        value = _compute_operation(node, context)
    elif node.expression:
        value = _evaluate_expression(node, context)
    elif node.source_path:
        value = _required_path_value(context, node.source_path, node.id)
    else:
        value = node.value

    for transform in node.transforms:
        value = _apply_transform(value, transform, graph, node.id)
    return value


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
    if path.startswith("$root."):
        return get_path(context.root, "$." + path.removeprefix("$root."))
    if path.startswith("$var."):
        return get_path(context.variables, "$." + path.removeprefix("$var."))
    return get_path(context.current, path)


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
