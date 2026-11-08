import io
import wave

from fastapi.testclient import TestClient

from app.main import app
from app.services.voice_service import GnaniVoiceService, MissingGnaniConfiguration
from app.api.routes.voice import _to_search_query


def valid_wav() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b"\x00\x00" * 3200)
    return output.getvalue()


def test_voice_query_removes_request_fillers_but_keeps_strength():
    assert _to_search_query("Mujhe Paracetamol 650 chahiye") == "Paracetamol 650"


def test_missing_gnani_key_is_reported_without_provider_call(monkeypatch):
    monkeypatch.delenv("GNANI_API_KEY", raising=False)
    service = GnaniVoiceService(api_key=None)
    try:
        service._require_key()
    except MissingGnaniConfiguration as exc:
        assert "GNANI_API_KEY" in str(exc)
    else:
        raise AssertionError("Missing provider configuration should be explicit")


def test_voice_search_uses_catalogue_prices_and_returns_audio(monkeypatch):
    # Provider methods are replaced in this test; it does not make a Gnani API call.
    class TestVoiceService:
        async def transcribe(self, audio, filename, language):
            return {"transcript": "Mujhe Paracetamol 650 chahiye", "language": "hi-IN", "confidence": None}

        async def speak(self, text, language):
            assert "Dolo 650" in text
            return b"test-mp3"

    with TestClient(app) as client:
        monkeypatch.setattr(app.state, "voice_service", TestVoiceService(), raising=False)
        response = client.post(
            "/api/voice/search",
            files={"file": ("recording.wav", valid_wav(), "audio/wav")},
            data={"language": "auto"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] == "Mujhe Paracetamol 650 chahiye"
    assert body["search_query"] == "Paracetamol 650"
    assert body["total_results"] >= 1
    dolo = next(item for item in body["medicines"] if item["brand_name"] == "Dolo 650")
    assert dolo["active_salt"] == "Paracetamol 650 mg Tab"
    assert dolo["prices"]["private_brand"] is not None
    assert body["audio_base64"]
    assert body["audio_content_type"] == "audio/mpeg"


def test_transcribe_rejects_empty_audio():
    with TestClient(app) as client:
        response = client.post(
            "/api/voice/transcribe",
            files={"file": ("empty.wav", b"", "audio/wav")},
            data={"language": "auto"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == "Audio file is empty"


def test_speak_returns_playable_audio_content_type(monkeypatch):
    class TestVoiceService:
        async def speak(self, text, language):
            assert text == "Medicine result"
            assert language == "en-IN"
            return b"test-mp3"

    with TestClient(app) as client:
        monkeypatch.setattr(app.state, "voice_service", TestVoiceService(), raising=False)
        response = client.post("/api/voice/speak", json={"text": "Medicine result", "language": "en-IN"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"test-mp3"
