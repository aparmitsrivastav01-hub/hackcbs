import asyncio
from collections import OrderedDict
from dataclasses import dataclass, field
import os
import re
import time
from typing import Any
from uuid import uuid4


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


MAX_HISTORY_MESSAGES = _bounded_int("MEDEASY_AI_MAX_HISTORY_MESSAGES", 12, 2, 40)
MAX_CONTEXT_CHARS = _bounded_int("MEDEASY_AI_MAX_CONTEXT_CHARS", 18000, 2000, 60000)
MAX_SESSIONS = _bounded_int("MEDEASY_AI_MAX_SESSIONS", 200, 10, 2000)
SESSION_TTL_SECONDS = _bounded_int("MEDEASY_AI_SESSION_TTL_SECONDS", 2 * 60 * 60, 60, 24 * 60 * 60)

EMERGENCY_TERMS = (
    "chest pain",
    "severe chest",
    "difficulty breathing",
    "trouble breathing",
    "can't breathe",
    "cannot breathe",
    "shortness of breath",
    "face drooping",
    "slurred speech",
    "weakness on one side",
    "unconscious",
    "loss of consciousness",
    "severe bleeding",
    "anaphylaxis",
    "throat closing",
    "suicidal",
    "self harm",
    "overdose",
    "सीने में तेज दर्द",
    "सांस नहीं",
    "सांस लेने में कठिनाई",
    "बेहोश",
    "अधिक खून",
    "चेहरा टेढ़ा",
    "बोलने में कठिनाई",
    "आत्महत्या",
)


@dataclass
class ChatSession:
    messages: list[dict[str, str]] = field(default_factory=list)
    touched_at: float = field(default_factory=time.monotonic)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    meko_conversation_id: str | None = None
    retrieved_memory_context: str | None = None
    memory_searched: bool = False


class TemporaryChatSessions:
    """Bounded in-memory conversation context. Nothing is written to persistent storage."""

    def __init__(self) -> None:
        self._sessions: OrderedDict[str, ChatSession] = OrderedDict()

    def acquire(self, requested_id: str | None) -> tuple[str, ChatSession]:
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
        session = ChatSession()
        self._sessions[session_id] = session
        while len(self._sessions) > MAX_SESSIONS:
            self._sessions.popitem(last=False)
        return session_id, session

    @staticmethod
    def context(session: ChatSession) -> list[dict[str, str]]:
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
    def add_turn(session: ChatSession, user_message: str, assistant_message: str) -> None:
        session.messages.extend([
            {"role": "user", "text": user_message},
            {"role": "model", "text": assistant_message},
        ])
        session.messages = session.messages[-MAX_HISTORY_MESSAGES:]
        session.touched_at = time.monotonic()


def detect_safety_flags(message: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", message.casefold())
    if any(term in normalized for term in EMERGENCY_TERMS):
        return ["potential_emergency"]
    return []
