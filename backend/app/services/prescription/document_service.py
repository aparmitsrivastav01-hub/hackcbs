from dataclasses import dataclass
from io import BytesIO

import pymupdf as fitz
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
SUPPORTED_IMAGE_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


@dataclass(frozen=True)
class ValidatedDocument:
    data: bytes
    mime_type: str
    filename: str
    size_bytes: int


class DocumentValidationError(ValueError):
    pass


class UnsupportedDocumentFormat(DocumentValidationError):
    pass


class UploadTooLarge(DocumentValidationError):
    pass


def validate_document(data: bytes, filename: str | None) -> ValidatedDocument:
    if not data:
        raise DocumentValidationError("Uploaded file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadTooLarge("File exceeds the 10 MB upload limit")
    safe_name = (filename or "prescription").replace("\\", "/").rsplit("/", 1)[-1]

    if data.startswith(b"%PDF-"):
        try:
            with fitz.open(stream=data, filetype="pdf") as document:
                if document.page_count < 1:
                    raise DocumentValidationError("PDF contains no pages")
        except DocumentValidationError:
            raise
        except Exception as exc:
            raise DocumentValidationError("PDF is invalid or corrupted") from exc
        return ValidatedDocument(data, "application/pdf", safe_name, len(data))

    is_jpeg = data.startswith(b"\xff\xd8\xff")
    is_png = data.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    if not (is_jpeg or is_png or is_webp):
        raise UnsupportedDocumentFormat("Unsupported file format. Use JPG, JPEG, PNG, WEBP, or PDF")

    try:
        with Image.open(BytesIO(data)) as image:
            image_format = image.format
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise DocumentValidationError("Image dimensions exceed the supported limit")
            if image_format not in SUPPORTED_IMAGE_FORMATS:
                raise UnsupportedDocumentFormat("Unsupported file format. Use JPG, JPEG, PNG, WEBP, or PDF")
            image.verify()
        # Reopen and force pixel decoding to catch truncated/corrupt image payloads.
        with Image.open(BytesIO(data)) as image:
            image.load()
    except DocumentValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise DocumentValidationError("Image is invalid or corrupted") from exc
    return ValidatedDocument(data, SUPPORTED_IMAGE_FORMATS[image_format], safe_name, len(data))
