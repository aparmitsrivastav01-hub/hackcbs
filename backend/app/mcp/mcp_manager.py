from typing import Any

from app.mcp.mcp_client import MekoMCPClient
from app.mcp.mcp_config import MekoConfig


class MCPManager:
    """Manager wrapping Meko MCP lifecycle and operations."""

    def __init__(self, config: MekoConfig | None = None, client: MekoMCPClient | None = None) -> None:
        if client is not None:
            self.client = client
        else:
            self.client = MekoMCPClient(config or MekoConfig.from_environment())

    @property
    def available(self) -> bool:
        return self.client.available

    def discovered_tool_names(self) -> tuple[str, ...]:
        return self.client.registry.names()

    async def start(self) -> None:
        await self.client.start()

    async def close(self) -> None:
        await self.client.close()

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        return await self.client.call_tool(name, arguments)
