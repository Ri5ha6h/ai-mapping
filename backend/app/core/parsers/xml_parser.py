from typing import Any
from xml.etree.ElementTree import Element

from defusedxml import ElementTree

from app.core.parsers.errors import ParseError


def parse_xml(content: str) -> dict[str, Any]:
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as exc:
        raise ParseError("Invalid XML input.", detail=str(exc)) from exc

    return {_strip_namespace(root.tag): _element_to_value(root)}


def _element_to_value(element: Element) -> Any:
    children = list(element)
    attributes = {_strip_namespace(key): value for key, value in element.attrib.items()}
    text = (element.text or "").strip()

    if not children:
        if attributes:
            value: dict[str, Any] = {"@attributes": attributes}
            if text:
                value["#text"] = text
            return value
        return text

    grouped: dict[str, Any] = {}
    for child in children:
        key = _strip_namespace(child.tag)
        child_value = _element_to_value(child)
        if key in grouped:
            if not isinstance(grouped[key], list):
                grouped[key] = [grouped[key]]
            grouped[key].append(child_value)
        else:
            grouped[key] = child_value

    if attributes:
        grouped["@attributes"] = attributes
    if text:
        grouped["#text"] = text
    return grouped


def _strip_namespace(tag: str) -> str:
    return tag.rsplit("}", maxsplit=1)[-1] if "}" in tag else tag
