from fastapi.testclient import TestClient

from app.main import app


class FakeGemini:
    api_key = "configured-for-test"

    async def generate_chat(self, history, message, language, catalogue_context="", on_chunk=None):
        answer = "Seek emergency care now." if "chest pain" in message.lower() else "MedEasy helps compare medicines and prices."
        if on_chunk:
            await on_chunk(answer[:10])
            await on_chunk(answer[10:])
        return {
            "response": answer,
            "safety_flags": ["potential_emergency"] if "chest pain" in message.lower() else [],
            "usage": {"prompt_tokens": 10, "response_tokens": 8, "total_tokens": 18},
        }

    async def close(self):
        pass


class FakeElevenLabs:
    async def synthesize(self, text, language):
        return b"test-mp3-audio"


def test_gemini_chat_json_returns_session_and_safety_flags():
    with TestClient(app) as client:
        app.state.gemini_service = FakeGemini()
        response = client.post("/api/ai/chat", json={"message": "I have chest pain", "language": "en", "stream": False})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["session_id"]
        assert data["safety_flags"] == ["potential_emergency"]
        assert data["usage"]["total_tokens"] == 18


def test_gemini_chat_stream_emits_delta_and_final_response():
    with TestClient(app) as client:
        app.state.gemini_service = FakeGemini()
        response = client.post("/api/ai/chat", json={"message": "What does MedEasy do?", "language": "en", "stream": True})
        assert response.status_code == 200
        assert '"type": "delta"' in response.text
        assert '"type": "done"' in response.text
        assert "MedEasy helps compare medicines" in response.text


def test_elevenlabs_route_returns_mp3_bytes_for_both_languages():
    with TestClient(app) as client:
        app.state.elevenlabs_service = FakeElevenLabs()
        for language in ("en", "hi"):
            response = client.post("/api/voice/elevenlabs/speak", json={"text": "Hello", "language": language})
            assert response.status_code == 200
            assert response.headers["content-type"] == "audio/mpeg"
            assert response.content == b"test-mp3-audio"


def test_elevenlabs_route_rejects_invalid_language():
    with TestClient(app) as client:
        response = client.post("/api/voice/elevenlabs/speak", json={"text": "Hello", "language": "fr"})
        assert response.status_code == 422


def test_elevenlabs_service_reports_missing_credentials(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "")
    monkeypatch.setenv("ELEVENLABS_MODEL_ID", "")
    with TestClient(app) as client:
        app.state.elevenlabs_service = None
        response = client.post("/api/voice/elevenlabs/speak", json={"text": "Hello", "language": "en"})
        assert response.status_code == 503
        assert "ELEVENLABS_API_KEY" in response.json()["detail"]
