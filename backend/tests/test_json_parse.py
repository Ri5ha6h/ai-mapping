from pathlib import Path

from fastapi.testclient import TestClient


def test_parse_json_sample(client: TestClient, samples_dir: Path) -> None:
    response = client.post(
        "/api/parse",
        json={"format": "json", "content": (samples_dir / "source.json").read_text()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["canonical"]["shipment"]["trackingNumber"] == "TRK123"
    assert payload["metadata"]["source_format"] == "json"


def test_invalid_json_returns_400(client: TestClient) -> None:
    response = client.post("/api/parse", json={"format": "json", "content": "{"})

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "Invalid JSON input."

