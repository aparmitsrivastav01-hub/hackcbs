from functools import lru_cache
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_CSV_PATH = BASE_DIR / "app" / "data" / "MedEasy_catalogue_500_complete.csv"
load_dotenv(BASE_DIR / ".env", override=False)

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:3000,http://127.0.0.1:3000"
)


@lru_cache
def get_cors_origins() -> list[str]:
    raw = os.getenv("MEDEASY_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
