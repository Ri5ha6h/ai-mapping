from pathlib import Path

from app.config.settings import get_settings, load_dotenv_file


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
