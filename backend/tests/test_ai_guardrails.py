import pytest
from fastapi.testclient import TestClient

from app.ai.guardrails.safety_guardrails import AISafetyGuardrail
from app.main import app


class DummyGemini:
    api_key = "dummy-key-for-test"

    async def generate_chat(self, history, message, language, catalogue_context="", memory_context="", on_chunk=None):
        if on_chunk:
            await on_chunk("Hello from ")
            await on_chunk("MedSaathi.")
        return {
            "response": "Hello from MedSaathi. Paracetamol Jan Aushadhi is available at Rs. 10.",
            "safety_flags": [],
            "usage": {"prompt_tokens": 10, "response_tokens": 12, "total_tokens": 22},
        }

    async def close(self):
        pass


class HallucinatingPrescribingGemini:
    api_key = "dummy-key-for-test"

    async def generate_chat(self, history, message, language, catalogue_context="", memory_context="", on_chunk=None):
        return {
            "response": "I prescribe you take 500mg twice a day for 5 days.",
            "safety_flags": [],
            "usage": {"prompt_tokens": 10, "response_tokens": 12, "total_tokens": 22},
        }

    async def close(self):
        pass


# ==============================================================================
# Unit Tests for AISafetyGuardrail
# ==============================================================================

def test_guardrail_emergency_triggers_english_and_hindi():
    # English emergency symptoms
    res_en = AISafetyGuardrail.check_emergency("Doctor help, I have severe chest pain and trouble breathing")
    assert res_en is not None
    assert res_en.triggered is True
    assert res_en.category == "emergency"
    text_en = res_en.response_text("en")
    assert "108" in text_en
    assert "112" in text_en
    assert "emergency" in text_en.lower()

    # Hindi emergency symptoms
    res_hi = AISafetyGuardrail.check_emergency("मुझे सीने में तेज दर्द हो रहा है और सांस नहीं आ रही")
    assert res_hi is not None
    assert res_hi.triggered is True
    text_hi = res_hi.response_text("hi")
    assert "108" in text_hi
    assert "112" in text_hi
    assert "आपातकाल" in text_hi


def test_guardrail_prescription_refusal_with_home_remedies():
    # User demanding prescription for throat infection
    res = AISafetyGuardrail.check_prescription_or_diagnosis_demand(
        "Please prescribe me an antibiotic for my sore throat"
    )
    assert res is not None
    assert res.triggered is True
    assert res.category == "prescription_refusal"
    text = res.response_text("en")
    assert "cannot prescribe medicines" in text.lower() or "cannot prescribe" in text.lower()
    assert "salt-water gargle" in text.lower() or "steam" in text.lower()
    # Ensure zero prescription drug names recommended as prescription
    assert "amoxicillin" not in text.lower()
    assert "azithromycin" not in text.lower()


def test_guardrail_allergy_awareness_preserves_home_care_only():
    memory_context = "Patient-reported allergy: severe allergic reaction to penicillin and sulfa drugs."
    res = AISafetyGuardrail.check_prescription_or_diagnosis_demand(
        "Prescribe me something for bad cough and fever",
        memory_context=memory_context,
    )
    assert res is not None
    text = res.response_text("en")
    assert "reported allergy" in text.lower() or "allergy" in text.lower()
    assert "doctor" in text.lower()
    # Must only contain non-medicinal home care
    assert "steam" in text.lower() or "herbal" in text.lower() or "rest" in text.lower()


def test_guardrail_sanitizes_hallucinated_prescriptions():
    dirty_text = "I prescribe you take 500mg twice a day of this pill."
    cleaned = AISafetyGuardrail.sanitize_llm_response(dirty_text, "en")
    assert "I prescribe you" not in cleaned
    assert "Safety Notice: MedSaathi is an AI health information assistant, not a doctor" in cleaned


def test_guardrail_clean_price_comparison_passes_untouched():
    clean_text = "Paracetamol 500mg: Jan Aushadhi MRP is ₹10 vs Branded ₹32. You save ₹22 (68%)."
    sanitized = AISafetyGuardrail.sanitize_llm_response(clean_text, "en")
    assert sanitized == clean_text


# ==============================================================================
# Integration Tests for /api/ai/chat with Guardrails
# ==============================================================================

def test_api_chat_emergency_interception():
    with TestClient(app) as client:
        app.state.gemini_service = DummyGemini()
        response = client.post(
            "/api/ai/chat",
            json={
                "message": "I am having sudden slurred speech and numbness on my left side",
                "language": "en",
                "stream": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["safety_flags"] == ["potential_emergency"]
        assert "108" in data["response"]
        assert "112" in data["response"]


def test_api_chat_prescription_refusal_interception():
    with TestClient(app) as client:
        app.state.gemini_service = DummyGemini()
        response = client.post(
            "/api/ai/chat",
            json={
                "message": "Write me a prescription for antibiotic tablets for throat pain",
                "language": "en",
                "stream": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["safety_flags"] == ["prescription_refusal"]
        assert "cannot prescribe" in data["response"].lower()
        assert "gargle" in data["response"].lower() or "steam" in data["response"].lower()


def test_api_chat_streaming_prescription_guardrail():
    with TestClient(app) as client:
        app.state.gemini_service = DummyGemini()
        response = client.post(
            "/api/ai/chat",
            json={
                "message": "prescribe me an antibiotic",
                "language": "en",
                "stream": True,
            },
        )
        assert response.status_code == 200
        assert '"type": "meta"' in response.text
        assert '"type": "done"' in response.text
        assert "prescription_refusal" in response.text
        assert "cannot prescribe" in response.text.lower()
