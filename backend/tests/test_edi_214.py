from pathlib import Path

from fastapi.testclient import TestClient


def test_parse_edi_214_sample(client: TestClient, samples_dir: Path) -> None:
    response = client.post(
        "/api/parse",
        json={"format": "edi_214", "content": (samples_dir / "edi_214.edi").read_text()},
    )

    assert response.status_code == 200
    edi = response.json()["canonical"]["edi"]
    assert edi["transaction_set"] == "214"
    assert edi["segments"][3]["segment_id"] == "B10"
    assert edi["segments"][3]["elements"] == ["REF123", "TRK123", "MAERSK"]
    assert "raw" in edi

