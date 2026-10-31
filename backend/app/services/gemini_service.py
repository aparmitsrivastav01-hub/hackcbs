import asyncio
import logging
import os
import re
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable
from uuid import uuid4

from app.core.healthcare_prompt import HEALTHCARE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 12
MAX_CONTEXT_CHARS = 18000
MAX_SESSIONS = 200
SESSION_TTL_SECONDS = 2 * 60 * 60
GEMINI_TIMEOUT_SECONDS = 45
MAX_RETRIES = 2

EMERGENCY_TERMS = (
    "chest pain", "severe chest", "difficulty breathing", "trouble breathing", "can't breathe",
    "cannot breathe", "shortness of breath", "face drooping", "slurred speech", "weakness on one side",
    "unconscious", "loss of consciousness", "severe bleeding", "anaphylaxis", "throat closing",
    "suicidal", "self harm", "overdose", "सीने में तेज दर्द", "सांस नहीं", "सांस लेने में कठिनाई",
    "बेहोश", "अधिक खून", "चेहरा टेढ़ा", "बोलने में कठिनाई", "आत्महत्या",
)


class GeminiConfigurationError(Exception):
    pass


class GeminiTimeoutError(Exception):
    pass


class GeminiRateLimitError(Exception):
    pass


class GeminiProviderError(Exception):
    pass


@dataclass
class _Session:
    messages: list[dict[str, str]] = field(default_factory=list)
    touched_at: float = field(default_factory=time.monotonic)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class TemporaryChatSessions:
    """Bounded in-memory conversation context. Nothing is written to persistent storage."""

    def __init__(self) -> None:
        self._sessions: OrderedDict[str, _Session] = OrderedDict()

    def acquire(self, requested_id: str | None) -> tuple[str, _Session]:
        now = time.monotonic()
        for session_id, session in list(self._sessions.items()):
            if now - session.touched_at > SESSION_TTL_SECONDS:
                self._sessions.pop(session_id, None)
        if requested_id and requested_id in self._sessions:
            session = self._sessions[requested_id]
            session.touched_at = now
            self._sessions.move_to_end(requested_id)
            return requested_id, session
        session_id = str(uuid4())
        session = _Session()
        self._sessions[session_id] = session
        while len(self._sessions) > MAX_SESSIONS:
            self._sessions.popitem(last=False)
        return session_id, session

    @staticmethod
    def context(session: _Session) -> list[dict[str, str]]:
        selected: list[dict[str, str]] = []
        used = 0
        for message in reversed(session.messages[-MAX_HISTORY_MESSAGES:]):
            text = message["text"]
            if used + len(text) > MAX_CONTEXT_CHARS:
                break
            selected.insert(0, message)
            used += len(text)
        return selected

    @staticmethod
    def add_turn(session: _Session, user_message: str, assistant_message: str) -> None:
        session.messages.extend([
            {"role": "user", "text": user_message},
            {"role": "model", "text": assistant_message},
        ])
        session.messages = session.messages[-MAX_HISTORY_MESSAGES:]
        session.touched_at = time.monotonic()


def detect_safety_flags(message: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", message.casefold())
    return ["potential_emergency"] if any(term in normalized for term in EMERGENCY_TERMS) else []


def _usage_from(response: Any) -> dict[str, int | None]:
    metadata = getattr(response, "usage_metadata", None)
    if metadata is None:
        return {"prompt_tokens": None, "response_tokens": None, "total_tokens": None}
    return {
        "prompt_tokens": getattr(metadata, "prompt_token_count", None),
        "response_tokens": getattr(metadata, "candidates_token_count", None),
        "total_tokens": getattr(metadata, "total_token_count", None),
    }


class GeminiService:
    def __init__(self, api_key: str | None = None, model: str | None = None, client: Any | None = None):
        self.api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        self._client = client

    def _get_client(self):
        if not self.api_key:
            raise GeminiConfigurationError("Gemini is not configured; set GEMINI_API_KEY in the backend environment")
        if self._client is None:
            from google import genai
            from google.genai import types

            self._client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_SECONDS * 1000),
            )
        return self._client

    async def close(self) -> None:
        client = self._client
        if client is None:
            return
        try:
            await client.aio.aclose()
        except Exception:
            logger.debug("Gemini async client close failed")
        try:
            client.close()
        except Exception:
            pass

    async def generate_chat(
        self,
        history: list[dict[str, str]],
        message: str,
        language: str,
        catalogue_context: str = "",
        on_chunk: Callable[[str], Awaitable[None]] | None = None,
    ) -> dict[str, Any]:
        client = self._get_client()
        from google.genai import types

        system_instruction = HEALTHCARE_SYSTEM_PROMPT + (
            "\n\nAnswer in Hindi." if language == "hi" else "\n\nAnswer in English."
        )
        current_message = message
        if catalogue_context:
            current_message += "\n\n[MedEasy catalogue context; authoritative only for listed product fields and prices]\n" + catalogue_context
        contents = [
            types.Content(role=item["role"], parts=[types.Part.from_text(text=item["text"])])
            for item in history
        ]
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=current_message)]))
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
            max_output_tokens=900,
        )

        for attempt in range(MAX_RETRIES + 1):
            emitted = False
            try:
                async with asyncio.timeout(GEMINI_TIMEOUT_SECONDS):
                    if on_chunk is None:
                        response = await client.aio.models.generate_content(
                            model=self.model,
                            contents=contents,
                            config=config,
                        )
                        text = response.text or ""
                        usage = _usage_from(response)
                    else:
                        stream = await client.aio.models.generate_content_stream(
                            model=self.model,
                            contents=contents,
                            config=config,
                        )
                        pieces: list[str] = []
                        usage = {"prompt_tokens": None, "response_tokens": None, "total_tokens": None}
                        async for chunk in stream:
                            chunk_text = chunk.text or ""
                            if chunk_text:
                                emitted = True
                                pieces.append(chunk_text)
                                await on_chunk(chunk_text)
                            chunk_usage = _usage_from(chunk)
                            if any(value is not None for value in chunk_usage.values()):
                                usage = chunk_usage
                        text = "".join(pieces)
                if not text.strip():
                    raise GeminiProviderError("Gemini returned an empty response")
                return {
                    "response": text.strip(),
                    "safety_flags": detect_safety_flags(message),
                    "usage": usage,
                }
            except GeminiProviderError:
                raise
            except TimeoutError as exc:
                raise GeminiTimeoutError("Gemini response timed out") from exc
            except Exception as exc:
                status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                retryable = status == 429 or status in {500, 502, 503, 504}
                if retryable and attempt < MAX_RETRIES and not emitted:
                    await asyncio.sleep(0.25 * (2 ** attempt))
                    continue
                logger.warning("Gemini request failed (status=%s, error_type=%s)", status, type(exc).__name__)
                if status == 429:
                    raise GeminiRateLimitError("Gemini rate limit reached; retry shortly") from exc
                raise GeminiProviderError("Gemini healthcare response failed") from exc

        raise GeminiProviderError("Gemini healthcare response failed")
