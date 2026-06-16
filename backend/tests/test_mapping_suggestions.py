import json

import httpx
import respx
from fastapi.testclient import TestClient

from app.core.mapping.openrouter_provider import OPENROUTER_CHAT_COMPLETIONS_URL, OpenRouterProvider
from app.core.schema.infer_schema import infer_schema

SOURCE_DATA = {
    "shipment": {
        "trackingNumber": "TRK123",
        "carrier": "MAERSK",
        "status": {"code": "X3", "description": "Arrived"},
        "eventTime": "20260608",
        "location": {"city": "Mumbai", "country": "IN"},
    }
}

TARGET_DATA = {
    "tracking": {"number": "", "carrierCode": ""},
    "event": {"statusCode": "", "timestamp": "", "city": "", "country": ""},
}


def test_rule_based_mapping_suggestions_from_api_without_key(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.post(
        "/api/mappings/suggest",
        json={
            "source_schema": infer_schema(SOURCE_DATA).model_dump(by_alias=True),
            "target_schema": infer_schema(TARGET_DATA).model_dump(by_alias=True),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["provider_errors"] == []

    suggestions = payload["suggestions"]
    by_target = {suggestion["target_path"]: suggestion for suggestion in suggestions}
    assert by_target["$.tracking.number"]["source_path"] == "$.shipment.trackingNumber"
    assert by_target["$.tracking.carrierCode"]["source_path"] == "$.shipment.carrier"
    assert by_target["$.event.city"]["confidence"] > 0.5


def test_rule_based_can_disable_ai_even_when_key_exists(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    response = client.post(
        "/api/mappings/suggest",
        json={
            "source_schema": infer_schema(SOURCE_DATA).model_dump(by_alias=True),
            "target_schema": infer_schema(TARGET_DATA).model_dump(by_alias=True),
            "use_ai": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["used_ai"] is False


def test_use_ai_true_without_key_falls_back_to_rule_based(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.post(
        "/api/mappings/suggest",
        json={
            "source_schema": infer_schema(SOURCE_DATA).model_dump(by_alias=True),
            "target_schema": infer_schema(TARGET_DATA).model_dump(by_alias=True),
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["provider_errors"] == []
    assert payload["suggestions"]


def test_mapping_capabilities_reports_ai_availability(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    unavailable = client.get("/api/mappings/capabilities")
    assert unavailable.status_code == 200
    assert unavailable.json() == {
        "ai_mapping_available": False,
        "ai_provider": "openrouter",
    }

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    available = client.get("/api/mappings/capabilities")
    assert available.status_code == 200
    assert available.json()["ai_mapping_available"] is True


@respx.mock
def test_openrouter_provider_parses_suggestions() -> None:
    route = respx.post(OPENROUTER_CHAT_COMPLETIONS_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "suggestions": [
                                        {
                                            "id": "ai_tracking",
                                            "source_path": "$.shipment.trackingNumber",
                                            "target_path": "$.tracking.number",
                                            "required": True,
                                            "confidence": 0.91,
                                            "explanation": "Tracking number fields match.",
                                        }
                                    ]
                                }
                            )
                        }
                    }
                ]
            },
        )
    )

    provider = OpenRouterProvider(
        api_key="test-key",
        model="test-model",
        http_referer="https://example.test",
        app_title="Auto Mapping Test",
    )
    suggestions = provider.suggest(
        infer_schema(SOURCE_DATA),
        infer_schema(TARGET_DATA),
        "logistics mapping",
    )

    assert route.called
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.headers["HTTP-Referer"] == "https://example.test"
    assert request.headers["X-Title"] == "Auto Mapping Test"
    assert suggestions[0].source_path == "$.shipment.trackingNumber"
    assert suggestions[0].source == "openrouter"


@respx.mock
def test_api_uses_mocked_openrouter_when_key_exists(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    respx.post(OPENROUTER_CHAT_COMPLETIONS_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "suggestions": [
                                        {
                                            "id": "ai_city",
                                            "source_path": "$.shipment.location.city",
                                            "target_path": "$.event.city",
                                            "required": True,
                                            "confidence": 0.99,
                                            "explanation": "City fields match.",
                                        }
                                    ]
                                }
                            )
                        }
                    }
                ]
            },
        )
    )

    response = client.post(
        "/api/mappings/suggest",
        json={
            "source_schema": infer_schema(SOURCE_DATA).model_dump(by_alias=True),
            "target_schema": infer_schema(TARGET_DATA).model_dump(by_alias=True),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is True
    by_target = {suggestion["target_path"]: suggestion for suggestion in payload["suggestions"]}
    assert by_target["$.event.city"]["source"] == "openrouter"
    assert by_target["$.event.city"]["confidence"] == 0.99


@respx.mock
def test_api_falls_back_to_rule_based_when_openrouter_fails(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    respx.post(OPENROUTER_CHAT_COMPLETIONS_URL).mock(
        return_value=httpx.Response(500, json={"error": "provider down"})
    )

    response = client.post(
        "/api/mappings/suggest",
        json={
            "source_schema": infer_schema(SOURCE_DATA).model_dump(by_alias=True),
            "target_schema": infer_schema(TARGET_DATA).model_dump(by_alias=True),
            "use_ai": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["used_ai"] is False
    assert payload["provider_errors"]
    assert payload["suggestions"]
