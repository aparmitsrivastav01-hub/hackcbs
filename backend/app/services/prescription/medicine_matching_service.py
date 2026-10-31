import re
from difflib import SequenceMatcher
from typing import Any

from app.models.prescription_schemas import CatalogueCandidate, CatalogueMatch, ExtractedMedicine
from app.services.search_service import normalize

STRENGTH_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%|units?)\b", re.I)
NON_INGREDIENT_WORDS = {
    "mg", "mcg", "ug", "g", "ml", "iu", "unit", "units", "tablet", "tablets", "tab", "tabs",
    "capsule", "capsules", "cap", "caps", "injection", "inj", "syrup", "solution", "suspension",
    "oral", "sodium", "potassium", "calcium", "hydrochloride", "hydrobromide", "hcl", "hbr",
    "maleate", "sulphate", "sulfate", "phosphate", "acetate", "citrate", "monohydrate", "trihydrate",
    "bromide", "nitrate", "oxide", "hydrate", "acid", "delayed", "release", "extended", "film", "coated",
}


def _strengths(value: str) -> set[str]:
    return {normalize(match).replace(" ", "") for match in STRENGTH_RE.findall(value or "")}


def _ingredient_tokens(value: str) -> set[str]:
    without_strength = STRENGTH_RE.sub(" ", value or "")
    return {
        token for token in re.findall(r"[a-z]+", normalize(without_strength))
        if token not in NON_INGREDIENT_WORDS and len(token) > 1
    }


def _candidate_score(extracted: ExtractedMedicine, row: dict[str, Any]) -> float:
    brand = normalize(row.get("brand_name"))
    active_salt = normalize(row.get("active_salt"))
    prescribed = normalize(extracted.prescribed_name)
    normalized_name = normalize(extracted.normalized_name)
    query_names = [name for name in (prescribed, normalized_name) if name]

    expected_strengths = _strengths(" ".join(filter(None, [extracted.strength, extracted.active_salt, extracted.prescribed_name])))
    catalogue_strengths = _strengths(" ".join(filter(None, [str(row.get("active_salt") or ""), str(row.get("brand_name") or "")])))
    if expected_strengths and catalogue_strengths and expected_strengths != catalogue_strengths:
        return 0

    extracted_ingredients = _ingredient_tokens(extracted.active_salt or "")
    catalogue_ingredients = _ingredient_tokens(str(row.get("active_salt") or ""))
    if extracted_ingredients and catalogue_ingredients and extracted_ingredients != catalogue_ingredients:
        return 0

    if extracted.dosage_form and row.get("dosage_form"):
        prescribed_form = normalize(extracted.dosage_form)
        catalogue_form = normalize(row["dosage_form"])
        if prescribed_form and catalogue_form and prescribed_form != catalogue_form:
            return 0

    if any(name == brand for name in query_names):
        return 0.98 if (not expected_strengths or expected_strengths == catalogue_strengths) else 0
    if extracted_ingredients and extracted_ingredients == catalogue_ingredients:
        if expected_strengths and catalogue_strengths == expected_strengths:
            return 0.97
        if not expected_strengths:
            return 0.76
    if any(name and name == active_salt for name in query_names):
        return 0.93 if (not expected_strengths or expected_strengths == catalogue_strengths) else 0

    candidate_names = [brand, active_salt]
    fuzzy = max(
        (SequenceMatcher(None, query, candidate).ratio() for query in query_names for candidate in candidate_names if query and candidate),
        default=0,
    )
    if fuzzy >= 0.86:
        return round(min(fuzzy * 0.88, 0.88), 2)
    return 0


def match_medicine(extracted: ExtractedMedicine, catalogue: list[dict[str, Any]]) -> CatalogueMatch:
    scored = [(score, row) for row in catalogue if (score := _candidate_score(extracted, row)) >= 0.55]
    scored.sort(key=lambda item: (-item[0], int(item[1]["id"])))
    alternatives = [
        CatalogueCandidate(
            medicine_id=int(row["id"]),
            brand_name=str(row.get("brand_name") or ""),
            active_salt=str(row.get("active_salt") or ""),
            dosage_form=str(row.get("dosage_form") or ""),
            match_confidence=score,
        )
        for score, row in scored[:3]
    ]
    if not scored:
        status = "needs_review" if extracted.confidence is None or extracted.confidence < 0.65 else "not_found"
        return CatalogueMatch(status=status)

    score, best = scored[0]
    extraction_is_uncertain = extracted.confidence is None or extracted.confidence < 0.65
    if score >= 0.93 and not extraction_is_uncertain:
        status = "matched"
    elif score >= 0.75 and not extraction_is_uncertain:
        status = "possible_match"
    else:
        status = "needs_review"
    return CatalogueMatch(
        status=status,
        medicine_id=int(best["id"]),
        brand_name=str(best.get("brand_name") or ""),
        active_salt=str(best.get("active_salt") or ""),
        dosage_form=str(best.get("dosage_form") or ""),
        match_confidence=score,
        alternatives=alternatives,
    )
