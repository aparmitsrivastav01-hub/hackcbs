import logging
from pathlib import Path
import re
from typing import Any
import pandas as pd

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {
    "id", "brand_name", "active_salt", "dosage_form", "private_brand_price",
    "jan_aushadhi_price", "dava_india_price", "category",
}
PRICE_COLUMNS = ("private_brand_price", "jan_aushadhi_price", "dava_india_price")
TEXT_COLUMNS = ("brand_name", "active_salt", "dosage_form", "category")


class MedicineService:
    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []
        self._by_id: dict[int, dict[str, Any]] = {}
        self._csv_path: Path | None = None

    def load_csv(self, path: str | Path) -> int:
        csv_path = Path(path).resolve()
        if not csv_path.is_file():
            raise FileNotFoundError(f"Medicine catalogue not found: {csv_path}")
        self._csv_path = csv_path
        frame = pd.read_csv(csv_path, encoding="utf-8-sig")
        missing = REQUIRED_COLUMNS - set(frame.columns)
        if missing:
            raise ValueError(f"Catalogue is missing required columns: {', '.join(sorted(missing))}")
        frame = frame[list(REQUIRED_COLUMNS)]
        frame["id"] = pd.to_numeric(frame["id"], errors="coerce")
        frame = frame.dropna(subset=["id"])
        frame["id"] = frame["id"].astype(int)
        if frame["id"].duplicated().any():
            raise ValueError("Catalogue contains duplicate medicine IDs")
        for column in TEXT_COLUMNS:
            frame[column] = frame[column].where(frame[column].notna(), "").astype(str).str.strip()
        for column in PRICE_COLUMNS:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
            frame[column] = frame[column].where(frame[column].ge(0) & frame[column].notna())
        records = frame.to_dict(orient="records")
        self._rows = records
        self._by_id = {int(row["id"]): row for row in records}

        # Diagnostic logs for catalogue verification
        logger.info("[Catalogue Diagnostic] Absolute path: %s", csv_path)
        logger.info("[Catalogue Diagnostic] Total records loaded into memory: %d", len(records))

        target_checks = {
            "Razod / Razo-D": any(re.search(r"\brazod\b|\brazo-d\b", str(r.get("brand_name") or ""), re.I) for r in records),
            "Ambulox / Ambulax": any(re.search(r"\bambulox\b|\bambulax\b", str(r.get("brand_name") or ""), re.I) for r in records),
            "Petril Plus": any("petril plus" in str(r.get("brand_name") or "").lower() for r in records),
            "Placida": any("placida" in str(r.get("brand_name") or "").lower() for r in records),
        }
        for med_name, exists in target_checks.items():
            logger.info("[Catalogue Diagnostic] Example record '%s' exists: %s", med_name, exists)

        return len(records)

    @property
    def csv_path(self) -> Path | None:
        return self._csv_path

    @property
    def count(self) -> int:
        return len(self._rows)

    def all(self) -> list[dict[str, Any]]:
        return list(self._rows)

    def get(self, medicine_id: int) -> dict[str, Any] | None:
        return self._by_id.get(medicine_id)

    def categories(self) -> list[str]:
        return sorted({row["category"] for row in self._rows if row["category"]})
