from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring


def write_xml(data: Any, root_element: str = "Output") -> str:
    if isinstance(data, dict) and len(data) == 1:
        key, value = next(iter(data.items()))
        root = Element(_safe_tag(key))
        _append_value(root, value)
    else:
        root = Element(_safe_tag(root_element))
        _append_value(root, data)
    return tostring(root, encoding="unicode", short_empty_elements=False)


def _append_value(parent: Element, value: Any) -> None:
    if isinstance(value, dict):
        for key, child_value in value.items():
            if isinstance(child_value, list):
                for item in child_value:
                    child = SubElement(parent, _safe_tag(key))
                    _append_value(child, item)
            else:
                child = SubElement(parent, _safe_tag(key))
                _append_value(child, child_value)
        return

    if isinstance(value, list):
        for item in value:
            child = SubElement(parent, "Item")
            _append_value(child, item)
        return

    if value is not None:
        parent.text = str(value)


def _safe_tag(tag: str) -> str:
    cleaned = "".join(
        character if character.isalnum() or character in "_-" else "_"
        for character in tag
    )
    return cleaned or "Value"
