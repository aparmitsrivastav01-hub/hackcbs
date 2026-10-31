import asyncio
from contextlib import AsyncExitStack
import logging
import time
from typing import Any

from jsonschema import ValidationError as JSONSchemaValidationError, validate as validate_json

from app.mcp.mcp_config import MekoConfig
from app.mcp.mcp_registry import ToolRegistry

logger = logging.getLogger(__name__)


class MCPUnavailableError(RuntimeError):
    pass


class MCPToolError(RuntimeError):
    pass


def _sanitize_args(args: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for k, v in args.items():
        if k in ("datapack_id", "conversation_id", "session_id", "agent_id", "memory_id", "limit"):
            sanitized[k] = v
        elif k in ("input", "output", "text", "query"):
            sanitized[k] = f"<{len(str(v))} chars>"
        elif k == "metadata":
            sanitized[k] = "<json_metadata>"
        else:
            sanitized[k] = "<redacted>"
    return sanitized


class MekoMCPClient:
    """Streamable HTTP client connecting to Meko's MCP endpoint."""

    def __init__(
        self,
        config: MekoConfig,
        session_factory: Any = None,
        transport_factory: Any = None,
    ) -> None:
        self.config = config
        self._session_factory = session_factory
        self._transport_factory = transport_factory
        self._exit_stack: AsyncExitStack | None = None
        self._session: Any = None
        self.registry = ToolRegistry()
        self.available = False
        self._call_lock = asyncio.Lock()

    async def start(self) -> None:
        if not self.config.ready:
            return

        session_factory = self._session_factory
        transport_factory = self._transport_factory

        if session_factory is None:
            from mcp import ClientSession
            session_factory = ClientSession
        if transport_factory is None:
            from mcp.client.streamable_http import streamablehttp_client
            transport_factory = streamablehttp_client

        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "User-Agent": "MedEasy/1.0 MCP client",
        }

        self._exit_stack = AsyncExitStack()
        try:
            streams = await self._exit_stack.enter_async_context(
                transport_factory(
                    self.config.mcp_url,
                    headers=headers,
                    timeout=self.config.timeout_conversation,
                    sse_read_timeout=self.config.timeout_memory_add,
                )
            )
            read_stream = streams[0]
            write_stream = streams[1]

            self._session = await self._exit_stack.enter_async_context(
                session_factory(read_stream, write_stream)
            )
            await self._session.initialize()
            response = await self._session.list_tools()
            tools = getattr(response, "tools", [])
            self.registry.load(tools)
            self.available = True
            logger.info("Meko MCP connected; discovered %d approved tools: %s", len(self.registry.names()), self.registry.names())
        except Exception as exc:
            self.available = False
            logger.warning("Meko MCP connection/discovery unavailable (error_type=%s)", type(exc).__name__)
            await self.close()

    async def close(self) -> None:
        self.available = False
        if self._exit_stack is not None:
            try:
                await self._exit_stack.aclose()
            except Exception as exc:
                logger.debug("Meko MCP transport close failed (error_type=%s)", type(exc).__name__)
            finally:
                self._exit_stack = None
                self._session = None

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        if not self.available or self._session is None:
            raise MCPUnavailableError("Meko MCP is not connected")

        descriptor = self.registry.get(name)
        if descriptor is None:
            raise MCPToolError(f"Meko tool is not discovered or not allowlisted: {name}")

        validated_arguments = dict(arguments)
        properties = descriptor.input_schema.get("properties", {})
        if "datapack_id" in properties and self.config.datapack_id:
            validated_arguments.setdefault("datapack_id", self.config.datapack_id)

        try:
            validate_json(instance=validated_arguments, schema=descriptor.input_schema)
        except JSONSchemaValidationError as exc:
            raise MCPToolError(f"Arguments do not match discovered schema for {name}: {exc.message}") from exc

        # Operation-specific timeouts
        if name == "memory_add":
            timeout = self.config.timeout_memory_add
        elif name in ("memory_search", "context_search"):
            timeout = self.config.timeout_memory_search
        else:
            timeout = self.config.timeout_conversation

        started = time.perf_counter()
        logger.info("Meko MCP invoking tool=%s args=%s", name, _sanitize_args(validated_arguments))
        try:
            async with self._call_lock:
                result = await asyncio.wait_for(
                    self._session.call_tool(name, validated_arguments),
                    timeout=timeout,
                )
        except TimeoutError as exc:
            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.warning("Meko MCP tool call timed out (tool=%s, timeout=%.1fs, duration_ms=%d)", name, timeout, duration_ms)
            raise MCPToolError(f"Meko tool timed out: {name}") from exc
        except Exception as exc:
            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.warning("Meko MCP tool call failed (tool=%s, duration_ms=%d, error_type=%s)", name, duration_ms, type(exc).__name__)
            raise MCPToolError(f"Meko tool failed: {name}") from exc

        duration_ms = int((time.perf_counter() - started) * 1000)

        if getattr(result, "isError", False):
            logger.warning("Meko MCP tool returned error flag (tool=%s, duration_ms=%d)", name, duration_ms)
            raise MCPToolError(f"Meko tool returned an error flag: {name}")

        # Detect tool-level error payload inside successful HTTP response
        content = getattr(result, "content", []) or []
        for item in content:
            t = getattr(item, "text", None)
            if t and isinstance(t, str) and '"error":' in t:
                try:
                    import json
                    parsed_err = json.loads(t)
                    if isinstance(parsed_err, dict) and "error" in parsed_err:
                        logger.warning(
                            "Meko MCP tool returned error payload (tool=%s, error=%s, duration_ms=%d)",
                            name, parsed_err["error"], duration_ms
                        )
                        raise MCPToolError(f"Meko tool returned error payload: {parsed_err['error']}")
                except json.JSONDecodeError:
                    pass

        logger.info("Meko MCP tool completed tool=%s status=success duration_ms=%d", name, duration_ms)
        return result
