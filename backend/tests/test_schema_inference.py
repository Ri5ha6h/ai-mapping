from fastapi.testclient import TestClient


def test_infer_object_schema(client: TestClient) -> None:
    response = client.post(
        "/api/schema/infer",
        json={
            "data": {
                "shipment": {
                    "trackingNumber": "TRK123",
                    "pieces": 2,
                    "hazmat": False,
                    "events": [{"code": "X3"}, {"code": "AF", "city": "Mumbai"}],
                }
            }
        },
    )

    assert response.status_code == 200
    schema = response.json()["schema"]
    shipment = schema["fields"]["shipment"]
    assert shipment["type"] == "object"
    assert shipment["fields"]["trackingNumber"]["type"] == "string"
    assert shipment["fields"]["pieces"]["type"] == "integer"
    assert shipment["fields"]["hazmat"]["type"] == "boolean"
    event_fields = shipment["fields"]["events"]["items"]["fields"]
    assert event_fields["code"]["required"] is True
    assert event_fields["city"]["required"] is False

