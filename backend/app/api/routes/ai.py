import asyncio
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.models.ai_schemas import AIChatRequest, AIChatResponse
from app.services.price_service import compare_prices
from app.services.search_service import search_rows
from app.services.gemini_service import (
    GeminiConfigurationError,
    GeminiProviderError,
    GeminiRateLimitError,
    GeminiService,
    GeminiTimeoutError,
    TemporaryChatSessions,
)

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

    if not body.stream:
        async with session.lock:
            history = sessions.context(session)
            try:
                result = await service.generate_chat(history, body.message.strip(), body.language, catalogue_context)
            except (GeminiConfigurationError, GeminiTimeoutError, GeminiRateLimitError, GeminiProviderError) as exc:
                raise _provider_http_error(exc) from exc
            sessions.add_turn(session, body.message.strip(), result["response"])
            return {"success": True, "session_id": session_id, **result}

    # Fail with a real HTTP status before starting SSE if the credential is missing.
    if not service.api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured; set GEMINI_API_KEY in the backend environment")

    async def event_stream():
        async with session.lock:
            history = sessions.context(session)
            queue: asyncio.Queue[str] = asyncio.Queue()

            async def on_chunk(text: str) -> None:
                await queue.put(_sse({"type": "delta", "text": text}))

            task = asyncio.create_task(
                service.generate_chat(history, body.message.strip(), body.language, catalogue_context, on_chunk=on_chunk)
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
                sessions.add_turn(session, body.message.strip(), result["response"])
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
