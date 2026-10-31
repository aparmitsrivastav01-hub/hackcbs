from dataclasses import dataclass
from typing import Any

MEKO_ALLOWED_TOOLS = frozenset({
    "context_search",
    "conversation_create",
    "conversation_add_message",
    "memory_add",
    "memory_search",
    "memory_update",
    "memory_delete_by_id",
    "memory_delete_all",
    "conversation_delete",
})


@dataclass(frozen=True)
class DiscoveredTool:
    name: str
    input_schema: dict[str, Any]


class ToolRegistry:
    """Registry keeping only discovered tools that match MedEasy's approved Meko allowlist."""

    def __init__(self) -> None:
        self._tools: dict[str, DiscoveredTool] = {}

    def load(self, tools: Any) -> None:
        discovered: dict[str, DiscoveredTool] = {}
        for tool in tools or []:
            name = getattr(tool, "name", None)
            schema = getattr(tool, "inputSchema", None)
            if schema is None:
                schema = getattr(tool, "input_schema", None)
            if name in MEKO_ALLOWED_TOOLS and isinstance(schema, dict):
                discovered[name] = DiscoveredTool(name=name, input_schema=schema)
        self._tools = discovered

    def get(self, name: str) -> DiscoveredTool | None:
        return self._tools.get(name)

    def names(self) -> tuple[str, ...]:
        return tuple(sorted(self._tools.keys()))
