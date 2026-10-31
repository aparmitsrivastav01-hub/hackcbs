import asyncio
import json
import logging
import os
from typing import Protocol

import pymupdf

from app.models.prescription_schemas import ExtractionResult

logger = logging.getLogger(__name__)


class ExtractionProviderError(RuntimeError):
    pass


class MissingProviderConfiguration(ExtractionProviderError):
    pass


class ExtractionProviderTimeout(ExtractionProviderError):
    pass


class ExtractionProvider(Protocol):
    async def extract(self, data: bytes, mime_type: str, ocr_context: str | None = None) -> ExtractionResult: ...


EXTRACTION_PROMPT = """You are a clinical document processing system specializing in Indian prescription interpretation.
Analyze this prescription image/document directly using your visual capabilities.

If text extracted from the document layout is provided below, treat it as additional evidence.
Do not hallucinate medicines that are not in the document.
Do not convert ambiguous, smudged, or unreadable handwriting into confirmed medication.

Return JSON only in this exact shape:
{
  "patient_details": {
    "name": string | null,
    "age": string | null,
    "gender": string | null
  },
  "doctor_details": {
    "name": string | null,
    "qualification": string | null,
    "hospital_or_clinic": string | null
  },
  "chief_complaints": [string],
  "other_text": [string],
  "warnings": [string],
  "medicines": [
    {
      "raw_text": string,
      "prescribed_name": string | null,
      "normalized_name": string | null,
      "active_salt": string | null,
      "strength": string | null,
      "dosage_form": string | null,
      "dosage_instructions": string | null,
      "duration": string | null,
      "confidence": number,
      "uncertain_parts": [string],
      "needs_review": boolean,
      "source": "ocr_and_gemini"
    }
  ]
}

Extraction Rules:
1. Preserve the written prescribed_name and raw_text as written on the paper.
2. Confidence score must range from 0.0 to 1.0 based strictly on visual clarity and legibility.
   - 0.90 - 1.0: Clearly printed or very legible handwriting.
   - 0.60 - 0.89: Readable handwriting with minor ambiguity.
   - Below 0.60: Partially smudged, cursive, or hard to read handwriting.
3. If handwriting is ambiguous or uncertain:
   - Mark `needs_review: true`.
   - List the specific ambiguity in `uncertain_parts` (e.g. "Strength number smudged", "Handwritten brand prefix unclear").
   - Do NOT invent or guess random medicines.
4. Extract patient details, doctor details, hospital name, vitals or complaints into their respective fields or `other_text`.
5. Do NOT include diagnoses, vitals (BP/Pulse), laboratory tests, or investigation names (e.g. X-Ray, Blood Test) as medicines.
6. If no medicines are present in the document, return an empty `medicines` list [].
"""


def extract_document_text(data: bytes, mime_type: str) -> str:
    """Extract embedded digital text from PDF or documents to provide as supplementary OCR evidence."""
    try:
        if mime_type == "application/pdf" or data.startswith(b"%PDF-"):
            with pymupdf.open(stream=data, filetype="pdf") as doc:
                pages_text = []
                for idx, page in enumerate(doc):
                    text = page.get_text().strip()
                    if text:
                        pages_text.append(f"--- Page {idx + 1} ---\n{text}")
                return "\n\n".join(pages_text).strip()
    except Exception as exc:
        logger.warning("Could not extract embedded text from document: %s", exc)
    return ""


class GeminiExtractionProvider:
    # Model fallback order: User config -> 3.5-flash-lite -> 3.5-flash -> 3.8-flash
    FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]

    def __init__(self, api_key: str | None = None, model: str | None = None, timeout_seconds: float = 45):
        self.api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        self.timeout_seconds = timeout_seconds

    async def extract(self, data: bytes, mime_type: str, ocr_context: str | None = None) -> ExtractionResult:
        if not self.api_key:
            raise MissingProviderConfiguration("Prescription extraction is unavailable: GEMINI_API_KEY is not configured")
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._generate, data, mime_type, ocr_context),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise ExtractionProviderTimeout("Prescription extraction provider timed out") from exc
        except ExtractionProviderError:
            raise
        except Exception as exc:
            raise ExtractionProviderError("Prescription extraction provider failed") from exc

    def _generate(self, data: bytes, mime_type: str, ocr_context: str | None = None) -> ExtractionResult:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
            )

            # If supplementary OCR/embedded text exists, include it as additional evidence
            if ocr_context is None:
                ocr_context = extract_document_text(data, mime_type)

            evidence_text = EXTRACTION_PROMPT
            if ocr_context:
                evidence_text += f"\n\n--- OCR / Embedded Document Text Evidence ---\n{ocr_context}"

            candidate_models = [self.model] + [m for m in self.FALLBACK_MODELS if m != self.model]

            last_error: Exception | None = None
            for model_name in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[
                            types.Part.from_bytes(data=data, mime_type=mime_type),
                            evidence_text,
                        ],
                        config=types.GenerateContentConfig(
                            temperature=0,
                            response_mime_type="application/json",
                        ),
                    )
                    text = response.text
                    if not text:
                        raise ValueError(f"Provider model {model_name} returned an empty extraction")

                    parsed = json.loads(text)
                    return ExtractionResult.model_validate(parsed)
                except Exception as exc:
                    err_msg = str(exc)
                    logger.warning("Gemini Vision attempt with model %s failed: %s", model_name, err_msg)
                    last_error = exc
                    # If quota exhausted (429) or model discontinued (404) or busy (503), try next fallback model
                    if any(code in err_msg for code in ["429", "404", "503", "RESOURCE_EXHAUSTED", "NOT_FOUND"]):
                        continue
                    break

            if last_error:
                raise last_error

            raise ValueError("All extraction model attempts failed")
        except Exception as exc:
            raise ExtractionProviderError(f"Prescription extraction provider failed: {exc}") from exc
