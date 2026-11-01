import logging
import re
from difflib import SequenceMatcher
from typing import Any, NamedTuple

from app.models.prescription_schemas import CatalogueCandidate, CatalogueMatch, ExtractedMedicine
from app.services.search_service import normalize

logger = logging.getLogger(__name__)

STRENGTH_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%|units?)\b", re.I)
RATIO_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*[\+/]\s*(\d+(?:\.\d+)?)\b")

LEADING_NUMBERING_RE = re.compile(
    r"^(?:(?:\(?\d+[\.\)\-:]|\([a-z]\)|[①-⑳•\-\*#])\s*|\b(?:rx|r/x)\.?\s*)+",
    re.I,
)
DOSAGE_FORM_PREFIX_RE = re.compile(
    r"^(?:(?:tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|susp|suspension|drops|eye drops|ear drops|gel|oint|ointment|cream|respules?|rotacaps?|inhaler)\.?|\b[tcsei]\.)\s+",
    re.I,
)
DURATION_RE = re.compile(
    r"(?:(?:x|for)\s+)?\b(\d+\s*(?:days?|ds|weeks?|wks?|months?|mths?|d\b))\s*$",
    re.I,
)
SIG_RE = re.compile(
    r"(?:\b(?:\d+(?:/\d+)?|\bhalf\b)\s*(?:tabs?|tablets?|caps?|capsules?|pills?|cap|tab)?\s*)?"
    r"(?:\b(?:[012]-[012]-[012](?:-[012])?|[012]\s+[012]\s+[012]|\d+\s*(?:times?\s+a\s+day|daily)|od|bd|bid|tds|tid|qid|hs|qhs|sos|stat|prn|bbf|ac|pc)\b\s*)+"
    r"(?:\b(?:\d+(?:/\d+)?|\bhalf\b)\s*(?:tabs?|tablets?|caps?|capsules?|pills?|cap|tab)?\b\s*)?$",
    re.I,
)
DOSAGE_FORM_SUFFIX_RE = re.compile(
    r"\s+(?:tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|susp|suspension|drops|gel|oint|ointment|cream)\.?$",
    re.I,
)
RATIO_STRENGTH_RE = re.compile(
    r"[\(\s]+(\d+(?:\.\d+)?\s*[\+/]\s*\d+(?:\.\d+)?(?:\s*(?:mg|mcg|g))?)\s*[\)]?$",
    re.I,
)
SINGLE_STRENGTH_RE = re.compile(
    r"\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%)?)$",
    re.I,
)
BRAND_EXTENSION_RE = re.compile(
    r"\s+\b(DSR|DS|SR|MR|CR|ER|XL|XR|LA|DT|CT|AM|H|L|LS|OZ|SP|AP|M|Forte)\b$",
    re.I,
)

NON_INGREDIENT_WORDS = {
    "mg", "mcg", "ug", "g", "ml", "iu", "unit", "units", "tablet", "tablets", "tab", "tabs",
    "capsule", "capsules", "cap", "caps", "injection", "inj", "syrup", "solution", "suspension",
    "oral", "sodium", "potassium", "calcium", "hydrochloride", "hydrobromide", "hcl", "hbr",
    "maleate", "sulphate", "sulfate", "phosphate", "acetate", "citrate", "monohydrate", "trihydrate",
    "bromide", "nitrate", "oxide", "hydrate", "acid", "delayed", "release", "extended", "film", "coated",
}

DOSAGE_FORM_MAP = {
    "t": "tablet",
    "tab": "tablet",
    "tabs": "tablet",
    "tablet": "tablet",
    "tablets": "tablet",
    "c": "capsule",
    "cap": "capsule",
    "caps": "capsule",
    "capsule": "capsule",
    "capsules": "capsule",
    "sr caps": "capsule",
    "sr cap": "capsule",
    "i": "injection",
    "inj": "injection",
    "injections": "injection",
    "injection": "injection",
    "s": "syrup",
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


class CleanedRxInfo(NamedTuple):
    clean_name: str
    strength: str | None
    dosage_form: str | None
    base_brand: str | None = None
    instructions: str | None = None
    duration: str | None = None


def clean_rx_name(raw: str) -> CleanedRxInfo:
    """Cleans clinical prescription line tokens:
    - Strips leading numbering/bullets/Rx ('1. ', '2) ', '• ', 'Rx ', etc.)
    - Identifies and strips dosage form prefixes: 'Tab. ', 'T. ', 'Cap. ', 'C. ', 'Inj. ', 'I. ', 'Syp. ', etc.
    - Identifies and strips trailing duration: '10 days', '30 ds', '2 wks', 'x 10 days', etc.
    - Identifies and strips trailing sig/frequency codes: '1-0-1', '1 HS', '1 OD', '1 tab OD', '1 cap OD', etc.
    - Identifies and strips dosage form suffixes: ' Tab', ' Tablet', ' Cap', ' Capsule', ' Inj', ' Syp', etc.
    - Extracts trailing combination ratio strengths (e.g. '0.5+10', '0.5/10') and single strengths (e.g. '40', '40mg').
    - Separates brand extensions/modifiers (e.g. 'Razod DSR' -> 'Razod', 'Ambulox M' -> 'Ambulox').
    - Infers dosage form if indicated by the prefix/suffix.
    """
    if not raw:
        return CleanedRxInfo("", None, None, None, None, None)
    s = raw.strip()

    # 1. Strip leading list numbering, bullets, Rx
    s = LEADING_NUMBERING_RE.sub("", s).strip()

    # 2. Inferred form from prefix
    inferred_form = None
    if re.search(r"^(?:tab|tablet|tablets|t\.)\s+", s, re.I):
        inferred_form = "Tablet"
    elif re.search(r"^(?:cap|capsule|capsules|c\.)\s+", s, re.I):
        inferred_form = "Capsule"
    elif re.search(r"^(?:inj|injection|i\.)\s+", s, re.I):
        inferred_form = "Injection"
    elif re.search(r"^(?:syp|syrup|s\.)\s+", s, re.I):
        inferred_form = "Syrup"
    s = DOSAGE_FORM_PREFIX_RE.sub("", s).strip()

    # 3. Trailing duration
    duration = None
    m_dur = DURATION_RE.search(s)
    if m_dur:
        duration = m_dur.group(1).strip()
        s = s[:m_dur.start()].strip()

    # 4. Trailing sig / frequency / quantity
    instructions = None
    m_sig = SIG_RE.search(s)
    if m_sig:
        instructions = m_sig.group(0).strip()
        s = s[:m_sig.start()].strip()

    # 5. Trailing dosage form suffix
    if DOSAGE_FORM_SUFFIX_RE.search(s):
        if not inferred_form:
            if re.search(r"\s+(?:tab|tablet|tablets)\.?$", s, re.I):
                inferred_form = "Tablet"
            elif re.search(r"\s+(?:cap|capsule|capsules)\.?$", s, re.I):
                inferred_form = "Capsule"
        s = DOSAGE_FORM_SUFFIX_RE.sub("", s).strip()

    # 6. Trailing strength (ratio or single)
    strength = None
    m_ratio = RATIO_STRENGTH_RE.search(s)
    if m_ratio:
        strength = m_ratio.group(1).strip()
        s = s[:m_ratio.start()].strip()
    else:
        m_single = SINGLE_STRENGTH_RE.search(s)
        if m_single:
            val = m_single.group(1).strip()
            strength = val if re.search(r"[a-z%]", val, re.I) else f"{val}mg"
            s = s[:m_single.start()].strip()

    # 7. Brand extension
    base_brand = s
    m_ext = BRAND_EXTENSION_RE.search(s)
    if m_ext:
        base_brand = s[:m_ext.start()].strip()

    clean_name = s
    return CleanedRxInfo(clean_name, strength, inferred_form, base_brand, instructions, duration)


def _strengths(value: str) -> set[str]:
    matches = STRENGTH_RE.findall(value or "")
    res = {re.sub(r"\s+", "", m.lower().replace("μ", "u")) for m in matches}
    for m in RATIO_RE.finditer(value or ""):
        n1, n2 = m.group(1), m.group(2)
        res.add(f"{n1}mg")
        res.add(f"{n2}mg")
    return res


def _ingredient_tokens(value: str) -> set[str]:
    without_strength = STRENGTH_RE.sub(" ", value or "")
    return {
        token for token in re.findall(r"[a-z]+", normalize(without_strength))
        if token not in NON_INGREDIENT_WORDS and len(token) > 1
    }


def _candidate_score(extracted: ExtractedMedicine, row: dict[str, Any]) -> tuple[float, str]:
    raw_brand = str(row.get("brand_name") or "")
    if not raw_brand:
        return (0.0, "none")

    raw_active_salt = str(row.get("active_salt") or "")
    aliases = split_brand_aliases(raw_brand)

    # Clean clinical prescription line tokens
    clean_info = clean_rx_name(extracted.prescribed_name or "")
    clean_name = clean_info.clean_name
    rx_str = clean_info.strength
    inferred_form = clean_info.dosage_form
    base_brand = clean_info.base_brand
    form_to_use = extracted.dosage_form or inferred_form

    # Gate 1: Dosage form verification (canonical maps 't'/'tab' to tablet, 'c'/'cap' to capsule)
    if form_to_use and row.get("dosage_form"):
        prescribed_form = canonical_dosage_form(form_to_use)
        catalogue_form = canonical_dosage_form(row.get("dosage_form"))
        if prescribed_form and catalogue_form and prescribed_form != catalogue_form:
            return (0.0, "mismatch_dosage_form")

    # Gate 2: Strength conflict verification
    explicit_strengths = _strengths(" ".join(filter(None, [extracted.strength, extracted.active_salt])))
    expected_strengths = explicit_strengths or _strengths(" ".join(filter(None, [extracted.prescribed_name, rx_str])))
    catalogue_strengths = _strengths(" ".join(filter(None, [raw_active_salt, raw_brand])))
    is_strength_conflict = bool(
        expected_strengths and catalogue_strengths
        and not expected_strengths.issubset(catalogue_strengths)
        and expected_strengths != catalogue_strengths
    )

    # If explicit strength was specified and conflicts with catalogue, strictly reject
    if explicit_strengths and is_strength_conflict:
        return (0.0, "mismatch_strength")

    # Gate 3: Active ingredients verification
    extracted_ingredients = _ingredient_tokens(extracted.active_salt or "")
    catalogue_ingredients = _ingredient_tokens(raw_active_salt)
    if extracted_ingredients and catalogue_ingredients:
        if len(catalogue_ingredients) >= 2 and len(extracted_ingredients) == 1:
            return (0.0, "mismatch_single_vs_combination")
        if extracted_ingredients != catalogue_ingredients:
            return (0.0, "mismatch_ingredients")

    # Build queries to compare: full prescribed name, cleaned name, and base brand
    raw_queries = [q for q in [extracted.prescribed_name, extracted.normalized_name, clean_name, base_brand] if q]
    expanded_queries = list(raw_queries)
    for q in raw_queries:
        stripped = re.sub(r"\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|iu|%)?$", "", q, flags=re.I).strip()
        if stripped and stripped not in expanded_queries:
            expanded_queries.append(stripped)

    query_pairs = [(normalize(q), compact_str(q)) for q in expanded_queries]
    full_brand_norm = normalize(raw_brand)
    full_brand_compact = compact_str(raw_brand)

    # 1. Exact normalized brand or alias match
    brand_matched = any(
        q_norm == full_brand_norm or (len(q_compact) >= 3 and q_compact == full_brand_compact)
        for q_norm, q_compact in query_pairs
    )

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
            return (0.72, "strength_variant")
        return (0.98 if brand_matched else 0.96, "exact_brand" if brand_matched else "exact_alias")

    # If strength conflict occurred and brand was not an exact/alias match, reject immediately
    if is_strength_conflict:
        return (0.0, "mismatch_strength")

    # 2. Substring matching for aliases
    for alias in aliases:
        a_compact = compact_str(alias)
        for _, q_compact in query_pairs:
            if len(q_compact) >= 4 and len(a_compact) >= 4:
                if q_compact in a_compact or a_compact in q_compact:
                    return (0.92, "exact_alias")

    # 3. Fuzzy match for OCR spelling mistakes (e.g. Pestril Plus vs Petril Plus, Pantil Plus vs Petril Plus)
    best_fuzzy = 0.0
    candidate_targets = [full_brand_norm] + [normalize(a) for a in aliases]
    for q_norm, q_compact in query_pairs:
        if not q_norm:
            continue
        for target in candidate_targets:
            if not target:
                continue
            r1 = SequenceMatcher(None, q_norm, target).ratio()
            r2 = SequenceMatcher(None, q_compact, compact_str(target)).ratio()
            best_fuzzy = max(best_fuzzy, r1, r2)

    if best_fuzzy >= 0.75:
        return (round(min(best_fuzzy * 0.90, 0.82), 2), "suggested_candidate")

    # 4. Fallback: match using active composition if available
    for q_norm, _ in query_pairs:
        if q_norm and q_norm == normalize(raw_active_salt):
            return (0.94, "exact_composition")

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
