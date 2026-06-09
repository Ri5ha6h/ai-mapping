import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.storage.template_repository import TemplateRepository

SEED_TEMPLATE_IDS = {
    "example-field",
    "example-constant",
    "example-concat",
    "example-date-format",
    "example-condition",
    "example-loop",
    "example-super",
}


def test_seeded_templates_are_available_and_idempotent(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "templates.sqlite3"
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(db_path))

    first_response = client.get("/api/templates")
    second_response = client.get("/api/templates")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    templates = first_response.json()["templates"]
    template_ids = {template["template_id"] for template in templates}
    assert SEED_TEMPLATE_IDS.issubset(template_ids)

    for template in templates:
        if template["template_id"] in SEED_TEMPLATE_IDS:
            assert template["is_seeded"] is True
            assert template["versions"][0]["sample_source_content"]
            assert template["versions"][0]["sample_target_content"]

    with sqlite3.connect(db_path) as connection:
        seeded_template_count = connection.execute(
            "select count(*) from templates where is_seeded = 1"
        ).fetchone()[0]
        seeded_version_count = connection.execute(
            """
            select count(*)
            from template_versions
            where template_id in (
                select template_id from templates where is_seeded = 1
            )
            """
        ).fetchone()[0]

    assert seeded_template_count == len(SEED_TEMPLATE_IDS)
    assert seeded_version_count == len(SEED_TEMPLATE_IDS)


def test_seeded_templates_initialize_safely_under_concurrent_reads(tmp_path: Path) -> None:
    db_path = tmp_path / "templates.sqlite3"

    def list_seeded_ids() -> set[str]:
        repository = TemplateRepository(db_path)
        return {
            template.template_id
            for template in repository.list_templates()
            if template.is_seeded
        }

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: list_seeded_ids(), range(4)))

    assert all(result == SEED_TEMPLATE_IDS for result in results)

    with sqlite3.connect(db_path) as connection:
        seeded_template_count = connection.execute(
            "select count(*) from templates where is_seeded = 1"
        ).fetchone()[0]

    assert seeded_template_count == len(SEED_TEMPLATE_IDS)


def test_super_seed_contains_all_rule_types(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))

    response = client.get("/api/templates/example-super")

    assert response.status_code == 200
    template = response.json()
    version = template["versions"][0]
    rule_types = {rule["type"] for rule in version["mapping_spec"]["rules"]}
    assert template["is_seeded"] is True
    assert version["sample_source_content"]
    assert version["sample_target_content"]
    assert rule_types == {"field", "constant", "concat", "date_format", "condition", "loop"}


def test_seeded_template_ids_cannot_be_recreated(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))

    response = client.post(
        "/api/templates",
        json={
            "template_id": "example-field",
            "name": "Example - Field",
            "source_format": "json",
            "target_format": "json",
            "mapping_spec": {"rules": []},
        },
    )

    assert response.status_code == 409


@pytest.mark.parametrize("template_id", sorted(SEED_TEMPLATE_IDS))
def test_seeded_template_transforms_successfully(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    template_id: str,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", str(tmp_path / "templates.sqlite3"))
    template = client.get(f"/api/templates/{template_id}").json()
    version = template["versions"][0]
    source_data = json.loads(version["sample_source_content"])
    expected_output = json.loads(version["sample_target_content"])

    response = client.post(
        "/api/transform",
        json={
            "source_data": source_data,
            "output_format": version["target_format"],
            "rules": version["mapping_spec"]["rules"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_errors"] == []
    assert payload["output"] == expected_output
