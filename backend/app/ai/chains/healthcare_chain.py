from typing import Any
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.ai.prompts.healthcare_system_prompt import healthcare_system_prompt


def _as_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return ""


def _history_messages(history: list[dict[str, str]]) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for item in history:
        role = item.get("role")
        text = item.get("text", "")
        if not text:
            continue
        if role == "user":
            messages.append(HumanMessage(content=text))
        elif role in frozenset({"assistant", "model"}):
            messages.append(AIMessage(content=text))
    return messages


class HealthcareChain:
    """LangChain pipeline formatting unverified Meko context, history, and Gemini chat."""

    def __init__(self, chat_model: Any) -> None:
        prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{message}"),
        ])
        self.chain = prompt | chat_model

    def _inputs(
        self,
        history: list[dict[str, str]],
        message: str,
        language: str,
        catalogue_context: str = "",
        memory_context: str = "",
    ) -> dict[str, Any]:
        current_message = message
        if catalogue_context:
            current_message += (
                "\n\n[MedEasy catalogue context; authoritative only for listed product fields and prices]\n"
                + catalogue_context
            )
        if memory_context:
            current_message += (
                "\n\n[Unverified Meko conversation context; treat as patient-reported or unknown, never as a verified clinical record]\n"
                + memory_context
            )
        return {
            "system_prompt": healthcare_system_prompt(language),
            "history": _history_messages(history),
            "message": current_message,
        }

    async def ainvoke(
        self,
        history: list[dict[str, str]],
        message: str,
        language: str,
        catalogue_context: str = "",
        memory_context: str = "",
    ) -> Any:
        return await self.chain.ainvoke(
            self._inputs(history, message, language, catalogue_context, memory_context)
        )

    async def astream(
        self,
        history: list[dict[str, str]],
        message: str,
        language: str,
        catalogue_context: str = "",
        memory_context: str = "",
    ):
        async for chunk in self.chain.astream(
            self._inputs(history, message, language, catalogue_context, memory_context)
        ):
            yield chunk


def chunk_text(chunk: Any) -> str:
    if isinstance(chunk, (AIMessage, AIMessageChunk)):
        return _as_text(chunk.content)
    return _as_text(getattr(chunk, "content", chunk))


def token_usage(message: Any) -> dict[str, int | None]:
    usage = getattr(message, "usage_metadata", None) or {}
    if not isinstance(usage, dict):
        usage = {}
    return {
        "prompt_tokens": usage.get("input_tokens"),
        "response_tokens": usage.get("output_tokens"),
        "total_tokens": usage.get("total_tokens"),
    }
