from typing import Any

from app.api.models import OutputDiffItem


def diff_values(expected: Any, actual: Any) -> list[OutputDiffItem]:
    diffs: list[OutputDiffItem] = []
    _diff_node("$", expected, actual, diffs)
    return diffs


def _diff_node(path: str, expected: Any, actual: Any, diffs: list[OutputDiffItem]) -> None:
    if isinstance(expected, dict) and isinstance(actual, dict):
        expected_keys = set(expected)
        actual_keys = set(actual)
        for key in sorted(expected_keys - actual_keys):
            diffs.append(
                OutputDiffItem(path=f"{path}.{key}", kind="missing", expected=expected[key])
            )
        for key in sorted(actual_keys - expected_keys):
            diffs.append(OutputDiffItem(path=f"{path}.{key}", kind="extra", actual=actual[key]))
        for key in sorted(expected_keys & actual_keys):
            _diff_node(f"{path}.{key}", expected[key], actual[key], diffs)
        return

    if isinstance(expected, list) and isinstance(actual, list):
        shared = min(len(expected), len(actual))
        for index in range(shared):
            _diff_node(f"{path}[{index}]", expected[index], actual[index], diffs)
        for index in range(shared, len(expected)):
            diffs.append(
                OutputDiffItem(path=f"{path}[{index}]", kind="missing", expected=expected[index])
            )
        for index in range(shared, len(actual)):
            diffs.append(
                OutputDiffItem(path=f"{path}[{index}]", kind="extra", actual=actual[index])
            )
        return

    if expected != actual:
        diffs.append(
            OutputDiffItem(path=path, kind="changed", expected=expected, actual=actual)
        )
