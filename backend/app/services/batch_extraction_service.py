import asyncio
import json
import logging
import os
from io import BytesIO
from typing import Any

import pymupdf
from PIL import Image, ImageOps, ImageEnhance

from app.models.batch_extraction_schemas import BatchMedicineExtraction
from app.services.prescription.document_service import ValidatedDocument

logger = logging.getLogger(__name__)

PROMPT = '''Inspect medicine packaging and map only clearly visible evidence to fields. Use null for missing or uncertain values. Never infer a batch number or manufacturer. OCR text is supplementary evidence; report disagreements in warnings. Return JSON only with keys medicine_name,strength,dosage_form,manufacturer,batch_number,manufacturing_date,expiry_date,mrp,composition,field_confidence (medicine_name,batch_number,manufacturer,expiry_date each 0..1 or null),needs_manual_review,warnings.''' 


def _preprocess(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((2400, 2400))
    image = ImageEnhance.Contrast(image).enhance(1.25)
    return ImageEnhance.Sharpness(image).enhance(1.2)


def _ocr_images(document: ValidatedDocument) -> str:
    images = []
    texts = []
    if document.mime_type == "application/pdf":
        with pymupdf.open(stream=document.data, filetype="pdf") as pdf:
            for page in list(pdf)[:4]:
                embedded = page.get_text().strip()
                if embedded:
                    texts.append(embedded)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
                images.append(Image.open(BytesIO(pix.tobytes("png"))).convert("RGB"))
    else:
        with Image.open(BytesIO(document.data)) as img:
            images = [_preprocess(img.copy())]
    try:
        import pytesseract
        texts.extend(text.strip() for text in (pytesseract.image_to_string(_preprocess(img)) for img in images) if text.strip())
    except Exception as exc:
        logger.info("Local Tesseract OCR unavailable: %s", type(exc).__name__)
    return "\n".join(texts)


def _prepared_image_bytes(data: bytes) -> bytes:
    with Image.open(BytesIO(data)) as image:
        output = BytesIO()
        _preprocess(image.copy()).save(output, format="PNG", optimize=True)
        return output.getvalue()


class BatchExtractionService:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"

    async def extract(self, documents: list[ValidatedDocument]) -> BatchMedicineExtraction:
        texts, warnings, images = [], [], []
        for doc in documents:
            text = _ocr_images(doc)
            if text:
                texts.append(text)
            else:
                warnings.append(f"OCR text was unavailable for {doc.filename}; Gemini Vision will inspect the image directly.")
            if doc.mime_type == "application/pdf":
                with pymupdf.open(stream=doc.data, filetype="pdf") as pdf:
                    for page in list(pdf)[:4]:
                        pix = page.get_pixmap(matrix=pymupdf.Matrix(2,2), alpha=False)
                        images.append((pix.tobytes("png"), "image/png"))
            else:
                images.append((_prepared_image_bytes(doc.data), "image/png"))
        raw = "\n\n".join(texts)
        if not self.api_key:
            raise RuntimeError("Gemini is not configured; set GEMINI_API_KEY in the backend environment")
        result = await asyncio.to_thread(self._vision, images, raw)
        result["raw_ocr_text"] = raw
        result["warnings"] = list(dict.fromkeys([*result.get("warnings", []), *warnings]))
        result["model"] = self.model
        # Flag direct textual disagreement without changing either value.
        for key, label in (("batch_number", "batch number"), ("manufacturer", "manufacturer")):
            value = result.get(key)
            if value and raw and value.casefold() not in raw.casefold():
                result["warnings"].append(f"Gemini identified a {label} that does not appear verbatim in OCR text; review the image.")
                result["needs_manual_review"] = True
        missing = [key for key in ("medicine_name", "batch_number", "manufacturer") if not result.get(key)]
        if missing:
            result["needs_manual_review"] = True
        result["extraction_status"] = "complete" if not missing else "partial"
        return BatchMedicineExtraction.model_validate(result)

    def _vision(self, images: list[tuple[bytes, str]], ocr_text: str) -> dict[str, Any]:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=self.api_key)
        contents: list[Any] = [PROMPT + ("\nOCR evidence:\n" + ocr_text if ocr_text else "\nNo OCR text is available.")]
        contents.extend(types.Part.from_bytes(data=data, mime_type=mime) for data, mime in images)
        response = client.models.generate_content(model=self.model, contents=contents,
            config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json"))
        if not response.text:
            raise ValueError("Gemini returned an empty extraction")
        payload = json.loads(response.text)
        if not isinstance(payload, dict):
            raise ValueError("Gemini extraction was not a JSON object")
        return payload
