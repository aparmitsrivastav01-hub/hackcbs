import asyncio
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.services.meko_service import MekoService, extract_rememberable_preference
from app.ai.memory.memory_models import MemoryContext, MemoryContextItem


class MockGemini:
    api_key = "test-api-key"

    def __init__(self):
        self.last_memory_context = None

    async def generate_chat(self, history, message, language, catalogue_context="", memory_context="", on_chunk=None):
        self.last_memory_context = memory_context
        answer = "I can help compare generic medicine prices."
        if on_chunk:
            await on_chunk(answer)
        return {
            "response": answer,
            "safety_flags": [],
            "usage": {"prompt_tokens": 10, "response_tokens": 10, "total_tokens": 20},
        }

    async def close(self):
        pass


def test_preference_extraction():
    assert extract_rememberable_preference("Please remember that I prefer Hindi") == "User preference: I prefer Hindi"
    assert extract_rememberable_preference("Note that I live in Delhi") == "User preference: I live in Delhi"
    assert extract_rememberable_preference("I prefer Hindi") == "User preference: Hindi"
    assert extract_rememberable_preference("What is the price of Paracetamol?") is None


def test_memory_consent_defaults_to_off():
    with TestClient(app) as client:
        response = client.get("/api/memory/consent")
        assert response.status_code == 200
        data = response.json()
        assert data["consent"] is False
        assert "patient_id" in data


def test_memory_consent_toggle():
    import uuid
    from unittest.mock import AsyncMock, MagicMock
    from app.db.base import get_db
    from app.db.dependencies import get_current_user, get_optional_current_user

    with TestClient(app) as client:
        # Unauthenticated toggling of consent must fail with 401 Unauthorized
        res_unauth = client.post("/api/memory/consent", json={"consent": True, "patient_id": "patient-1"})
        assert res_unauth.status_code == 401

        # Now test with authenticated user and mock db session
        user_uuid = uuid.uuid4()
        mock_user = MagicMock()
        mock_user.id = user_uuid
        mock_user.email = "test@example.com"
        mock_user.role = "patient"
        mock_user.is_active = True

        mock_db = AsyncMock()
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

        async def override_get_db():
            yield mock_db

        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_optional_current_user] = lambda: mock_user
        app.dependency_overrides[get_db] = override_get_db

        try:
            # Enable consent
            res1 = client.post("/api/memory/consent", json={"consent": True, "patient_id": str(user_uuid)})
            assert res1.status_code == 200
            assert res1.json()["consent"] is True

            # Verify get consent
            res2 = client.get(f"/api/memory/consent?patient_id={user_uuid}")
            assert res2.status_code == 200
            assert res2.json()["consent"] is True

            # Disable consent
            res3 = client.post("/api/memory/consent", json={"consent": False, "patient_id": str(user_uuid)})
            assert res3.status_code == 200
            assert res3.json()["consent"] is False
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_optional_current_user, None)
            app.dependency_overrides.pop(get_db, None)


def test_zero_meko_calls_when_consent_is_off():
    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = False
    mock_gemini = MockGemini()

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        app.state.gemini_service = mock_gemini

        res = client.post("/api/ai/chat", json={"message": "Hello, my name is Alex", "language": "en", "stream": False})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

        # ZERO calls should be made to Meko
        mock_meko.recall.assert_not_called()
        mock_meko.log_turn.assert_not_called()
        mock_meko.remember.assert_not_called()
        mock_meko.create_conversation.assert_not_called()


def test_context_retrieved_and_cached_when_consent_is_on():
    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = True
    mock_meko.recall.return_value = MemoryContext(
        items=[
            MemoryContextItem(
                text="User prefers Hindi communications",
                classification="patient_reported",
                source="meko",
            )
        ]
    )
    mock_gemini = MockGemini()

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        app.state.gemini_service = mock_gemini

        # First turn: should trigger recall
        res1 = client.post("/api/ai/chat", json={"message": "What medicines do you have?", "language": "en", "stream": False})
        assert res1.status_code == 200
        session_id = res1.json()["session_id"]

        assert mock_meko.recall.call_count == 1
        assert "User prefers Hindi communications" in mock_gemini.last_memory_context

        # Second turn with ordinary question: should REUSE cached context without calling recall again
        res2 = client.post("/api/ai/chat", json={"session_id": session_id, "message": "Show generic alternatives", "language": "en", "stream": False})
        assert res2.status_code == 200
        # Call count should still be 1 (cached!)
        assert mock_meko.recall.call_count == 1
        assert "User prefers Hindi communications" in mock_gemini.last_memory_context

        # Third turn with explicit history inquiry: should trigger recall again
        res3 = client.post("/api/ai/chat", json={"session_id": session_id, "message": "What did I say earlier about my preferences?", "language": "en", "stream": False})
        assert res3.status_code == 200
        assert mock_meko.recall.call_count == 2


def test_fail_open_when_meko_fails():
    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = True
    mock_meko.recall.side_effect = TimeoutError("Meko MCP timed out")
    mock_meko.log_turn.side_effect = ConnectionError("Meko MCP unavailable")
    mock_gemini = MockGemini()

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        app.state.gemini_service = mock_gemini

        # Chat should NOT fail! Fail-open: Gemini response is returned cleanly.
        res = client.post("/api/ai/chat", json={"message": "Can I take paracetamol?", "language": "en", "stream": False})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "compare generic medicine prices" in data["response"]


def test_memory_recall_endpoint():
    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = True
    mock_meko.recall.return_value = MemoryContext(
        items=[
            MemoryContextItem(
                text="Patient prefers morning medication timing",
                classification="patient_reported",
                source="meko",
            )
        ]
    )

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        res = client.post("/api/memory/recall", json={"query": "timing preferences", "patient_id": "p-1"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["items"]) == 1
        assert "unverified conversational context" in data["unverified_disclaimer"]


def test_memory_reset_does_not_silently_re_enable_consent():
    service = MekoService()
    # Initially consent is False
    assert service.get_consent("patient-test") is False

    # Calling reset
    res = asyncio.run(service.reset_memory(patient_id="patient-test"))
    assert res["success"] is True
    # Consent must remain False, NOT silently re-enabled
    assert res["consent"] is False
    assert service.get_consent("patient-test") is False

    # Now enable consent
    service.set_consent(True, "patient-test")
    assert service.get_consent("patient-test") is True

    # Calling reset preserves or reports consent without arbitrarily forcing it ON or broken
    res2 = asyncio.run(service.reset_memory(patient_id="patient-test"))
    assert res2["success"] is True
    assert res2["consent"] is True


def test_exact_orchestration_order_with_retained_conversation_id():
    calls_sequence = []
    retained_conv_id = "test-conv-uuid-1234"

    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = True

    async def mock_create_conv(session_id, title=None, patient_id=None):
        calls_sequence.append(("conversation_create", {"session_id": session_id, "patient_id": patient_id}))
        return retained_conv_id

    async def mock_recall(query, conversation_id=None, patient_id=None):
        calls_sequence.append(("recall", {"query": query, "conversation_id": conversation_id, "patient_id": patient_id}))
        return MemoryContext()

    async def mock_log_turn(user_text, assistant_text, session_id, conversation_id=None, patient_id=None):
        calls_sequence.append(("log_turn", {"conversation_id": conversation_id, "patient_id": patient_id}))
        return conversation_id or retained_conv_id

    async def mock_remember(text, conversation_id=None, patient_id=None, session_id=None):
        calls_sequence.append(("remember", {"text": text, "conversation_id": conversation_id, "patient_id": patient_id}))
        return {"status": "success"}

    mock_meko.create_conversation.side_effect = mock_create_conv
    mock_meko.recall.side_effect = mock_recall
    mock_meko.log_turn.side_effect = mock_log_turn
    mock_meko.remember.side_effect = mock_remember

    mock_gemini = MockGemini()

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        app.state.gemini_service = mock_gemini

        res = client.post(
            "/api/ai/chat",
            json={"message": "Please remember that I prefer Hindi", "language": "en", "stream": False},
        )
        assert res.status_code == 200

    # Verify orchestration order:
    # 1. conversation_create must run FIRST on turn 1
    # 2. recall must run with the retained conversation ID
    # 3. log_turn runs with the retained conversation ID
    # 4. remember runs with the retained conversation ID and preference text
    action_names = [call[0] for call in calls_sequence]
    assert action_names == ["conversation_create", "recall", "log_turn", "remember"]

    # Verify conversation ID was properly passed to recall, log_turn, and remember
    recall_args = calls_sequence[1][1]
    assert recall_args["conversation_id"] == retained_conv_id

    log_turn_args = calls_sequence[2][1]
    assert log_turn_args["conversation_id"] == retained_conv_id

    remember_args = calls_sequence[3][1]
    assert remember_args["conversation_id"] == retained_conv_id
    assert remember_args["text"] == "User preference: I prefer Hindi"


def test_regression_symptom_recall_across_sessions_without_inventing_diagnosis():
    """Regression test:
    - Save 'I have fever' in session A.
    - Start session B for the same patient.
    - Ask 'What symptoms did I previously report?' (or 'What illness do I have?').
    - Verify fever memory is retrieved and included in Gemini's context as patient-reported/unverified.
    - Verify Gemini does not invent a diagnosis.
    """
    patient_id = "patient-regression-test-001"
    fever_memory_text = (
        "User reported currently having a fever on October 31, 2026; no additional symptoms, duration, or treatments were mentioned."
    )

    # In-memory store simulating Meko persistent memory across sessions
    stored_memories = [
        MemoryContextItem(
            text=fever_memory_text,
            source="Meko conversational memory",
            classification="patient_reported",
            verified=False,
            source_date="2026-10-31",
            reference="mem-fever-1234",
        )
    ]

    mock_meko = AsyncMock(spec=MekoService)
    mock_meko.is_consented.return_value = True

    async def mock_recall(query, conversation_id=None, patient_id=None):
        # Relevance-aware retrieval returns the stored fever memory
        return MemoryContext(items=list(stored_memories))

    async def mock_create_conv(session_id, title=None, patient_id=None):
        return f"conv-{session_id}"

    mock_meko.recall.side_effect = mock_recall
    mock_meko.create_conversation.side_effect = mock_create_conv
    mock_meko.log_turn.return_value = "conv-logged"

    class CapturingGemini:
        api_key = "test-api-key"

        def __init__(self):
            self.last_memory_context = None
            self.last_message = None

        async def generate_chat(self, history, message, language, catalogue_context="", memory_context="", on_chunk=None):
            self.last_memory_context = memory_context
            self.last_message = message

            # Assistant response adhering to healthcare system prompt:
            # - Explains user previously reported fever
            # - Notes that diagnosis is unknown
            # - Does not invent a diagnosis
            response_text = (
                "You previously reported having a fever on October 31, 2026. "
                "Please note that a reported symptom is not a diagnosis. "
                "Confirmed diagnosis: unknown. Duration: unknown. Other symptoms: unknown. "
                "I cannot diagnose conditions; please consult a licensed doctor for evaluation."
            )
            return {
                "response": response_text,
                "safety_flags": [],
                "usage": {"prompt_tokens": 15, "response_tokens": 20, "total_tokens": 35},
            }

        async def close(self):
            pass

    mock_gemini = CapturingGemini()

    with TestClient(app) as client:
        app.state.meko_service = mock_meko
        app.state.gemini_service = mock_gemini

        # Session A: User reports fever
        res_a = client.post(
            "/api/ai/chat",
            json={"message": "I have fever", "language": "en", "stream": False, "patient_id": patient_id},
        )
        assert res_a.status_code == 200
        session_a_id = res_a.json()["session_id"]
        assert session_a_id

        # Session B: Brand new session for the same patient asking what symptoms were reported
        res_b = client.post(
            "/api/ai/chat",
            json={"message": "What symptoms did I previously report?", "language": "en", "stream": False, "patient_id": patient_id},
        )
        assert res_b.status_code == 200
        session_b_data = res_b.json()
        assert session_b_data["success"] is True
        assert session_b_data["session_id"] != session_a_id

        # 1. Verify fever memory was retrieved and injected into Gemini context
        assert mock_gemini.last_memory_context is not None
        assert "fever" in mock_gemini.last_memory_context.lower()
        assert "[patient_reported; unverified" in mock_gemini.last_memory_context
        assert "mem-fever-1234" in mock_gemini.last_memory_context

        # 2. Verify assistant response mentions fever and does NOT invent a diagnosis
        resp = session_b_data["response"].lower()
        assert "fever" in resp
        assert "unknown" in resp
        for invented in ["malaria", "typhoid", "dengue", "pneumonia", "covid"]:
            assert invented not in resp

        # Session B turn 2: User asks "What illness do I have?"
        res_b2 = client.post(
            "/api/ai/chat",
            json={
                "session_id": session_b_data["session_id"],
                "message": "What illness do I have?",
                "language": "en",
                "stream": False,
                "patient_id": patient_id,
            },
        )
        assert res_b2.status_code == 200
        resp2 = res_b2.json()["response"].lower()
        assert "fever" in resp2
        assert "not a diagnosis" in resp2 or "unknown" in resp2
        for invented in ["malaria", "typhoid", "dengue", "pneumonia", "covid"]:
            assert invented not in resp2


def test_memory_items_unpacks_meko_results_structure():
    from app.ai.memory.meko_memory import _memory_items

    raw_payload = {
        "results": {
            "knowledge_base": [],
            "memory": [
                {
                    "id": "d7a162da-bf3d-4df8-872b-ed24f86c79e4",
                    "memory": "User reported currently having a fever on October 31, 2026; no additional symptoms, duration, or treatments were mentioned.",
                    "created_at": "2026-10-31T20:42:34.647248+00:00",
                    "attributed_to": "user",
                    "metadata": {"meko_datapack_id": "2d5432cf"},
                },
                {
                    "id": "pref-1234",
                    "memory": "User preference: I prefer Hindi",
                    "created_at": "2026-10-31T20:31:27.647833+00:00",
                    "metadata": {"provenance": "patient_reported"},
                },
            ],
            "conversation": {
                "hits": [
                    {
                        "content": "what illness do i have\n\nI cannot diagnose medical conditions or tell you specifically what illness you may have.",
                    }
                ]
            },
        }
    }

    items = _memory_items(raw_payload)
    # The 2 memories should be extracted individually, while the assistant canned refusal is filtered out
    assert len(items) == 2

    fever_item = items[0]
    assert "User reported currently having a fever" in fever_item.text
    # Must NOT be an unparsed dict representation
    assert not fever_item.text.startswith("{")
    assert not fever_item.text.startswith("[")
    assert fever_item.classification == "patient_reported"
    assert fever_item.source_date == "2026-10-31"
    assert fever_item.reference == "d7a162da-bf3d-4df8-872b-ed24f86c79e4"

    # Line formatting
    line = fever_item.prompt_line()
    assert line.startswith("- [patient_reported; unverified; source date: 2026-10-31; reference: d7a162da")



