import asyncio
from types import SimpleNamespace

from app.ai.memory.meko_memory import MekoMemoryProvider


class ContractClient:
    available = True

    def __init__(self):
        self.calls = []

    async def call_tool(self, name, arguments):
        self.calls.append((name, arguments))
        if name == "conversation_create":
            return SimpleNamespace(structuredContent={"id": "conversation-contract-test"})
        if name in ("context_search", "memory_search"):
            return SimpleNamespace(structuredContent={"results": []})
        return SimpleNamespace(structuredContent={"success": True})


def test_recall_creates_required_conversation_when_none_is_supplied():
    client = ContractClient()
    provider = MekoMemoryProvider(client, agent_id="medeasy:test")

    result = asyncio.run(provider.recall("project preferences"))

    assert result.items == []
    assert [call[0] for call in client.calls] == ["conversation_create", "context_search", "memory_search"]
    assert client.calls[1][1]["conversation_id"] == "conversation-contract-test"
    assert client.calls[1][1]["query"] == "project preferences"
    assert client.calls[2][1]["conversation_id"] == "conversation-contract-test"


def test_memory_add_includes_required_conversation_even_without_one_supplied():
    client = ContractClient()
    provider = MekoMemoryProvider(client, agent_id="medeasy:test")

    asyncio.run(provider.remember("User preference: concise answers"))

    assert [call[0] for call in client.calls] == ["conversation_create", "memory_add"]
    assert client.calls[1][1]["conversation_id"] == "conversation-contract-test"
    assert client.calls[1][1]["text"] == "User preference: concise answers"


def test_memory_reset_adds_required_conversation_id():
    client = ContractClient()
    provider = MekoMemoryProvider(client, agent_id="medeasy:test")

    asyncio.run(provider.forget_all())

    assert [call[0] for call in client.calls] == ["conversation_create", "memory_delete_all"]
    assert client.calls[1][1]["conversation_id"] == "conversation-contract-test"
