from pathlib import Path

from fastapi.testclient import TestClient


def test_parse_edi_856_sample(client: TestClient, samples_dir: Path) -> None:
    response = client.post(
        "/api/parse",
        json={"format": "edi_856", "content": (samples_dir / "edi_856.edi").read_text()},
    )

    assert response.status_code == 200
    edi = response.json()["canonical"]["edi"]
    assert edi["transaction_set"] == "856"
    assert edi["segments"][3]["segment_id"] == "BSN"
    assert edi["segments"][3]["elements"] == ["00", "SHIP123", "20260608", "1030"]

