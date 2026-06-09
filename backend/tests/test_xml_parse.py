from pathlib import Path

from fastapi.testclient import TestClient


def test_parse_xml_sample(client: TestClient, samples_dir: Path) -> None:
    response = client.post(
        "/api/parse",
        json={"format": "xml", "content": (samples_dir / "source.xml").read_text()},
    )

    assert response.status_code == 200
    shipment = response.json()["canonical"]["Shipment"]
    assert shipment["TrackingNumber"] == "TRK123"
    assert shipment["Location"]["City"] == "Mumbai"


def test_invalid_xml_returns_400(client: TestClient) -> None:
    response = client.post("/api/parse", json={"format": "xml", "content": "<Shipment>"})

    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "Invalid XML input."

