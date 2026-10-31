from abc import ABC, abstractmethod
from typing import Any

from app.ai.memory.memory_models import MemoryContext


class MemoryProvider(ABC):
    @abstractmethod
    async def recall(self, query: str, conversation_id: str | None = None) -> MemoryContext:
        raise NotImplementedError

    @abstractmethod
    async def remember(self, text: str, conversation_id: str | None = None) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def update(self, memory_id: str, text: str, conversation_id: str | None = None) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def forget(self, memory_id: str, conversation_id: str | None = None) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def log_turn(
        self,
        user_text: str,
        assistant_text: str,
        session_id: str,
        conversation_id: str | None = None,
    ) -> str:
        raise NotImplementedError
