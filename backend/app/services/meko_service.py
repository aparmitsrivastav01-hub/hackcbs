import json
import logging
import re
from typing import Any

from app.ai.memory.memory_models import MemoryContext
from app.ai.memory.meko_memory import MekoMemoryProvider, _result_payload
from app.mcp.mcp_config import MekoConfig
from app.mcp.mcp_manager import MCPManager

logger = logging.getLogger(__name__)

DEFAULT_PATIENT_ID = "synthetic-patient-001"

# Patterns indicating explicit preference / long-term memory requests
PREFERENCE_PATTERNS = [
    re.compile(r"\b(?:please\s+)?remember\s+that\s+(.+)", re.I),
    re.compile(r"\b(?:keep\s+in\s+mind|note\s+that)\s+(.+)", re.I),
    re.compile(r"\bmy\s+preferred\s+language\s+is\s+(.+)", re.I),
    re.compile(r"\bi\s+prefer\s+(?:to\s+speak\s+in\s+)?(hindi|english)", re.I),
    re.compile(r"\bmujhe\s+(hindi|english)\s+mein\s+baat\s+karni\s+hai", re.I),
]


def extract_rememberable_preference(user_text: str) -> str | None:
    """Detect explicit user requests to remember non-clinical preferences."""
    cleaned = user_text.strip()
    for pattern in PREFERENCE_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            captured = match.group(1).strip().rstrip(".!")
            return f"User preference: {captured}"
    return None


class MekoService:
    """Adapter managing Meko MCP conversational memory with explicit consent and fail-open resilience."""

    def __init__(
        self,
        config: MekoConfig | None = None,
        manager: MCPManager | None = None,
        provider: MekoMemoryProvider | None = None,
        default_patient_id: str = DEFAULT_PATIENT_ID,
    ) -> None:
        self.config = config or MekoConfig.from_environment()
        self.manager = manager or MCPManager(self.config)
        self.provider = provider or MekoMemoryProvider(self.manager.client, agent_id=self.config.datapack_id or default_patient_id)
        self.default_patient_id = default_patient_id
        # Per-patient explicit consent store (defaults to MEKO_CONSENT_DEFAULT, normally False)
        self._consent_store: dict[str, bool] = {}

    def get_consent(self, patient_id: str | None = None) -> bool:
        pid = patient_id or self.default_patient_id
        return self._consent_store.get(pid, self.config.consent_default)

    def set_consent(self, consent: bool, patient_id: str | None = None) -> bool:
        pid = patient_id or self.default_patient_id
        self._consent_store[pid] = bool(consent)
        logger.info("Updated Meko memory consent for patient %s: %s", pid, bool(consent))
        return self._consent_store[pid]

    def is_consented(self, patient_id: str | None = None) -> bool:
        return self.get_consent(patient_id)

    @property
    def is_available(self) -> bool:
        return bool(self.config.enabled and self.manager.available)

    def is_active(self, patient_id: str | None = None) -> bool:
        return self.is_available and self.is_consented(patient_id)

    async def initialize(self) -> None:
        if not self.config.ready:
            logger.info("Meko memory is disabled or unconfigured in environment; skipping MCP startup")
            return
        try:
            await self.manager.start()
            logger.info(
                "MekoService initialized successfully; MCP tools discovered: %s",
                self.manager.discovered_tool_names(),
            )
        except Exception as exc:
            logger.warning("MekoService initialization failed (fail-open): %s", type(exc).__name__)

    async def close(self) -> None:
        try:
            await self.manager.close()
        except Exception as exc:
            logger.debug("MekoService close error: %s", type(exc).__name__)

    async def recall(
        self,
        query: str,
        conversation_id: str | None = None,
        patient_id: str | None = None,
    ) -> MemoryContext:
        """Recall relevant conversational context if consented. Returns empty context if consent is OFF."""
        if not self.is_consented(patient_id):
            return MemoryContext()
        if not self.is_available:
            return MemoryContext()

        try:
            return await self.provider.recall(query, conversation_id=conversation_id)
        except Exception as exc:
            logger.warning("Meko recall failed (fail-open): %s", type(exc).__name__)
            return MemoryContext()

    async def create_conversation(
        self,
        session_id: str,
        title: str | None = None,
        patient_id: str | None = None,
    ) -> str | None:
        """Create a new Meko conversation session if consented."""
        if not self.is_consented(patient_id) or not self.is_available:
            return None
        try:
            result = await self.manager.call_tool(
                "conversation_create",
                {
                    "agent_id": self.provider.agent_id,
                    "session_id": session_id,
                    "title": title or "MedSaathi healthcare session",
                    "metadata": json.dumps({"synthetic_patient_demo": True}),
                },
            )
            payload = _result_payload(result)
            if isinstance(payload, dict):
                return payload.get("id") or payload.get("conversation_id")
            return None
        except Exception as exc:
            logger.warning("Meko create_conversation failed (fail-open): %s", type(exc).__name__)
            return None

    async def log_turn(
        self,
        user_text: str,
        assistant_text: str,
        session_id: str,
        conversation_id: str | None = None,
        patient_id: str | None = None,
    ) -> str | None:
        """Log a conversation turn asynchronously if consented."""
        if not self.is_consented(patient_id) or not self.is_available:
            return None

        try:
            return await self.provider.log_turn(
                user_text=user_text,
                assistant_text=assistant_text,
                session_id=session_id,
                conversation_id=conversation_id,
            )
        except Exception as exc:
            logger.warning("Meko log_turn failed (fail-open): %s", type(exc).__name__)
            return conversation_id

    async def remember(
        self,
        text: str,
        conversation_id: str | None = None,
        patient_id: str | None = None,
        session_id: str | None = None,
    ) -> Any:
        """Store long-term preference memory if consented."""
        if not self.is_consented(patient_id) or not self.is_available:
            return None

        conv_id = conversation_id
        if not conv_id and session_id:
            conv_id = await self.create_conversation(session_id=session_id, patient_id=patient_id)

        if not conv_id:
            logger.warning("Meko remember skipped: conversation_id could not be resolved")
            return None

        try:
            return await self.provider.remember(text, conversation_id=conv_id)
        except Exception as exc:
            logger.warning("Meko remember failed (fail-open): %s", type(exc).__name__)
            return None

    async def update_memory(
        self,
        memory_id: str,
        text: str,
        conversation_id: str | None = None,
        patient_id: str | None = None,
    ) -> Any:
        """Update a conversational memory if consented."""
        if not self.is_consented(patient_id) or not self.is_available:
            return None

        try:
            return await self.provider.update(memory_id, text, conversation_id=conversation_id)
        except Exception as exc:
            logger.warning("Meko update_memory failed (fail-open): %s", type(exc).__name__)
            return None

    async def forget_memory(
        self,
        memory_id: str,
        conversation_id: str | None = None,
        patient_id: str | None = None,
    ) -> Any:
        """Delete a specific memory by ID if consented."""
        if not self.is_consented(patient_id) or not self.is_available:
            return None

        try:
            return await self.provider.forget(memory_id, conversation_id=conversation_id)
        except Exception as exc:
            logger.warning("Meko forget_memory failed (fail-open): %s", type(exc).__name__)
            return None

    async def reset_memory(
        self,
        conversation_id: str | None = None,
        patient_id: str | None = None,
    ) -> dict[str, Any]:
        """Forget all memories and delete active conversation. Does NOT silently re-enable consent."""
        pid = patient_id or self.default_patient_id
        # Preserve or verify current consent state without turning it ON
        current_consent = self.get_consent(pid)

        cleared_memories = False
        cleared_conversation = False

        if self.is_available and current_consent:
            try:
                await self.provider.forget_all(conversation_id=conversation_id)
                cleared_memories = True
            except Exception as exc:
                logger.warning("Meko forget_all failed during reset: %s", type(exc).__name__)

            if conversation_id:
                try:
                    await self.provider.delete_conversation(conversation_id)
                    cleared_conversation = True
                except Exception as exc:
                    logger.warning("Meko delete_conversation failed during reset: %s", type(exc).__name__)

        return {
            "success": True,
            "patient_id": pid,
            "consent": current_consent,  # Consent is NOT silently re-enabled
            "cleared_memories": cleared_memories,
            "cleared_conversation": cleared_conversation,
            "message": "Conversational memory reset completed successfully.",
        }
