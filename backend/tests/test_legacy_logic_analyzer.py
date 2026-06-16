from pathlib import Path

from app.core.mapping.legacy_logic_analyzer import analyze_legacy_logic_file


def test_analyzer_reports_legacy_json2json_capabilities() -> None:
    report = analyze_legacy_logic_file(
        Path(__file__).resolve().parents[2] / "samples" / "json2json" / "logicjson2json.json"
    )

    assert report["sourceInputType"] == "JSON"
    assert report["targetInputType"] == "JSON"
    assert "computed_nodes" in report["required_capabilities"]
    assert "scoped_loops" in report["required_capabilities"]
    assert report["counts"]["classes"] == 2


def test_analyzer_reports_legacy_xml2json_capabilities() -> None:
    report = analyze_legacy_logic_file(
        Path(__file__).resolve().parents[2] / "samples" / "xml2json" / "logicxml2json.json"
    )

    assert report["sourceInputType"] == "XML"
    assert report["targetInputType"] == "JSON"
    assert "lookup_tables" in report["required_capabilities"]
    assert "helper_functions" in report["required_capabilities"]
    assert "global_variables" in report["required_capabilities"]
