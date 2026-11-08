import asyncio
import io
import wave
from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.services.voice_service import (
    GnaniAuthenticationError,
    GnaniProviderError,
    GnaniProviderTimeout,
    GnaniRateLimitError,
    GnaniVoiceService,
    InvalidAudioError,
    MissingGnaniConfiguration,
)


def make_test_wav(duration_s: float = 1.0, framerate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(framerate)
        wav.writeframes(b"\x00\x00" * int(framerate * duration_s))
    return buf.getvalue()


# -------------------------------------------------------------
# 1. Hindi Speech Recognition
# -------------------------------------------------------------
def test_1_hindi_speech_recognition():
    calls = []

    class DummySTTClient:
        def transcribe_bytes(self, audio_bytes, filename="audio.wav", **kwargs):
            calls.append(kwargs)
            return {
                "success": True,
                "transcript": "मुझे पैरासिटामोल 650 चाहिए",
                "detected_language_code": "hi-IN",
                "confidence": 0.96,
            }

    service = GnaniVoiceService(
        api_key="test-key",
        asr_model="prisma-v3.0",
        stt_client_factory=lambda **_: DummySTTClient(),
    )

    audio = make_test_wav(2.0)
    result = asyncio.run(service.transcribe(audio, "test.wav", language="hi-IN"))

    assert result["transcript"] == "मुझे पैरासिटामोल 650 चाहिए"
    assert result["language"] == "hi-IN"
    assert result["confidence"] == 0.96
    assert len(calls) == 1
    assert calls[0]["language_code"] == "hi-IN"
    assert calls[0]["format"] == "codemix"


# -------------------------------------------------------------
# 2. English Speech Recognition
# -------------------------------------------------------------
def test_2_english_speech_recognition():
    calls = []

    class DummySTTClient:
        def transcribe_bytes(self, audio_bytes, filename="audio.wav", **kwargs):
            calls.append(kwargs)
            return {
                "success": True,
                "transcript": "Show me Paracetamol 500 mg prices",
                "detected_language_code": "en-IN",
                "confidence": 0.98,
            }

    service = GnaniVoiceService(
        api_key="test-key",
        asr_model="prisma-v3.0",
        stt_client_factory=lambda **_: DummySTTClient(),
    )

    audio = make_test_wav(2.0)
    result = asyncio.run(service.transcribe(audio, "test.wav", language="en-IN"))

    assert result["transcript"] == "Show me Paracetamol 500 mg prices"
    assert result["language"] == "en-IN"
    assert len(calls) == 1
    assert calls[0]["language_code"] == "en-IN"
    assert calls[0]["format"] == "transcribe"


# -------------------------------------------------------------
# 3. Hinglish Speech Recognition
# -------------------------------------------------------------
def test_3_hinglish_speech_recognition():
    calls = []

    class DummySTTClient:
        def transcribe_bytes(self, audio_bytes, filename="audio.wav", **kwargs):
            calls.append(kwargs)
            return {
                "success": True,
                "transcript": "Mujhe Dolo 650 tablet chahiye",
                "detected_language_code": "hi-IN",
                "confidence": 0.94,
            }

    service = GnaniVoiceService(
        api_key="test-key",
        asr_model="prisma-v3.0",
        stt_client_factory=lambda **_: DummySTTClient(),
    )

    audio = make_test_wav(2.0)
    result = asyncio.run(service.transcribe(audio, "test.wav", language="auto"))

    assert result["transcript"] == "Mujhe Dolo 650 tablet chahiye"
    assert len(calls) == 1
    # Prisma v3.0 code-mixed auto recognition
    assert calls[0]["language_code"] == "indic-auto"
    assert calls[0]["format"] == "codemix"
    assert "hi-IN" in calls[0]["language_candidates"]
    assert "en-IN" in calls[0]["language_candidates"]


# -------------------------------------------------------------
# 4. Text-to-Speech Generation
# -------------------------------------------------------------
def test_4_text_to_speech_generation():
    calls = []

    class DummyTTSClient:
        def synthesize(self, text, voice="Pranav", model="timbre-v2.5", language="hi-IN", audio_config=None):
            calls.append({"text": text, "voice": voice, "model": model, "language": language, "cfg": audio_config})
            return b"ID3\x03\x00\x00\x00mp3-audio-bytes"

    service = GnaniVoiceService(
        api_key="test-key",
        tts_model="timbre-v2.5",
        voice="Pranav",
        tts_client_factory=lambda **_: DummyTTSClient(),
    )

    audio_hi = asyncio.run(service.speak("डोलो 650 बुखार के लिए उपयोगी है।", "hi-IN"))
    assert audio_hi == b"ID3\x03\x00\x00\x00mp3-audio-bytes"
    assert calls[0]["language"] == "hi-IN"
    assert calls[0]["voice"] == "Pranav"
    assert calls[0]["model"] == "timbre-v2.5"

    audio_en = asyncio.run(service.speak("Dolo 650 is useful for fever relief.", "en-IN"))
    assert audio_en == b"ID3\x03\x00\x00\x00mp3-audio-bytes"
    assert calls[1]["language"] == "en-IN"


# -------------------------------------------------------------
# 5. Audio Playback & Route Responses
# -------------------------------------------------------------
def test_5_audio_playback_headers():
    class DummyVoiceService:
        async def speak(self, text, language):
            return b"ID3\x03\x00\x00\x00sample-mp3"

    with TestClient(app) as client:
        app.state.voice_service = DummyVoiceService()
        response = client.post("/api/voice/speak", json={"text": "Paracetamol is available at Jan Aushadhi", "language": "en-IN"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"
        assert response.headers["cache-control"] == "no-store"
        assert response.content == b"ID3\x03\x00\x00\x00sample-mp3"


# -------------------------------------------------------------
# 6. Invalid Audio Handling
# -------------------------------------------------------------
def test_6_invalid_audio_handling():
    with TestClient(app) as client:
        # 6a. Empty audio
        resp_empty = client.post(
            "/api/voice/transcribe",
            files={"file": ("empty.wav", b"", "audio/wav")},
            data={"language": "auto"},
        )
        assert resp_empty.status_code == 400
        assert "empty" in resp_empty.json()["detail"].lower()

        # 6b. Corrupted / non-audio file
        resp_corrupt = client.post(
            "/api/voice/transcribe",
            files={"file": ("corrupt.wav", b"NOT_A_WAV_FILE_HEADER_TEXT", "audio/wav")},
            data={"language": "auto"},
        )
        assert resp_corrupt.status_code == 415

        # 6c. Oversized duration (>30s)
        long_wav = make_test_wav(duration_s=35.0)
        resp_long = client.post(
            "/api/voice/transcribe",
            files={"file": ("long.wav", long_wav, "audio/wav")},
            data={"language": "auto"},
        )
        assert resp_long.status_code == 413
        assert "30 seconds" in resp_long.json()["detail"]


# -------------------------------------------------------------
# 7. Missing API Credentials
# -------------------------------------------------------------
def test_7_missing_api_credentials(monkeypatch):
    monkeypatch.delenv("GNANI_API_KEY", raising=False)
    monkeypatch.setenv("GNANI_API_KEY", "")

    service = GnaniVoiceService(api_key=None)
    with pytest.raises(MissingGnaniConfiguration) as exc_info:
        service._require_key()
    assert "GNANI_API_KEY" in str(exc_info.value)

    with TestClient(app) as client:
        app.state.voice_service = None
        app.state.elevenlabs_service = None

        resp = client.post("/api/voice/speak", json={"text": "Test speech", "language": "en-IN"})
        assert resp.status_code == 503
        assert "GNANI_API_KEY" in resp.json()["detail"]


# -------------------------------------------------------------
# 8. Gnani API Timeout and Failure Handling
# -------------------------------------------------------------
def test_8_gnani_timeout_and_failure_handling(monkeypatch):
    class TimeoutSTTService:
        async def transcribe(self, audio, filename, language):
            raise GnaniProviderTimeout("Gnani speech recognition timed out")

    class ErrorTTSService:
        async def speak(self, text, language):
            raise GnaniProviderError("Gnani speech synthesis failed")

    with TestClient(app) as client:
        # Timeout -> 504
        app.state.voice_service = TimeoutSTTService()
        wav = make_test_wav(1.0)
        resp_timeout = client.post(
            "/api/voice/transcribe",
            files={"file": ("test.wav", wav, "audio/wav")},
            data={"language": "auto"},
        )
        assert resp_timeout.status_code == 504
        assert "timed out" in resp_timeout.json()["detail"]

        # Provider Error -> 502
        app.state.voice_service = ErrorTTSService()
        resp_error = client.post(
            "/api/voice/speak",
            json={"text": "Fail test", "language": "en-IN"},
        )
        assert resp_error.status_code == 502
        assert "failed" in resp_error.json()["detail"]


# -------------------------------------------------------------
# 9. Complete Voice Interaction with Gemini
# -------------------------------------------------------------
def test_9_complete_voice_interaction_with_gemini():
    class MockSTTService:
        async def transcribe(self, audio, filename, language):
            return {
                "transcript": "What is Paracetamol used for?",
                "language": "en-IN",
                "confidence": 0.99,
            }

        async def speak(self, text, language):
            assert "fever" in text.lower() or "pain" in text.lower()
            return b"ID3\x03\x00\x00\x00gemini-answer-spoken-mp3"

    class MockGeminiService:
        async def generate_chat(self, history, message, language, catalogue_context="", on_chunk=None):
            assert "Paracetamol" in message
            return {
                "response": "Paracetamol is used to treat mild to moderate pain and reduce fever.",
                "safety_flags": [],
                "usage": {"total_tokens": 25},
            }

        async def close(self):
            pass

    with TestClient(app) as client:
        voice_svc = MockSTTService()
        app.state.voice_service = voice_svc
        app.state.gemini_service = MockGeminiService()

        # Step 1: User speaks query -> STT produces transcript
        wav = make_test_wav(2.0)
        stt_resp = client.post(
            "/api/voice/transcribe",
            files={"file": ("recording.wav", wav, "audio/wav")},
            data={"language": "en-IN"},
        )
        assert stt_resp.status_code == 200
        transcribed_text = stt_resp.json()["transcript"]
        assert transcribed_text == "What is Paracetamol used for?"

        # Step 2: Query sent to Gemini health assistant
        chat_resp = client.post(
            "/api/ai/chat",
            json={"message": transcribed_text, "language": "en", "stream": False},
        )
        assert chat_resp.status_code == 200
        gemini_text = chat_resp.json()["response"]
        assert "reduce fever" in gemini_text

        # Step 3: Gemini response synthesized into spoken voice with Gnani Timbre
        speak_resp = client.post(
            "/api/voice/speak",
            json={"text": gemini_text, "language": "en-IN"},
        )
        assert speak_resp.status_code == 200
        assert speak_resp.headers["content-type"] == "audio/mpeg"
        assert speak_resp.content == b"ID3\x03\x00\x00\x00gemini-answer-spoken-mp3"
