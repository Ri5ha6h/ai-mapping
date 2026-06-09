from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def samples_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "samples"

