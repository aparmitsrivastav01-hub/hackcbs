import asyncio
import hashlib
import logging
import os
import threading
import time
from collections import OrderedDict
from typing import Any

logger = logging.getLogger(__name__)

ASR_TIMEOUT_SECONDS = 35
TTS_TIMEOUT_SECONDS = 25
TTS_CACHE_SIZE = 64
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 0.5

_tts_cache: OrderedDict[str, bytes] = OrderedDict()
_tts_cache_lock = threading.Lock()

# Healthcare and pharmacy domain keywords to improve STT accuracy for Indian medicine queries
PHARMACY_KEYWORDS = [
    "Paracetamol",
    "Dolo 650",
    "Azithromycin",
    "Metformin",
    "Amoxicillin",
    "Cetirizine",
    "Pantoprazole",
    "Omeprazole",
    "Jan Aushadhi",
    "Dava India",
    "tablet",
    "syrup",
    "capsule",
    "injection",
    "mg",
    "ml",
]


class MissingGnaniConfiguration(Exception):
    pass


class GnaniProviderTimeout(Exception):
    pass


class GnaniAuthenticationError(Exception):
    pass


class GnaniRateLimitError(Exception):
    pass


class GnaniProviderError(Exception):
    pass


class InvalidAudioError(Exception):
    pass


def _cache_key(text: str, language: str, model: str, voice: str) -> str:
    return hashlib.sha256(f"{model}\0{voice}\0{language}\0{text}".encode()).hexdigest()


def _normalize_stt_language(lang: str) -> tuple[str, str, list[str] | None]:
    """
    Returns (language_code, format, language_candidates) for Gnani Prisma v3.0 STT.
    Supports Hindi (hi-IN), English (en-IN), and Hinglish / auto code-mixed recognition.
    """
    clean = (lang or "auto").strip().lower()
    if clean in {"hi", "hi-in", "hindi"}:
        return "hi-IN", "codemix", None
    if clean in {"en", "en-in", "english"}:
        return "en-IN", "transcribe", None
    # Auto / Hinglish / Code-mixed
    return "indic-auto", "codemix", ["hi-IN", "en-IN"]


def _normalize_tts_language(lang: str, text: str) -> str:
    """
    Maps language code to valid Gnani Timbre BCP-47 language.
    If text contains Devanagari script, defaults to hi-IN.
    """
    clean = (lang or "hi-IN").strip().lower()
    if clean in {"hi", "hi-in", "hindi"}:
        return "hi-IN"
    if clean in {"en", "en-in", "english"}:
        return "en-IN"
    # Auto / Hinglish: inspect script
    if any("\u0900" <= c <= "\u097f" for c in text):
        return "hi-IN"
    return "en-IN"


class GnaniVoiceService:
    """Server-side adapter around Gnani's official Python SDK for Prisma STT and Timbre TTS."""

    def __init__(
        self,
        api_key: str | None = None,
        asr_model: str | None = None,
        tts_model: str | None = None,
        voice: str | None = None,
        stt_client_factory: Any | None = None,
        tts_client_factory: Any | None = None,
    ):
        self.api_key = api_key if api_key is not None else os.getenv("GNANI_API_KEY")
        self.asr_model = asr_model or os.getenv("GNANI_ASR_MODEL", "prisma-v3.0")
        self.tts_model = tts_model or os.getenv("GNANI_TTS_MODEL", "timbre-v2.5")
        self.voice = voice or os.getenv("GNANI_VOICE", "Pranav")
        self.stt_client_factory = stt_client_factory
        self.tts_client_factory = tts_client_factory

    def _require_key(self) -> str:
        if not self.api_key:
            raise MissingGnaniConfiguration("Gnani voice service is not configured; set GNANI_API_KEY in the backend environment")
        return self.api_key

    def _get_stt_client(self):
        if self.stt_client_factory is not None:
            return self.stt_client_factory(api_key=self._require_key())
        from gnani.stt import GnaniSTTClient
        return GnaniSTTClient(api_key=self._require_key())

    def _get_tts_client(self):
        if self.tts_client_factory is not None:
            return self.tts_client_factory(api_key=self._require_key())
        from gnani.tts import GnaniTTSClient
        return GnaniTTSClient(api_key=self._require_key())

    def _transcribe_blocking(self, audio: bytes, filename: str, language: str) -> dict[str, Any]:
        client = self._get_stt_client()
        is_prisma = self.asr_model == "prisma-v3.0"
        language_code, fmt, candidates = _normalize_stt_language(language)

        options: dict[str, Any] = {
            "language_code": language_code if is_prisma else ("auto" if language == "auto" else language),
            "model": self.asr_model,
        }
        if is_prisma:
            options["format"] = fmt
            if candidates:
                options["language_candidates"] = candidates
            options["keywords"] = PHARMACY_KEYWORDS[:15]
            options["topic"] = "Healthcare medicine price comparison and prescription search"

        last_exc = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return client.transcribe_bytes(audio, filename=filename, **options)
            except Exception as exc:
                last_exc = exc
                err_type = type(exc).__name__
                status = getattr(exc, "status_code", getattr(exc, "code", None))
                # Do not retry client/auth errors
                if status in {401, 403} or "authentication" in err_type.lower():
                    raise GnaniAuthenticationError("Gnani STT authentication failed; verify GNANI_API_KEY") from exc
                if status == 429:
                    raise GnaniRateLimitError("Gnani STT rate limit reached; retry shortly") from exc
                if "invalidaudio" in err_type.lower():
                    raise InvalidAudioError("Invalid audio format for Gnani STT") from exc

                if attempt < MAX_RETRIES:
                    logger.warning("Gnani STT transient failure (attempt %d/%d, error=%s). Retrying...", attempt + 1, MAX_RETRIES + 1, exc)
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                else:
                    break

        raise last_exc

    async def transcribe(self, audio: bytes, filename: str = "audio.wav", language: str = "auto") -> dict[str, Any]:
        self._require_key()
        if not audio:
            raise InvalidAudioError("Audio file is empty")

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(self._transcribe_blocking, audio, filename, language),
                timeout=ASR_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise GnaniProviderTimeout("Gnani speech recognition timed out") from exc
        except (MissingGnaniConfiguration, GnaniProviderTimeout, GnaniAuthenticationError, GnaniRateLimitError, InvalidAudioError):
            raise
        except Exception as exc:
            logger.warning("Gnani ASR request failed (error_type=%s)", type(exc).__name__)
            raise GnaniProviderError("Gnani speech recognition failed") from exc

        transcript = result.get("transcript") if isinstance(result, dict) else None
        if not isinstance(transcript, str) or not transcript.strip():
            raise GnaniProviderError("Gnani returned an empty transcript")

        confidence = result.get("confidence") if isinstance(result, dict) else None
        if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            confidence = None

        detected_language = result.get("detected_language_code") if isinstance(result, dict) else None
        if not detected_language and language != "auto":
            detected_language = language

        return {
            "transcript": transcript.strip(),
            "language": detected_language or "en-IN",
            "confidence": confidence,
        }

    def _synthesize_blocking(self, text: str, language: str) -> bytes:
        from gnani.tts import AudioConfig, GnaniTTSClient, SUPPORTED_MODELS

        if self.tts_model not in SUPPORTED_MODELS:
            raise ValueError(f"Unsupported configured Gnani TTS model '{self.tts_model}'")

        try:
            voices = GnaniTTSClient.supported_voices(model=self.tts_model)
        except Exception:
            voices = ["Pranav"]

        target_voice = self.voice if self.voice in voices else ("Pranav" if "Pranav" in voices else (voices[0] if voices else "Pranav"))
        target_lang = _normalize_tts_language(language, text)
        client = self._get_tts_client()

        last_exc = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return client.synthesize(
                    text,
                    voice=target_voice,
                    model=self.tts_model,
                    language=target_lang,
                    audio_config=AudioConfig(container="mp3", sample_rate=44100, bitrate="128k"),
                )
            except Exception as exc:
                last_exc = exc
                err_type = type(exc).__name__
                status = getattr(exc, "status_code", getattr(exc, "code", None))
                if status in {401, 403} or "authentication" in err_type.lower():
                    raise GnaniAuthenticationError("Gnani TTS authentication failed; check GNANI_API_KEY") from exc
                if status == 429:
                    raise GnaniRateLimitError("Gnani TTS rate limit reached; retry shortly") from exc

                if attempt < MAX_RETRIES:
                    logger.warning("Gnani TTS transient failure (attempt %d/%d, error=%s). Retrying...", attempt + 1, MAX_RETRIES + 1, exc)
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                else:
                    break

        raise last_exc

    async def speak(self, text: str, language: str = "hi-IN") -> bytes:
        self._require_key()
        clean_text = text.strip()
        if not clean_text:
            raise ValueError("Speech text must not be empty")
        if len(clean_text) > 2500:
            clean_text = clean_text[:2500]

        target_lang = _normalize_tts_language(language, clean_text)
        cache_key = _cache_key(clean_text, target_lang, self.tts_model, self.voice or "default")

        with _tts_cache_lock:
            cached = _tts_cache.get(cache_key)
            if cached is not None:
                _tts_cache.move_to_end(cache_key)
                return cached

        try:
            audio = await asyncio.wait_for(
                asyncio.to_thread(self._synthesize_blocking, clean_text, target_lang),
                timeout=TTS_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise GnaniProviderTimeout("Gnani speech synthesis timed out") from exc
        except (MissingGnaniConfiguration, GnaniProviderTimeout, GnaniAuthenticationError, GnaniRateLimitError):
            raise
        except Exception as exc:
            logger.warning("Gnani TTS request failed (error_type=%s)", type(exc).__name__)
            raise GnaniProviderError("Gnani speech synthesis failed") from exc

        if not audio:
            raise GnaniProviderError("Gnani returned empty audio")

        with _tts_cache_lock:
            _tts_cache[cache_key] = audio
            _tts_cache.move_to_end(cache_key)
            while len(_tts_cache) > TTS_CACHE_SIZE:
                _tts_cache.popitem(last=False)

        return audio

    async def synthesize(self, text: str, language: str = "en") -> bytes:
        """Alias for speak() to preserve backward compatibility with existing callers."""
        return await self.speak(text, language)
