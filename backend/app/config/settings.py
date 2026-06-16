from dataclasses import dataclass
from os import environ, getenv
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEMPLATE_DB_PATH = BACKEND_ROOT / "data" / "templates.sqlite3"


def load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text().splitlines():
        value = line.strip()
        if not value or value.startswith("#") or "=" not in value:
            continue
        key, raw_value = value.split("=", 1)
        key = key.removeprefix("export ").strip()
        if not key:
            continue
        raw_value = raw_value.strip()
        if (
            len(raw_value) >= 2
            and raw_value[0] == raw_value[-1]
            and raw_value[0] in {"'", '"'}
        ):
            raw_value = raw_value[1:-1]
        environ.setdefault(key, raw_value)


load_dotenv_file(BACKEND_ROOT / ".env")


def _csv_env(name: str, default: str) -> list[str]:
    value = getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def _default_cors_origins() -> str:
    origins: list[str] = []
    for port in range(3000, 3006):
        origins.append(f"http://localhost:{port}")
        origins.append(f"http://127.0.0.1:{port}")
    return ",".join(origins)


def _template_db_path_from_env() -> str:
    configured_path = getenv("TEMPLATE_DB_PATH")
    if not configured_path:
        return str(DEFAULT_TEMPLATE_DB_PATH)

    db_path = Path(configured_path)
    if db_path.is_absolute():
        return str(db_path)

    return str(BACKEND_ROOT / db_path)


@dataclass(frozen=True)
class Settings:
    app_name: str = "Auto Mapping Service"
    api_prefix: str = "/api"
    cors_origins: list[str] | None = None
    template_db_path: str = _template_db_path_from_env()
    openrouter_api_key: str | None = getenv("OPENROUTER_API_KEY")
    openrouter_model: str | None = getenv("OPENROUTER_MODEL")
    openrouter_http_referer: str | None = getenv("OPENROUTER_HTTP_REFERER")
    openrouter_app_title: str | None = getenv("OPENROUTER_APP_TITLE")

    def __post_init__(self) -> None:
        if self.cors_origins is None:
            object.__setattr__(
                self,
                "cors_origins",
                _csv_env("CORS_ORIGINS", _default_cors_origins()),
            )


settings = Settings()


def get_settings() -> Settings:
    return Settings(
        cors_origins=_csv_env("CORS_ORIGINS", _default_cors_origins()),
        template_db_path=_template_db_path_from_env(),
        openrouter_api_key=getenv("OPENROUTER_API_KEY"),
        openrouter_model=getenv("OPENROUTER_MODEL"),
        openrouter_http_referer=getenv("OPENROUTER_HTTP_REFERER"),
        openrouter_app_title=getenv("OPENROUTER_APP_TITLE"),
    )
