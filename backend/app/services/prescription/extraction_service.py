import asyncio
import json
import os
from typing import Protocol

from app.models.prescription_schemas import ExtractionResult


class ExtractionProviderError(RuntimeError):
    pass


class MissingProviderConfiguration(ExtractionProviderError):
    pass


class ExtractionProviderTimeout(ExtractionProviderError):
    pass


class ExtractionProvider(Protocol):
    async def extract(self, data: bytes, mime_type: str) -> ExtractionResult: ...


EXTRACTION_PROMPT = """Read the prescription and extract every medicine that is actually prescribed.
Return JSON only in this exact shape: {"medicines":[{"prescribed_name":string|null,"normalized_name":string|null,"active_salt":string|null,"strength":string|null,"dosage_form":string|null,"dosage_instructions":string|null,"duration":string|null,"confidence":number|null}]}.
Preserve the written prescribed_name. Normalize spelling/casing only when legible; do not infer unreadable text. Use null for any unreadable or absent field. Extract all medicine lines, including uncertain handwriting, and lower confidence when uncertain. Do not include diagnoses, tests, investigation names, patient/doctor details, or general notes as medicines. Do not invent medicine names, strengths, forms, instructions, or durations. Avoid duplicate lines unless their instructions differ."""


class GeminiExtractionProvider:
    def __init__(self, api_key: str | None = None, model: str | None = None, timeout_seconds: float = 45):
        self.api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.timeout_seconds = timeout_seconds

    async def extract(self, data: bytes, mime_type: str) -> ExtractionResult:
        if not self.api_key:
            raise MissingProviderConfiguration("Prescription extraction is unavailable: GEMINI_API_KEY is not configured")
        try:
            return await asyncio.wait_for(asyncio.to_thread(self._generate, data, mime_type), timeout=self.timeout_seconds)
        except asyncio.TimeoutError as exc:
            raise ExtractionProviderTimeout("Prescription extraction provider timed out") from exc
        except ExtractionProviderError:
            raise
        except Exception as exc:
            raise ExtractionProviderError("Prescription extraction provider failed") from exc

    def _generate(self, data: bytes, mime_type: str) -> ExtractionResult:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
            )
            response = client.models.generate_content(
                model=self.model,
                contents=[
                    types.Part.from_bytes(data=data, mime_type=mime_type),
                    EXTRACTION_PROMPT,
                ],
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                ),
            )
            text = response.text
            if not text:
                raise ValueError("Provider returned an empty extraction")
            return ExtractionResult.model_validate(json.loads(text))
        except Exception as exc:
            raise ExtractionProviderError("Prescription extraction provider failed") from exc
