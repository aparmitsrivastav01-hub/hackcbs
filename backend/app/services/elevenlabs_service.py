import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)
ELEVENLABS_TIMEOUT_SECONDS = 35
MAX_SPEECH_CHARS = 2500


class ElevenLabsConfigurationError(Exception):
    pass


class ElevenLabsTimeoutError(Exception):
    pass


class ElevenLabsAuthenticationError(Exception):
    pass


class ElevenLabsRateLimitError(Exception):
    pass


class ElevenLabsProviderError(Exception):
    pass


class ElevenLabsSpeechService:
    def __init__(
        self,
        api_key: str | None = None,
        voice_id: str | None = None,
        model_id: str | None = None,
        client_factory: Any | None = None,
    ):
        self.api_key = api_key if api_key is not None else os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id if voice_id is not None else os.getenv("ELEVENLABS_VOICE_ID")
        self.model_id = model_id if model_id is not None else os.getenv("ELEVENLABS_MODEL_ID")
        self.client_factory = client_factory

    def _generate_blocking(self, text: str, language: str) -> bytes:
        if not self.api_key:
            raise ElevenLabsConfigurationError("ElevenLabs is not configured; set ELEVENLABS_API_KEY")
        if not self.voice_id:
            raise ElevenLabsConfigurationError("ElevenLabs voice is not configured; set ELEVENLABS_VOICE_ID")
        if not self.model_id:
            raise ElevenLabsConfigurationError("ElevenLabs model is not configured; set ELEVENLABS_MODEL_ID")

        if self.client_factory is None:
            from elevenlabs.client import ElevenLabs

            client = ElevenLabs(api_key=self.api_key, timeout=ELEVENLABS_TIMEOUT_SECONDS)
        else:
            client = self.client_factory(api_key=self.api_key, timeout=ELEVENLABS_TIMEOUT_SECONDS)
        options: dict[str, Any] = {
            "voice_id": self.voice_id,
            "text": text,
            "model_id": self.model_id,
            "output_format": "mp3_44100_128",
        }
        # Eleven Multilingual v2 infers the language from the text; it does not accept language_code.
        if self.model_id != "eleven_multilingual_v2":
            options["language_code"] = language
        chunks = client.text_to_speech.convert(**options)
        audio = b"".join(chunks)
        if not audio:
            raise ElevenLabsProviderError("ElevenLabs returned empty audio")
        return audio

    async def synthesize(self, text: str, language: str) -> bytes:
        if not self.api_key:
            raise ElevenLabsConfigurationError("ElevenLabs is not configured; set ELEVENLABS_API_KEY")
        if not self.voice_id:
            raise ElevenLabsConfigurationError("ElevenLabs voice is not configured; set ELEVENLABS_VOICE_ID")
        if not self.model_id:
            raise ElevenLabsConfigurationError("ElevenLabs model is not configured; set ELEVENLABS_MODEL_ID")
        if not text.strip() or len(text) > MAX_SPEECH_CHARS:
            raise ValueError(f"Speech text must contain 1 to {MAX_SPEECH_CHARS} characters")
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._generate_blocking, text.strip(), language),
                timeout=ELEVENLABS_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise ElevenLabsTimeoutError("ElevenLabs speech generation timed out") from exc
        except (ElevenLabsConfigurationError, ElevenLabsTimeoutError, ElevenLabsProviderError):
            raise
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            logger.warning("ElevenLabs request failed (status=%s, error_type=%s)", status, type(exc).__name__)
            if status in {401, 403}:
                raise ElevenLabsAuthenticationError("ElevenLabs authentication failed; check ELEVENLABS_API_KEY") from exc
            if status == 429:
                raise ElevenLabsRateLimitError("ElevenLabs rate limit reached; retry shortly") from exc
            raise ElevenLabsProviderError("ElevenLabs speech generation failed") from exc
