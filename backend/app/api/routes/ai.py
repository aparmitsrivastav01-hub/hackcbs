import asyncio
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.ai.guardrails.safety_guardrails import AISafetyGuardrail
from app.ai.memory.meko_memory import HISTORY_QUERY
from app.models.ai_schemas import AIChatRequest, AIChatResponse
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiRateLimitError,
    GeminiService,
    GeminiTimeoutError,
    TemporaryChatSessions,
)
from app.services.meko_service import DEFAULT_PATIENT_ID, MekoService, extract_rememberable_preference
from app.services.price_service import compare_prices
from app.services.search_service import search_rows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI assistant"])
QUERY_FILLERS = {
    "what", "is", "the", "price", "cost", "of", "for", "a", "an", "my", "me", "please",
    "tell", "show", "find", "how", "much", "medicine", "medicines", "tablet", "tablets", "drug",
    "dawa", "dawai", "ki", "ka", "ke", "hai", "hain", "mujhe", "chahiye", "daam", "कीमत", "दाम",
}


def _sessions(request: Request) -> TemporaryChatSessions:
    return request.app.state.ai_chat_sessions


def _gemini(request: Request) -> GeminiService:
    return request.app.state.gemini_service


def _meko(request: Request) -> MekoService | None:
    return getattr(request.app.state, "meko_service", None)


def _catalogue_context(message: str, medicine_service: Any) -> str:
    tokens = [token for token in re.findall(r"[\w.+%-]+", message) if token.casefold() not in QUERY_FILLERS]
    query = " ".join(tokens).strip()
    if len(query) < 3:
        return ""
    matches = search_rows(query, medicine_service.all())[:5]
    if not matches:
        return ""
    entries = []
    for row in matches:
        prices = compare_prices(row)["prices"]
        entries.append(
            f'- {row.get("brand_name")}; active salt: {row.get("active_salt")}; form: {row.get("dosage_form")}; '
            f'private brand price: {prices["private_brand"]}; Jan Aushadhi price: {prices["jan_aushadhi"]}; '
            f'Dava India price: {prices["dava_india"]}'
        )
    return "\n".join(entries)


def _provider_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, GeminiConfigurationError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, GeminiTimeoutError):
        return HTTPException(status_code=504, detail=str(exc))
    if isinstance(exc, GeminiRateLimitError):
        return HTTPException(status_code=429, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/chat", response_model=AIChatResponse)
async def chat(request: Request, body: AIChatRequest):
    sessions = _sessions(request)
    session_id, session = sessions.acquire(body.session_id)
    service = _gemini(request)
    medicine_service = request.app.state.medicine_service
    catalogue_context = _catalogue_context(body.message, medicine_service)
    meko = _meko(request)

    # 1. Resolve consistent synthetic patient ID
    pid = body.patient_id or getattr(session, "patient_id", None) or DEFAULT_PATIENT_ID
    session.patient_id = pid

    # 2. Check explicit consent status
    is_consented = meko.is_consented(pid) if meko is not None else False
    logger.info(
        "Chat turn starting session_id=%s patient_id=%s consent=%s meko_available=%s",
        session_id, pid, is_consented, getattr(meko, "is_available", False)
    )

    # 3. Deterministic Meko memory retrieval:
    # - Zero calls if consent is OFF or Meko is unconfigured/unavailable.
    # - If consented: ensure conversation_create runs first, then recall.
    # - Cache retrieved context in session to avoid redundant calls.
    memory_context = ""
    if is_consented and meko is not None:
        if not getattr(session, "meko_conversation_id", None):
            try:
                conv_id = await meko.create_conversation(session_id=session_id, patient_id=pid)
                if conv_id:
                    session.meko_conversation_id = conv_id
                    logger.info("Created and retained Meko conversation_id=%s for session=%s", conv_id, session_id)
            except Exception as exc:
                logger.warning("Meko create_conversation failed on session start: %s", type(exc).__name__)

        needs_search = (not getattr(session, "memory_searched", False)) or bool(HISTORY_QUERY.search(body.message))
        if needs_search and getattr(session, "meko_conversation_id", None):
            try:
                retrieved = await meko.recall(
                    body.message.strip(),
                    conversation_id=session.meko_conversation_id,
                    patient_id=pid,
                )
                session.retrieved_memory_context = retrieved.as_unverified_prompt_context()
                session.memory_searched = True
                logger.info("Meko context recall completed for session=%s items_found=%d", session_id, len(retrieved.items))
            except Exception as exc:
                logger.warning("Meko memory recall failed (fail-open): %s", type(exc).__name__)
        memory_context = getattr(session, "retrieved_memory_context", "") or ""

    def _log_turn_background(user_text: str, assistant_text: str) -> asyncio.Task | None:
        if meko is None or not meko.is_consented(pid):
            return None

        async def _worker() -> None:
            try:
                conv_id = await meko.log_turn(
                    user_text=user_text,
                    assistant_text=assistant_text,
                    session_id=session_id,
                    conversation_id=getattr(session, "meko_conversation_id", None),
                    patient_id=pid,
                )
                if conv_id and not getattr(session, "meko_conversation_id", None):
                    session.meko_conversation_id = conv_id

                pref = extract_rememberable_preference(user_text)
                if pref:
                    logger.info("Logging memory preference for session=%s: %s", session_id, pref)
                    res = await meko.remember(
                        pref,
                        conversation_id=getattr(session, "meko_conversation_id", None),
                        patient_id=pid,
                        session_id=session_id,
                    )
                    logger.info("Meko preference memory saved: %s", res)
            except Exception as exc:
                logger.warning("Background Meko turn logging failed (fail-open): %s", type(exc).__name__)

        task = asyncio.create_task(_worker())
        _bg = getattr(request.app.state, "_background_tasks", None)
        if _bg is not None:
            _bg.add(task)
            task.add_done_callback(_bg.discard)
        return task

    # 4. Deterministic AI Safety Guardrail Checks
    guardrail_result = AISafetyGuardrail.check_emergency(body.message)
    guardrail_flag = "potential_emergency" if guardrail_result else None

    if not guardrail_result:
        guardrail_result = AISafetyGuardrail.check_prescription_or_diagnosis_demand(body.message, memory_context)
        if guardrail_result:
            guardrail_flag = "prescription_refusal"

    if guardrail_result:
        resp_text = guardrail_result.response_text(body.language)
        async with session.lock:
            sessions.add_turn(session, body.message.strip(), resp_text)
            _log_turn_background(body.message.strip(), resp_text)

        if not body.stream:
            return {
                "success": True,
                "session_id": session_id,
                "response": resp_text,
                "safety_flags": [guardrail_flag] if guardrail_flag else [],
                "usage": {"prompt_tokens": 0, "response_tokens": 0, "total_tokens": 0},
            }

        async def guardrail_stream():
            yield _sse({"type": "meta", "session_id": session_id})
            yield _sse({"type": "delta", "text": resp_text})
            yield _sse({
                "type": "done",
                "session_id": session_id,
                "response": resp_text,
                "safety_flags": [guardrail_flag] if guardrail_flag else [],
                "usage": {"prompt_tokens": 0, "response_tokens": 0, "total_tokens": 0},
            })

        return StreamingResponse(
            guardrail_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if not body.stream:
        async with session.lock:
            history = sessions.context(session)
            try:
                try:
                    result = await service.generate_chat(
                        history,
                        body.message.strip(),
                        body.language,
                        catalogue_context,
                        memory_context=memory_context,
                    )
                except TypeError:
                    result = await service.generate_chat(
                        history,
                        body.message.strip(),
                        body.language,
                        catalogue_context,
                    )
            except (GeminiConfigurationError, GeminiTimeoutError, GeminiRateLimitError, GeminiProviderError) as exc:
                raise _provider_http_error(exc) from exc

            result["response"] = AISafetyGuardrail.sanitize_llm_response(result["response"], body.language)
            sessions.add_turn(session, body.message.strip(), result["response"])
            _log_turn_background(body.message.strip(), result["response"])
            return {"success": True, "session_id": session_id, **result}

    # Fail with a real HTTP status before starting SSE if the credential is missing.
    if not getattr(service, "api_key", None):
        raise HTTPException(status_code=503, detail="Gemini is not configured; set GEMINI_API_KEY in the backend environment")

    async def event_stream():
        async with session.lock:
            history = sessions.context(session)
            queue: asyncio.Queue[str] = asyncio.Queue()

            async def on_chunk(text: str) -> None:
                await queue.put(_sse({"type": "delta", "text": text}))

            try:
                task = asyncio.create_task(
                    service.generate_chat(
                        history,
                        body.message.strip(),
                        body.language,
                        catalogue_context,
                        memory_context=memory_context,
                        on_chunk=on_chunk,
                    )
                )
            except TypeError:
                task = asyncio.create_task(
                    service.generate_chat(
                        history,
                        body.message.strip(),
                        body.language,
                        catalogue_context,
                        on_chunk=on_chunk,
                    )
                )

            yield _sse({"type": "meta", "session_id": session_id})
            try:
                while not task.done() or not queue.empty():
                    try:
                        token_event = await asyncio.wait_for(queue.get(), timeout=0.2)
                        yield token_event
                    except asyncio.TimeoutError:
                        continue
                result = await task
                result["response"] = AISafetyGuardrail.sanitize_llm_response(result["response"], body.language)
                sessions.add_turn(session, body.message.strip(), result["response"])
                _log_turn_background(body.message.strip(), result["response"])
                yield _sse({"type": "done", "session_id": session_id, **result})
            except (GeminiConfigurationError, GeminiTimeoutError, GeminiRateLimitError, GeminiProviderError) as exc:
                status = 503 if isinstance(exc, GeminiConfigurationError) else 504 if isinstance(exc, GeminiTimeoutError) else 429 if isinstance(exc, GeminiRateLimitError) else 502
                error = {"type": "error", "status": status, "detail": str(exc)}
                logger.warning("Streaming Gemini chat failed (status=%s, error_type=%s)", status, type(exc).__name__)
                yield _sse(error)
            finally:
                if not task.done():
                    task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
