import asyncio
import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage

from app.ai.chains.healthcare_chain import HealthcareChain, chunk_text, token_usage
from app.ai.llm.gemini_provider import GeminiProvider, GeminiProviderConfigurationError
from app.ai.memory.memory_models import MemoryContext, MemoryContextItem
from app.ai.memory.meko_memory import MekoMemoryProvider
from app.mcp.mcp_client import MCPToolError, MekoMCPClient
from app.mcp.mcp_config import MekoConfig
from app.mcp.mcp_registry import MEKO_ALLOWED_TOOLS, ToolRegistry


class FakeRunnable:
    def __init__(self, result=None, chunks=None):
        self.result = result
        self.chunks = chunks or []
        self.inputs = None

    def __call__(self, inputs):
        self.inputs = inputs
        return self.result

    async def ainvoke(self, inputs):
        self.inputs = inputs
        return self.result

    async def astream(self, inputs):
        self.inputs = inputs
        for chunk in self.chunks:
            yield chunk


class FakeMCP:
    available = True

    def __init__(self, results):
        self.results = results
        self.calls = []

    async def call_tool(self, name, arguments):
        self.calls.append((name, arguments))
        result = self.results[name]
        if callable(result):
            return result(arguments)
        return result


def test_healthcare_chain_keeps_history_language_and_unverified_context_separate():
    runnable = FakeRunnable(result=AIMessage(content="Please clarify."))
    chain = HealthcareChain(runnable)

    asyncio.run(
        chain.ainvoke(
            history=[
                {"role": "user", "text": "I reported a rash."},
                {"role": "model", "text": "When did it start?"},
            ],
            message="It started yesterday.",
            language="hi",
            memory_context="Patient-reported rash, date unknown.",
        )
    )

    messages = runnable.inputs.to_messages()
    assert messages[0].content.endswith("Answer in Hindi.")
    assert len(messages) == 4
    assert isinstance(messages[1], HumanMessage)
    assert messages[1].content == "I reported a rash."
    assert isinstance(messages[2], AIMessage)
    assert messages[2].content == "When did it start?"
    assert "[Unverified Meko conversation context" in messages[3].content
    assert "Patient-reported rash, date unknown." in messages[3].content


def test_langchain_gemini_service_extracts_answer_and_usage_and_streams():
    chunk1 = AIMessageChunk(content="Hello ")
    chunk2 = AIMessageChunk(content="there!")
    assert chunk_text(chunk1) == "Hello "
    assert chunk_text(chunk2) == "there!"

    msg = AIMessage(
        content="Response",
        usage_metadata={"input_tokens": 12, "output_tokens": 7, "total_tokens": 19},
    )
    usage = token_usage(msg)
    assert usage["prompt_tokens"] == 12
    assert usage["response_tokens"] == 7
    assert usage["total_tokens"] == 19


def test_gemini_provider_requires_backend_key_and_uses_configured_model(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = GeminiProvider(api_key=None)
    with pytest.raises(GeminiProviderConfigurationError) as exc:
        _ = provider.chat_model
    assert "GEMINI_API_KEY" in str(exc.value)

    provider2 = GeminiProvider(api_key="test-key", model="gemini-custom")
    assert provider2.model_name == "gemini-custom"
    assert provider2.api_key == "test-key"


def test_mcp_registry_keeps_only_discovered_approved_tools():
    class DummyTool:
        def __init__(self, name, schema):
            self.name = name
            self.inputSchema = schema

    tools = [
        DummyTool("context_search", {"type": "object", "properties": {"query": {"type": "string"}}}),
        DummyTool("memory_add", {"type": "object", "properties": {"text": {"type": "string"}}}),
        DummyTool("forbidden_tool", {"type": "object"}),
    ]
    registry = ToolRegistry()
    registry.load(tools)
    names = registry.names()
    assert "context_search" in names
    assert "memory_add" in names
    assert "forbidden_tool" not in names
    for name in names:
        assert name in MEKO_ALLOWED_TOOLS


def test_mcp_tool_calls_validate_discovered_schema_and_inject_datapack():
    class DummyTool:
        def __init__(self, name, schema):
            self.name = name
            self.inputSchema = schema

    config = MekoConfig(api_key="key", datapack_id="dp-123", enabled=True, demo_memory_enabled=True)
    client = MekoMCPClient(config=config)
    client.available = True
    client.registry.load([
        DummyTool(
            "context_search",
            {
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string"},
                    "datapack_id": {"type": "string"},
                },
            },
        )
    ])

    captured = {}

    class DummySession:
        async def call_tool(self, name, arguments):
            captured["name"] = name
            captured["args"] = arguments
            return {"content": [{"type": "text", "text": "{\"results\": []}"}]}

    client._session = DummySession()

    asyncio.run(client.call_tool("context_search", {"query": "allergies"}))
    assert captured["name"] == "context_search"
    assert captured["args"]["query"] == "allergies"
    assert captured["args"]["datapack_id"] == "dp-123"

    with pytest.raises(MCPToolError):
        asyncio.run(client.call_tool("context_search", {}))  # Missing required query


def test_mcp_startup_connection_failure_is_graceful():
    config = MekoConfig(api_key="bad-key", datapack_id="dp-123", mcp_url="http://invalid-host-xyz:9999/mcp")
    client = MekoMCPClient(config=config)

    async def fail_transport(*args, **kwargs):
        raise ConnectionError("Connection refused")

    client._transport_factory = fail_transport
    asyncio.run(client.start())
    assert client.available is False


def test_meko_memory_correction_and_deletion_use_application_only_tools():
    fake = FakeMCP({
        "memory_update": {"structuredContent": {"success": True, "updated": True}},
        "memory_delete_by_id": {"structuredContent": {"success": True, "deleted": True}},
        "memory_delete_all": {"structuredContent": {"success": True, "cleared": True}},
        "conversation_delete": {"structuredContent": {"success": True, "conversation_deleted": True}},
    })
    provider = MekoMemoryProvider(fake, agent_id="agent-test")

    res_up = asyncio.run(provider.update("mem-1", "Updated text", conversation_id="conv-1"))
    assert res_up == {"success": True, "updated": True}
    assert ("memory_update", {"memory_id": "mem-1", "text": "Updated text", "agent_id": "agent-test", "conversation_id": "conv-1"}) in fake.calls

    res_del = asyncio.run(provider.forget("mem-1", conversation_id="conv-1"))
    assert res_del == {"success": True, "deleted": True}
    assert ("memory_delete_by_id", {"memory_id": "mem-1", "agent_id": "agent-test", "conversation_id": "conv-1"}) in fake.calls

    res_del_all = asyncio.run(provider.forget_all(conversation_id="conv-1"))
    assert res_del_all == {"success": True, "cleared": True}

    res_del_conv = asyncio.run(provider.delete_conversation("conv-1"))
    assert res_del_conv == {"success": True, "conversation_deleted": True}


def test_meko_memory_retrieval_is_always_labeled_unverified_and_logs_turns():
    fake = FakeMCP({
        "context_search": {
            "structuredContent": {
                "memories": [
                    {
                        "text": "User reported mild asthma in childhood",
                        "classification": "patient_reported",
                        "source_date": "2026-01-10",
                    }
                ]
            }
        },
        "conversation_create": {"structuredContent": {"conversation_id": "conv-new-123"}},
        "conversation_add_message": {"structuredContent": {"status": "recorded"}},
    })
    provider = MekoMemoryProvider(fake, agent_id="patient-1")

    context = asyncio.run(provider.recall("asthma symptoms"))
    assert len(context.items) == 1
    item = context.items[0]
    assert item.verified is False
    assert item.classification == "patient_reported"
    prompt_line = item.prompt_line()
    assert "[patient_reported; unverified; source date: 2026-01-10]" in prompt_line
    assert "User reported mild asthma in childhood" in prompt_line

    conv_id = asyncio.run(
        provider.log_turn("I had an asthma attack", "Please consult your doctor immediately", session_id="sess-1")
    )
    assert conv_id == "conv-new-123"
    assert any(call[0] == "conversation_create" for call in fake.calls)
    assert any(call[0] == "conversation_add_message" for call in fake.calls)


def test_memory_context_items_default_unknown_and_unverified():
    item = MemoryContextItem(text="Some unverified statement")
    assert item.verified is False
    assert item.classification == "unknown"
    assert item.source == "meko"
    assert "[unknown; unverified]" in item.prompt_line()


def test_meko_memory_requires_explicit_demo_mode_and_credentials(monkeypatch):
    monkeypatch.setenv("MEKO_ENABLED", "true")
    monkeypatch.setenv("MEKO_API_KEY", "")
    monkeypatch.setenv("MEKO_DATAPACK_ID", "")
    monkeypatch.setenv("MEKO_ENABLE_DEMO_MEMORY", "true")
    cfg = MekoConfig.from_environment()
    assert cfg.ready is False

    monkeypatch.setenv("MEKO_API_KEY", "real-key")
    monkeypatch.setenv("MEKO_DATAPACK_ID", "real-datapack")
    cfg_ready = MekoConfig.from_environment()
    assert cfg_ready.ready is True
