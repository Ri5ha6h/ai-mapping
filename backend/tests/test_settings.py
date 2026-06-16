from pathlib import Path

from app.config.settings import BACKEND_ROOT, get_settings, load_dotenv_file


def test_load_dotenv_file_sets_missing_environment_values(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "OPENROUTER_API_KEY=test-key",
                "OPENROUTER_MODEL='test-model'",
            ]
        )
    )

    load_dotenv_file(env_file)

    settings = get_settings()
    assert settings.openrouter_api_key == "test-key"
    assert settings.openrouter_model == "test-model"


def test_load_dotenv_file_does_not_override_exported_values(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "exported-key")
    env_file = tmp_path / ".env"
    env_file.write_text("OPENROUTER_API_KEY=file-key")

    load_dotenv_file(env_file)

    assert get_settings().openrouter_api_key == "exported-key"


def test_default_template_database_path_is_backend_relative(monkeypatch) -> None:
    monkeypatch.delenv("TEMPLATE_DB_PATH", raising=False)

    assert Path(get_settings().template_db_path) == (
        BACKEND_ROOT / "data" / "templates.sqlite3"
    )


def test_relative_template_database_path_is_resolved_from_backend_root(
    monkeypatch,
) -> None:
    monkeypatch.setenv("TEMPLATE_DB_PATH", "data/custom.sqlite3")

    assert Path(get_settings().template_db_path) == BACKEND_ROOT / "data" / "custom.sqlite3"
