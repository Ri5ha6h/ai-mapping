import json
from pathlib import Path
from typing import Any


def analyze_legacy_logic_file(path: Path) -> dict[str, Any]:
    logic = json.loads(path.read_text())
    target_nodes = list(_walk(logic.get("targetTreeNode", {})))
    local_context = logic.get("localContext", {})

    calc_nodes = [
        node
        for node in target_nodes
        if isinstance(node.get("name"), str) and node["name"].startswith("CALC:")
    ]
    reference_nodes = [node for node in target_nodes if node.get("references")]
    loop_nodes = [
        node
        for node in target_nodes
        if any(key in node for key in ("loopIterator", "loopReference", "looper"))
    ]
    condition_nodes = [
        node
        for node in target_nodes
        if any(key in node for key in ("condition", "loopConditions", "nodeCondition"))
    ]

    capabilities = set()
    if calc_nodes:
        capabilities.add("computed_nodes")
    if reference_nodes:
        capabilities.add("source_references")
    if loop_nodes:
        capabilities.add("scoped_loops")
    if condition_nodes:
        capabilities.add("conditional_nodes")
    if local_context.get("lookupTables"):
        capabilities.add("lookup_tables")
    if local_context.get("functions"):
        capabilities.add("helper_functions")
    if local_context.get("globalVariables"):
        capabilities.add("global_variables")
    if local_context.get("classes"):
        capabilities.add("local_classes")

    return {
        "name": logic.get("name", path.stem),
        "sourceInputType": logic.get("sourceInputType"),
        "targetInputType": logic.get("targetInputType"),
        "modelVersion": logic.get("modelVersion"),
        "counts": {
            "target_nodes": len(target_nodes),
            "calc_nodes": len(calc_nodes),
            "references": len(reference_nodes),
            "loop_nodes": len(loop_nodes),
            "condition_nodes": len(condition_nodes),
            "global_variables": len(local_context.get("globalVariables", [])),
            "functions": len(local_context.get("functions", [])),
            "lookup_tables": len(local_context.get("lookupTables", [])),
            "classes": len(local_context.get("classes", [])),
        },
        "required_capabilities": sorted(capabilities),
    }


def _walk(node: Any) -> list[dict[str, Any]]:
    if isinstance(node, list):
        return [item for child in node for item in _walk(child)]
    if not isinstance(node, dict):
        return []

    children = node.get("children", [])
    return [node, *[item for child in children for item in _walk(child)]]
