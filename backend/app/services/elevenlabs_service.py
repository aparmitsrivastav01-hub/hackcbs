"""
Backward-compatibility stub for ElevenLabsSpeechService.
Delegates to GnaniVoiceService without requiring elevenlabs package.
"""

from app.services.voice_service import (
    GnaniAuthenticationError as ElevenLabsAuthenticationError,
    MissingGnaniConfiguration as ElevenLabsConfigurationError,
    GnaniProviderError as ElevenLabsProviderError,
    GnaniRateLimitError as ElevenLabsRateLimitError,
    GnaniVoiceService as ElevenLabsSpeechService,
    GnaniProviderTimeout as ElevenLabsTimeoutError,
)

DEFAULT_PREMADE_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"
DEFAULT_MODEL_ID = "eleven_multilingual_v2"
MAX_SPEECH_CHARS = 2500

__all__ = [
    "ElevenLabsAuthenticationError",
    "ElevenLabsConfigurationError",
    "ElevenLabsProviderError",
    "ElevenLabsRateLimitError",
    "ElevenLabsSpeechService",
    "ElevenLabsTimeoutError",
    "DEFAULT_PREMADE_VOICE_ID",
    "DEFAULT_MODEL_ID",
    "MAX_SPEECH_CHARS",
]
