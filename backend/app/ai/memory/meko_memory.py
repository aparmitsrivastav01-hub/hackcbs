import json
import logging
import re
from typing import Any

from app.ai.memory.memory_models import MemoryContext, MemoryContextItem
from app.ai.memory.memory_provider import MemoryProvider

logger = logging.getLogger(__name__)

DEMO_AGENT_ID = "medeasy-synthetic-demo"

# Comprehensive regex detecting history, preferences, and clinical/symptom/health inquiries
HISTORY_QUERY = re.compile(
    r"\b("
    r"previous|last\s+time|history|earlier|before|allerg(?:y|ies)|"
    r"medication(?:s)?|medicine(?:s)?|prescription(?:s)?|"
    r"remember|what\s+did\s+i\s+tell|what\s+did\s+i\s+say|recall|preference|"
    r"symptom(?:s)?|illness(?:es)?|disease(?:s)?|condition(?:s)?|diagnosis|"
    r"fever|sick|problem|complaint(?:s)?|pain|cough|"
    r"what\s+do\s+i\s+have|what\s+illness|what\s+disease|what\s+condition|"
    r"what\s+is\s+wrong(?:\s+with\s+me)?|am\s+i\s+sick|"
    r"tabiyat|bimar(?:i)?|dard|takleef|kya\s+hua\s+hai"
    r")\b",
    re.I,
)

# Specific pattern to identify health status, symptom, or illness inquiries
HEALTH_INQUIRY_PATTERN = re.compile(
    r"\b("
    r"symptom(?:s)?|illness(?:es)?|disease(?:s)?|condition(?:s)?|diagnosis|"
    r"fever|sick|pain|cough|headache|ache|complaint(?:s)?|health|medical|"
    r"what\s+do\s+i\s+have|what\s+illness|what\s+disease|what\s+condition|"
    r"what\s+is\s+wrong(?:\s+with\s+me)?|am\s+i\s+sick|what\s+symptoms|bimar(?:i)?|tabiyat"
    r")\b",
    re.I,
)

# Pattern to identify health/clinical keywords inside retrieved memory text
HEALTH_KEYWORDS_PATTERN = re.compile(
    r"\b(fever|symptom|illness|disease|condition|pain|cough|headache|ache|temperature|medication|medicine|allergy|allergies|diagnos|treatment|health|sick|infection|bimar|dard)\b",
    re.I,
)


def _clean_date(d: Any) -> str | None:
    if not d or not isinstance(d, str):
        return None
    cleaned = d.strip()
    if "T" in cleaned:
        return cleaned.split("T")[0]
    return cleaned[:10] if len(cleaned) >= 10 else cleaned


def _result_payload(result: Any) -> Any:
    # 1. Structured content unwrapping
    structured = getattr(result, "structuredContent", None)
    if structured is not None:
        if isinstance(structured, dict) and "result" in structured and isinstance(structured["result"], str):
            try:
                return json.loads(structured["result"])
            except Exception:
                pass
        return structured

    if isinstance(result, dict):
        if "structuredContent" in result:
            s = result["structuredContent"]
            if isinstance(s, dict) and "result" in s and isinstance(s["result"], str):
                try:
                    return json.loads(s["result"])
                except Exception:
                    pass
            return s
        if "result" in result and isinstance(result["result"], str):
            try:
                return json.loads(result["result"])
            except Exception:
                pass
        return result

    # 2. Text content unwrapping
    output = []
    content = getattr(result, "content", []) or []
    for item in content:
        text = getattr(item, "text", None)
        if text:
            try:
                output.append(json.loads(text))
            except (ValueError, TypeError):
                output.append(text)
    if len(output) == 1:
        return output[0]
    return output


def _memory_items(payload: Any) -> list[MemoryContextItem]:
    candidates: list[Any] = []
    if isinstance(payload, dict):
        # 1. Unpack structured 'results' container (from context_search or memory_search)
        res = payload.get("results")
        if isinstance(res, list):
            candidates.extend(res)
        elif isinstance(res, dict):
            for k in ("memory", "memories", "knowledge_base"):
                val = res.get(k)
                if isinstance(val, list):
                    candidates.extend(val)
                elif isinstance(val, dict):
                    candidates.append(val)
            conv = res.get("conversation")
            if isinstance(conv, dict):
                for ck in ("hits", "thread"):
                    cval = conv.get(ck)
                    if isinstance(cval, list):
                        candidates.extend(cval)
            elif isinstance(conv, list):
                candidates.extend(conv)

        # 2. Check top-level buckets
        for bucket in ("memory", "memories", "knowledge_base", "items"):
            val = payload.get(bucket)
            if isinstance(val, list):
                candidates.extend(val)
            elif isinstance(val, dict):
                candidates.append(val)

        if not candidates and ("text" in payload or "memory" in payload or "content" in payload):
            candidates.append(payload)
    elif isinstance(payload, list):
        for nested in payload:
            candidates.extend(_memory_items(nested))

    items: list[MemoryContextItem] = []
    for item in candidates:
        if isinstance(item, str):
            text = item.strip()
            metadata = {}
        elif isinstance(item, dict):
            raw_text = item.get("text") or item.get("memory") or item.get("content") or ""
            if isinstance(raw_text, str):
                text = raw_text.strip()
            elif isinstance(raw_text, dict):
                text = str(raw_text.get("text") or raw_text.get("memory") or raw_text.get("content") or "").strip()
            else:
                continue
            metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        else:
            continue

        if not text:
            continue

        # Filter out assistant refusals / canned disclaimers from conversation traces
        if "I cannot diagnose medical conditions" in text or "As an AI, I cannot" in text:
            continue

        raw_cls = (
            metadata.get("classification")
            or metadata.get("provenance")
            or item.get("classification")
            or item.get("provenance")
            or ""
        )
        classification = str(raw_cls).lower() if raw_cls else ""
        if classification not in {"verified", "clinically_documented", "ai_inferred", "patient_reported"}:
            classification = "patient_reported"

        raw_date = (
            metadata.get("source_date")
            or metadata.get("date")
            or item.get("source_date")
            or item.get("created_at")
        )
        source_date = _clean_date(raw_date)
        ref = str(metadata.get("id") or metadata.get("memory_id") or item.get("id") or item.get("memory_id") or "") or None

        items.append(
            MemoryContextItem(
                text=text[:2000],
                source=str(metadata.get("source") or item.get("source") or "Meko conversational memory"),
                classification=classification,
                verified=False,
                source_date=source_date,
                reference=ref,
            )
        )
    return items


class MekoMemoryProvider(MemoryProvider):
    """Memory provider backed by Meko MCP tools."""

    def __init__(self, client: Any, agent_id: str = DEMO_AGENT_ID) -> None:
        self.client = client
        self.agent_id = agent_id

    @property
    def available(self) -> bool:
        return bool(self.client and getattr(self.client, "available", False))

    async def recall(self, query: str, conversation_id: str | None = None) -> MemoryContext:
        args: dict[str, Any] = {"query": query, "agent_id": self.agent_id, "limit": 5}
        if conversation_id:
            args["conversation_id"] = str(conversation_id)

        items: list[MemoryContextItem] = []
        try:
            context_result = await self.client.call_tool("context_search", args)
            context_payload = _result_payload(context_result)
            found = _memory_items(context_payload)
            items.extend(found)
            logger.info("Meko context_search returned %d items", len(found))
        except Exception as exc:
            logger.warning("Meko context_search failed (fail-open): %s", type(exc).__name__)

        is_health_query = bool(HEALTH_INQUIRY_PATTERN.search(query))
        is_history_query = bool(HISTORY_QUERY.search(query))

        if is_health_query or is_history_query or not items:
            memory_args: dict[str, Any] = {"query": query, "agent_id": self.agent_id, "limit": 5}
            if conversation_id:
                memory_args["conversation_id"] = str(conversation_id)
            try:
                memory_result = await self.client.call_tool("memory_search", memory_args)
                memory_payload = _result_payload(memory_result)
                found_mem = _memory_items(memory_payload)
                items.extend(found_mem)
                logger.info("Meko memory_search returned %d items", len(found_mem))
            except Exception as exc:
                logger.warning("Meko memory_search failed (fail-open): %s", type(exc).__name__)

            # If user asks about illness/symptoms/health, ensure health memories are retrieved
            # even if verbatim query embedding didn't rank symptoms in the top results
            has_health_items = any(HEALTH_KEYWORDS_PATTERN.search(it.text) for it in items)
            if is_health_query and not has_health_items:
                expanded_args: dict[str, Any] = {
                    "query": "patient reported symptoms fever illness health condition",
                    "agent_id": self.agent_id,
                    "limit": 5,
                }
                if conversation_id:
                    expanded_args["conversation_id"] = str(conversation_id)
                try:
                    expanded_result = await self.client.call_tool("memory_search", expanded_args)
                    expanded_payload = _result_payload(expanded_result)
                    found_exp = _memory_items(expanded_payload)
                    items.extend(found_exp)
                    logger.info("Meko health-expanded memory_search returned %d items", len(found_exp))
                except Exception as exc:
                    logger.warning("Meko health-expanded memory_search failed: %s", type(exc).__name__)

        # Relevance-aware sorting: prioritize health/symptom items for health queries
        if is_health_query:
            items.sort(key=lambda it: 0 if HEALTH_KEYWORDS_PATTERN.search(it.text) else 1)

        # Deduplicate items by text
        unique: dict[str, MemoryContextItem] = {}
        for item in items:
            unique.setdefault(item.text, item)

        return MemoryContext(items=list(unique.values())[:8])

    async def get_context(self, query: str, conversation_id: str | None = None) -> MemoryContext:
        return await self.recall(query, conversation_id=conversation_id)

    async def remember(self, text: str, conversation_id: str | None = None) -> Any:
        args: dict[str, Any] = {
            "text": text,
            "agent_id": self.agent_id,
            "metadata": json.dumps({
                "provenance": "patient_reported",
                "verification": "unverified",
            }),
        }
        if conversation_id:
            args["conversation_id"] = str(conversation_id)
        result = await self.client.call_tool("memory_add", args)
        return _result_payload(result)

    async def update(self, memory_id: str, text: str, conversation_id: str | None = None) -> Any:
        args: dict[str, Any] = {"memory_id": memory_id, "text": text, "agent_id": self.agent_id}
        if conversation_id:
            args["conversation_id"] = str(conversation_id)
        result = await self.client.call_tool("memory_update", args)
        return _result_payload(result)

    async def forget(self, memory_id: str, conversation_id: str | None = None) -> Any:
        args: dict[str, Any] = {"memory_id": memory_id, "agent_id": self.agent_id}
        if conversation_id:
            args["conversation_id"] = str(conversation_id)
        result = await self.client.call_tool("memory_delete_by_id", args)
        return _result_payload(result)

    async def forget_all(self, conversation_id: str | None = None) -> Any:
        args: dict[str, Any] = {"agent_id": self.agent_id}
        if conversation_id:
            args["conversation_id"] = str(conversation_id)
        result = await self.client.call_tool("memory_delete_all", args)
        return _result_payload(result)

    async def delete_conversation(self, conversation_id: str) -> Any:
        args = {"conversation_id": conversation_id, "agent_id": self.agent_id}
        result = await self.client.call_tool("conversation_delete", args)
        return _result_payload(result)

    async def log_turn(
        self,
        user_text: str,
        assistant_text: str,
        session_id: str,
        conversation_id: str | None = None,
    ) -> str:
        current_id = conversation_id
        if not current_id:
            created = await self.client.call_tool(
                "conversation_create",
                {
                    "agent_id": self.agent_id,
                    "session_id": session_id,
                    "title": "MedSaathi synthetic demo session",
                    "metadata": json.dumps({"data_classification": "synthetic_demo_only"}),
                },
            )
            payload = _result_payload(created)
            if isinstance(payload, dict):
                current_id = payload.get("id") or payload.get("conversation_id")
            elif isinstance(payload, list) and payload and isinstance(payload[0], dict):
                current_id = payload[0].get("id") or payload[0].get("conversation_id")

            if not current_id:
                raise RuntimeError("Meko conversation_create did not return a conversation ID")

        await self.client.call_tool(
            "conversation_add_message",
            {
                "conversation_id": str(current_id),
                "agent_id": self.agent_id,
                "input": user_text,
                "output": assistant_text,
                "metadata": json.dumps({"patient_context_unverified": True}),
            },
        )
        return str(current_id)
