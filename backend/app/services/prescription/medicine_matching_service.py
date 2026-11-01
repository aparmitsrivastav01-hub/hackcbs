import logging
import re
from difflib import SequenceMatcher
from typing import Any

from app.models.prescription_schemas import CatalogueCandidate, CatalogueMatch, ExtractedMedicine
from app.services.search_service import normalize

logger = logging.getLogger(__name__)

STRENGTH_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%|units?)\b", re.I)
NON_INGREDIENT_WORDS = {
    "mg", "mcg", "ug", "g", "ml", "iu", "unit", "units", "tablet", "tablets", "tab", "tabs",
    "capsule", "capsules", "cap", "caps", "injection", "inj", "syrup", "solution", "suspension",
    "oral", "sodium", "potassium", "calcium", "hydrochloride", "hydrobromide", "hcl", "hbr",
    "maleate", "sulphate", "sulfate", "phosphate", "acetate", "citrate", "monohydrate", "trihydrate",
    "bromide", "nitrate", "oxide", "hydrate", "acid", "delayed", "release", "extended", "film", "coated",
}

DOSAGE_FORM_MAP = {
    "tab": "tablet",
    "tabs": "tablet",
    "tablet": "tablet",
    "tablets": "tablet",
    "cap": "capsule",
    "caps": "capsule",
    "capsule": "capsule",
    "capsules": "capsule",
    "sr caps": "capsule",
    "sr cap": "capsule",
    "inj": "injection",
    "injections": "injection",
    "injection": "injection",
    "syp": "syrup",
    "syr": "syrup",
    "syrup": "syrup",
    "syrups": "syrup",
    "susp": "suspension",
    "suspension": "suspension",
    "oint": "ointment",
    "ointment": "ointment",
    "gel": "gel",
    "cream": "cream",
    "crm": "cream",
    "sol": "solution",
    "solution": "solution",
    "drops": "solution",
    "eye drops": "solution",
    "ear drops": "solution",
    "nasal spray": "solution",
    "pwd": "powder",
    "powder": "powder",
    "inf": "infusion",
    "infusion": "infusion",
    "iv": "infusion",
}


def canonical_dosage_form(form: str | None) -> str | None:
    if not form:
        return None
    cleaned = re.sub(r"[^a-z0-9 ]", " ", str(form).casefold()).strip()
    return DOSAGE_FORM_MAP.get(cleaned, cleaned)


def split_brand_aliases(raw_brand: str) -> list[str]:
    """Extract individual brand aliases from slash- or delimiter-separated brand entries.
    e.g. 'Rozad / Razod / Razo-D' -> ['Rozad', 'Razod', 'Razo-D']
         'Ambulox / Ambulax / Ambulax M' -> ['Ambulox', 'Ambulax', 'Ambulax M']
    """
    if not raw_brand:
        return []
    parts = re.split(r"[/\\;]", raw_brand)
    aliases = [p.strip() for p in parts if p.strip()]
    return aliases if aliases else [raw_brand.strip()]


def compact_str(val: str) -> str:
    """Alphanumeric-only representation for punctuation/hyphen-invariant comparison.
    e.g. 'Razo-D' -> 'razod', 'Petril Plus' -> 'petrilplus'
    """
    return re.sub(r"[^a-z0-9]", "", str(val or "").casefold())


def clean_rx_name(raw: str) -> tuple[str, str | None, str | None]:
    """Cleans clinical prescription line tokens:
    - Strips dosage form prefixes: 'Tab. ', 'T. ', 'Cap. ', 'C. ', 'Inj. ', 'I. ', 'Syp. ', etc.
    - Strips dosage form suffixes: ' Tab', ' Tablet', ' Cap', ' Capsule', ' Inj', ' Syp', etc.
    - Extracts trailing strength number if attached to the brand name (e.g. 'Enotet 40' -> ('Enotet', '40mg', 'Tablet')).
    - Infers dosage form if indicated by the prefix/suffix.
    """
    if not raw:
        return "", None, None
    s = raw.strip()
    inferred_form = None
    if re.search(r"^(?:tab|tablet|t\.)\s+", s, flags=re.I) or re.search(r"\s+(?:tab|tablet|tablets)\.?$", s, flags=re.I):
        inferred_form = "Tablet"
    elif re.search(r"^(?:cap|capsule|c\.)\s+", s, flags=re.I) or re.search(r"\s+(?:cap|capsule|capsules)\.?$", s, flags=re.I):
        inferred_form = "Capsule"
    elif re.search(r"^(?:inj|injection|i\.)\s+", s, flags=re.I) or re.search(r"\s+(?:inj|injection)\.?$", s, flags=re.I):
        inferred_form = "Injection"
    elif re.search(r"^(?:syp|syrup|s\.)\s+", s, flags=re.I) or re.search(r"\s+(?:syp|syrup)\.?$", s, flags=re.I):
        inferred_form = "Syrup"

    s = re.sub(
        r"^(?:(?:tab|tablet|cap|capsule|syp|syrup|inj|injection|susp|suspension|drops|gel|oint|ointment|cream)\.?|\b[tcsei]\.)\s+",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(
        r"\s+(?:tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|susp|suspension|drops|gel|oint|ointment|cream)\.?$",
        "",
        s,
        flags=re.I,
    )
    s = s.strip()

    m = re.search(r"\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%)?)$", s, flags=re.I)
    extracted_str = None
    if m:
        val = m.group(1).strip()
        extracted_str = val if re.search(r"[a-z]", val, re.I) else f"{val}mg"
        base_name = s[:m.start()].strip()
    else:
        base_name = s
    return base_name, extracted_str, inferred_form


def _strengths(value: str) -> set[str]:
    matches = STRENGTH_RE.findall(value or "")
    return {re.sub(r"\s+", "", m.lower().replace("μ", "u")) for m in matches}


def _ingredient_tokens(value: str) -> set[str]:
    without_strength = STRENGTH_RE.sub(" ", value or "")
    return {
        token for token in re.findall(r"[a-z]+", normalize(without_strength))
        if token not in NON_INGREDIENT_WORDS and len(token) > 1
    }


def _candidate_score(extracted: ExtractedMedicine, row: dict[str, Any]) -> tuple[float, str]:
    raw_brand = str(row.get("brand_name") or "")
    raw_active_salt = str(row.get("active_salt") or "")

    base_name, rx_str, inferred_form = clean_rx_name(extracted.prescribed_name or "")
    form_to_use = extracted.dosage_form or inferred_form

    # Gate 1: Dosage form verification (do not treat different dosage forms as interchangeable)
    if form_to_use and row.get("dosage_form"):
        prescribed_form = canonical_dosage_form(form_to_use)
        catalogue_form = canonical_dosage_form(row.get("dosage_form"))
        if prescribed_form and catalogue_form and prescribed_form != catalogue_form:
            if compact_str(base_name or extracted.prescribed_name or "") in compact_str(raw_brand):
                logger.info(
                    "[Matching Diagnostic] Candidate '%s' rejected for '%s': mismatch_dosage_form (prescribed '%s' vs catalogue '%s')",
                    raw_brand,
                    extracted.prescribed_name,
                    prescribed_form,
                    catalogue_form,
                )
            return (0.0, "mismatch_dosage_form")

    # Gate 2: Strength conflict verification
    explicit_strengths = _strengths(" ".join(filter(None, [extracted.strength, extracted.active_salt])))
    expected_strengths = explicit_strengths or _strengths(" ".join(filter(None, [extracted.prescribed_name, rx_str])))
    catalogue_strengths = _strengths(" ".join(filter(None, [raw_active_salt, raw_brand])))

    is_strength_conflict = False
    if expected_strengths and catalogue_strengths:
        if not expected_strengths.issubset(catalogue_strengths) and expected_strengths != catalogue_strengths:
            is_strength_conflict = True

    # If explicit strength was specified and conflicts with catalogue, strictly reject
    if explicit_strengths and is_strength_conflict:
        if compact_str(extracted.prescribed_name or "") in compact_str(raw_brand):
            logger.info(
                "[Matching Diagnostic] Candidate '%s' rejected for '%s': mismatch_strength (prescribed %s vs catalogue %s)",
                raw_brand,
                extracted.prescribed_name,
                explicit_strengths,
                catalogue_strengths,
            )
        return (0.0, "mismatch_strength")

    # Gate 3: Active ingredients & combination verification
    extracted_ingredients = _ingredient_tokens(extracted.active_salt or "")
    catalogue_ingredients = _ingredient_tokens(raw_active_salt)

    if extracted_ingredients and catalogue_ingredients:
        # Rule: Do not match a single-ingredient medicine as an equivalent combination
        if len(catalogue_ingredients) >= 2 and len(extracted_ingredients) == 1:
            return (0.0, "mismatch_single_vs_combination")
        # Rule: Compare the complete combination
        if extracted_ingredients != catalogue_ingredients:
            return (0.0, "mismatch_ingredients")

    queries = [q for q in [extracted.prescribed_name, extracted.normalized_name, base_name] if q]
    query_pairs = [(normalize(q), compact_str(q)) for q in queries]

    full_brand_norm = normalize(raw_brand)
    full_brand_compact = compact_str(raw_brand)
    aliases = split_brand_aliases(raw_brand)

    # Priority 1: Exact normalized brand-name match
    brand_matched = any(
        q_norm == full_brand_norm or (len(q_compact) >= 3 and q_compact == full_brand_compact)
        for q_norm, q_compact in query_pairs
    )

    # Priority 2: Exact normalized match against individual aliases when brand_name contains slash-separated names
    alias_matched = False
    for alias in aliases:
        alias_norm = normalize(alias)
        alias_compact = compact_str(alias)
        if any(
            q_norm == alias_norm or (len(q_compact) >= 3 and q_compact == alias_compact)
            for q_norm, q_compact in query_pairs
        ):
            alias_matched = True
            break

    if brand_matched or alias_matched:
        if is_strength_conflict:
            logger.info(
                "[Matching Diagnostic] Candidate '%s' matched brand for '%s' but strength differs (prescribed %s vs catalogue %s) -> strength_variant",
                raw_brand,
                extracted.prescribed_name,
                expected_strengths,
                catalogue_strengths,
            )
            return (0.72, "strength_variant")
        if brand_matched:
            return (0.98, "exact_brand") if (not expected_strengths or expected_strengths == catalogue_strengths) else (0.96, "exact_brand")
        return (0.96, "exact_alias") if (not expected_strengths or expected_strengths == catalogue_strengths) else (0.94, "exact_alias")

    # If strength conflict occurred and brand was not an exact/alias match, reject immediately
    if is_strength_conflict:
        return (0.0, "mismatch_strength")

    # Priority 3: Match using active ingredients / composition, strength and dosage form
    if extracted_ingredients and extracted_ingredients == catalogue_ingredients:
        if expected_strengths and catalogue_strengths == expected_strengths:
            return (0.95, "exact_composition")
        if not expected_strengths:
            return (0.78, "composition")

    for q_norm, _ in query_pairs:
        if q_norm and q_norm == normalize(raw_active_salt):
            if not expected_strengths or expected_strengths == catalogue_strengths:
                return (0.94, "exact_composition")
            elif expected_strengths.issubset(catalogue_strengths):
                return (0.92, "exact_composition")

    # Priority 4: Fuzzy matching (suggests candidates, but never silently declares an uncertain match as exact)
    candidate_names = [full_brand_norm, normalize(raw_active_salt)]
    for alias in aliases:
        candidate_names.append(normalize(alias))

    fuzzy_max = 0.0
    for q_norm, _ in query_pairs:
        if not q_norm:
            continue
        for cand in candidate_names:
            if cand:
                ratio = SequenceMatcher(None, q_norm, cand).ratio()
                if ratio > fuzzy_max:
                    fuzzy_max = ratio

    if fuzzy_max >= 0.80:
        # Capped at 0.82 so fuzzy match never qualifies as exact (>= 0.90) but qualifies as a suggested candidate
        return (round(min(fuzzy_max * 0.95, 0.82), 2), "suggested_candidate")

    return (0.0, "none")


def match_medicine(extracted: ExtractedMedicine, catalogue: list[dict[str, Any]]) -> CatalogueMatch:
    logger.info(
        "[Matching Diagnostic] Prescribed: '%s', normalized: '%s', strength: '%s', dosage_form: '%s'",
        extracted.prescribed_name,
        extracted.normalized_name,
        extracted.strength,
        extracted.dosage_form,
    )
    scored_items: list[tuple[float, str, dict[str, Any]]] = []
    for row in catalogue:
        score, match_type = _candidate_score(extracted, row)
        if score >= 0.55:
            scored_items.append((score, match_type, row))

    scored_items.sort(key=lambda item: (-item[0], int(item[2]["id"])))
    alternatives = [
        CatalogueCandidate(
            medicine_id=int(row["id"]),
            brand_name=str(row.get("brand_name") or ""),
            active_salt=str(row.get("active_salt") or ""),
            dosage_form=str(row.get("dosage_form") or ""),
            match_confidence=score,
            match_type=match_type,
            match_status=(
                "Exact Match"
                if score >= 0.90 and match_type in ("exact_brand", "exact_alias", "exact_composition")
                else "Possible Match — Needs Review"
            ),
        )
        for score, match_type, row in scored_items[:3]
    ]

    if not scored_items:
        logger.info("[Matching Diagnostic] Rejection: No candidate reached match threshold for '%s'", extracted.prescribed_name)
        status = "needs_review" if (extracted.confidence is not None and extracted.confidence < 0.65) or extracted.needs_review else "not_found"
        return CatalogueMatch(
            status=status,
            match_status="No Match Found",
        )

    score, match_type, best = scored_items[0]
    logger.info(
        "[Matching Diagnostic] Matched candidate for '%s': id=%s, brand='%s', score=%s, type=%s",
        extracted.prescribed_name,
        best.get("id"),
        best.get("brand_name"),
        score,
        match_type,
    )
    extraction_is_uncertain = (extracted.confidence is not None and extracted.confidence < 0.65) or extracted.needs_review
    if score >= 0.90 and not extraction_is_uncertain and match_type in ("exact_brand", "exact_alias", "exact_composition"):
        status = "matched"
        match_status = "Exact Match"
    elif score >= 0.70 and not extraction_is_uncertain:
        status = "possible_match"
        match_status = "Possible Match — Needs Review"
    else:
        status = "needs_review"
        match_status = "Possible Match — Needs Review"

    return CatalogueMatch(
        status=status,
        match_status=match_status,
        medicine_id=int(best["id"]),
        brand_name=str(best.get("brand_name") or ""),
        active_salt=str(best.get("active_salt") or ""),
        dosage_form=str(best.get("dosage_form") or ""),
        match_confidence=score,
        match_type=match_type,
        alternatives=alternatives,
    )
