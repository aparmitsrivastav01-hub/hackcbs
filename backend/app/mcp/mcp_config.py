import os
from dataclasses import dataclass

DEFAULT_MEKO_MCP_URL = "https://mcp.mekodata.ai/mcp"


@dataclass(frozen=True)
class MekoConfig:
    api_key: str
    datapack_id: str
    mcp_url: str = DEFAULT_MEKO_MCP_URL
    enabled: bool = True
    timeout_memory_add: float = 40.0
    timeout_memory_search: float = 20.0
    timeout_conversation: float = 15.0
    consent_default: bool = False
    demo_memory_enabled: bool = True

    @classmethod
    def from_environment(cls) -> "MekoConfig":
        raw_enabled = os.getenv("MEKO_ENABLED", "true").casefold() in {"1", "true", "yes"}
        raw_demo = os.getenv("MEKO_ENABLE_DEMO_MEMORY", "true").casefold() in {"1", "true", "yes"}
        consent_default = os.getenv("MEKO_CONSENT_DEFAULT", "false").casefold() in {"1", "true", "yes"}
        return cls(
            api_key=os.getenv("MEKO_API_KEY", "").strip(),
            datapack_id=os.getenv("MEKO_DATAPACK_ID", "").strip(),
            mcp_url=os.getenv("MEKO_MCP_URL", DEFAULT_MEKO_MCP_URL).strip() or DEFAULT_MEKO_MCP_URL,
            enabled=raw_enabled,
            timeout_memory_add=float(os.getenv("MEKO_TIMEOUT_MEMORY_ADD", "40")),
            timeout_memory_search=float(os.getenv("MEKO_TIMEOUT_MEMORY_SEARCH", "20")),
            timeout_conversation=float(os.getenv("MEKO_TIMEOUT_CONVERSATION", "15")),
            consent_default=consent_default,
            demo_memory_enabled=raw_demo,
        )

    @property
    def ready(self) -> bool:
        return bool(self.api_key and self.datapack_id and self.enabled and self.demo_memory_enabled)
