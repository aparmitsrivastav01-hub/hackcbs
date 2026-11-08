import base64
import io
import logging
import wave
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from app.models.voice_schemas import VoiceSearchResponse, VoiceSpeakRequest, VoiceTranscriptResponse
from app.services.price_service import compare_prices
from app.services.search_service import search_rows
from app.services.voice_service import (
    GnaniAuthenticationError,
    GnaniProviderError,
    GnaniProviderTimeout,
    GnaniRateLimitError,
    GnaniVoiceService,
    InvalidAudioError,
    MissingGnaniConfiguration,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["voice search"])
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 30
FILLER_WORDS = {
    "mujhe", "mujhko", "chahiye", "please", "plz", "do", "dikhao", "dikhaiye", "batao", "bataye",
    "search", "find", "show", "want", "need", "get", "i", "can", "you", "could", "would", "like",
    "medicine", "medicines", "price", "prices",
    "ka", "ki", "ke", "liye", "hai", "hain", "the", "a", "an", "for", "of", "me", "give",
    "karo", "karna", "kijiye", "milega", "milegi", "wala", "wali",
}


def get_voice_service(request: Request) -> GnaniVoiceService:
    service = getattr(request.app.state, "voice_service", None)
    if service is None:
        service = getattr(request.app.state, "elevenlabs_service", None)
    if service is None:
        service = GnaniVoiceService()
        request.app.state.voice_service = service
    return service


def _validate_audio(upload: UploadFile, data: bytes) -> str:
    """
    Validates audio file size and format.
    Returns normalized filename with extension.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds the 10 MB limit")

    filename = (upload.filename or "recording.wav").lower()

    # WAV format validation
    is_wav_header = len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if is_wav_header or filename.endswith(".wav"):
        if not is_wav_header or len(data) < 44:
            raise HTTPException(status_code=415, detail="Audio is not a valid WAV file")
        try:
            with wave.open(io.BytesIO(data), "rb") as audio:
                duration = audio.getnframes() / float(audio.getframerate())
                if audio.getcomptype() != "NONE" or audio.getnchannels() not in {1, 2}:
                    raise HTTPException(status_code=415, detail="WAV must use uncompressed mono or stereo PCM")
                if not 0 < duration <= MAX_AUDIO_SECONDS:
                    raise HTTPException(status_code=413, detail="Audio duration must be between 0 and 30 seconds")
        except (wave.Error, ZeroDivisionError) as exc:
            raise HTTPException(status_code=415, detail="Audio is not a valid PCM WAV file") from exc
        return "audio.wav"

    # Support other compressed formats if valid (mp3, ogg, m4a, flac, aac)
    is_mp3 = data[:3] == b"ID3" or (len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    is_ogg = data[:4] == b"OggS"
    is_flac = data[:4] == b"fLaC"
    is_m4a = len(data) >= 8 and data[4:8] == b"ftyp"

    if is_mp3:
        return "audio.mp3"
    if is_ogg:
        return "audio.ogg"
    if is_flac:
        return "audio.flac"
    if is_m4a:
        return "audio.m4a"

    # If format could not be verified
    raise HTTPException(
        status_code=415,
        detail="Audio format is not supported. Please upload a standard uncompressed PCM WAV, MP3, or OGG file.",
    )


async def _read_audio(upload: UploadFile) -> tuple[bytes, str]:
    try:
        data = await upload.read(MAX_AUDIO_BYTES + 1)
        filename = _validate_audio(upload, data)
        return data, filename
    finally:
        await upload.close()


def _to_search_query(transcript: str) -> str:
    tokens = transcript.strip().split()
    useful = [token for token in tokens if token.casefold().strip(".,?!") not in FILLER_WORDS]
    return " ".join(useful).strip()


def _medicine_payload(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "brand_name": row["brand_name"],
        "active_salt": row["active_salt"],
        "dosage_form": row["dosage_form"],
        "category": row["category"],
        **compare_prices(row),
    }


def _money(value: float | None, language: str) -> str:
    if value is None:
        return "price unavailable" if language == "en-IN" else "कीमत उपलब्ध नहीं है"
    return f"{value:g} rupees" if language == "en-IN" else f"{value:g} रुपये"


def _spoken_response(transcript: str, medicines: list[dict], language: str) -> str:
    selected = medicines[:3]
    if not selected:
        if language == "en-IN":
            return f'I could not find a catalogue match for "{transcript}". Please check the medicine name or strength.'
        return f'"{transcript}" के लिए catalogue में दवा नहीं मिली। कृपया दवा का नाम और strength जाँचें।'

    sentences: list[str] = []
    for medicine in selected:
        name = medicine["brand_name"]
        prices = medicine["prices"]
        savings = medicine["savings_comparison"]["maximum_savings"]
        if language == "en-IN":
            sentence = (
                f'{name}: private brand {_money(prices["private_brand"], language)}, '
                f'Jan Aushadhi {_money(prices["jan_aushadhi"], language)}, '
                f'Dava India {_money(prices["dava_india"], language)}.'
            )
            if savings and savings["amount"] > 0:
                provider = savings["provider"]
                provider_name = " and ".join(provider) if isinstance(provider, list) else provider
                sentence += f' Maximum listed savings are {_money(savings["amount"], language)} at {provider_name}.'
            elif prices["private_brand"] is None:
                sentence += " The private brand reference price is unavailable, so savings cannot be calculated."
            else:
                sentence += " No cheaper alternative is listed."
        else:
            sentence = (
                f'{name} के लिए private brand की कीमत {_money(prices["private_brand"], language)}, '
                f'Jan Aushadhi की कीमत {_money(prices["jan_aushadhi"], language)}, '
                f'और Dava India की कीमत {_money(prices["dava_india"], language)} है।'
            )
            if savings and savings["amount"] > 0:
                provider = savings["provider"]
                provider_name = " और ".join(provider) if isinstance(provider, list) else provider
                sentence += f' {provider_name} से अधिकतम {_money(savings["amount"], language)} की बचत हो सकती है।'
            elif prices["private_brand"] is None:
                sentence += " private brand की reference कीमत उपलब्ध नहीं है, इसलिए बचत की गणना नहीं हो सकती।"
            else:
                sentence += " इससे सस्ता विकल्प catalogue में उपलब्ध नहीं है।"
        sentences.append(sentence)
    return " ".join(sentences)


def _map_provider_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, MissingGnaniConfiguration):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, GnaniProviderTimeout):
        return HTTPException(status_code=504, detail=str(exc))
    if isinstance(exc, GnaniAuthenticationError):
        return HTTPException(status_code=502, detail=str(exc))
    if isinstance(exc, GnaniRateLimitError):
        return HTTPException(status_code=429, detail=str(exc))
    if isinstance(exc, InvalidAudioError):
        return HTTPException(status_code=415, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


@router.post("/transcribe", response_model=VoiceTranscriptResponse)
async def transcribe_audio(
    request: Request,
    file: Annotated[UploadFile, File(description="PCM WAV audio, up to 30 seconds and 10 MB")],
    language: Annotated[str, Form()] = "auto",
):
    data, filename = await _read_audio(file)
    try:
        result = await get_voice_service(request).transcribe(data, filename, language)
    except Exception as exc:
        raise _map_provider_errors(exc) from exc
    return {"success": True, **result}


@router.post("/speak")
async def speak_text(request: Request, body: VoiceSpeakRequest):
    try:
        audio = await get_voice_service(request).speak(body.text.strip(), body.language)
    except Exception as exc:
        raise _map_provider_errors(exc) from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


@router.post("/search", response_model=VoiceSearchResponse)
async def voice_search(
    request: Request,
    file: Annotated[UploadFile, File(description="PCM WAV audio, up to 30 seconds and 10 MB")],
    language: Annotated[str, Form()] = "auto",
):
    data, filename = await _read_audio(file)
    voice = get_voice_service(request)
    try:
        transcription = await voice.transcribe(data, filename, language)
    except Exception as exc:
        raise _map_provider_errors(exc) from exc

    query = _to_search_query(transcription["transcript"])
    if not query:
        raise HTTPException(status_code=422, detail="No medicine name was recognized in the audio")

    from app.main import medicine_service

    medicines = [_medicine_payload(row) for row in search_rows(query, medicine_service.all())]
    if transcription["language"] in {"hi-IN", "en-IN"}:
        language_for_tts = transcription["language"]
    elif language in {"hi-IN", "en-IN", "hi", "en"}:
        language_for_tts = "hi-IN" if language in {"hi", "hi-IN"} else "en-IN"
    else:
        language_for_tts = "hi-IN" if any("\u0900" <= char <= "\u097f" for char in transcription["transcript"]) else "en-IN"

    spoken = _spoken_response(transcription["transcript"], medicines, language_for_tts)
    audio_base64 = None
    speech_error = None
    try:
        audio = await voice.speak(spoken, language_for_tts)
        audio_base64 = base64.b64encode(audio).decode("ascii")
    except Exception as exc:
        speech_error = str(exc)
        logger.warning("Voice search TTS unavailable (%s)", type(exc).__name__)

    return {
        "success": True,
        **transcription,
        "search_query": query,
        "total_results": len(medicines),
        "medicines": medicines,
        "spoken_response": spoken,
        "audio_base64": audio_base64,
        "audio_content_type": "audio/mpeg" if audio_base64 else None,
        "speech_error": speech_error,
    }
