import re
from difflib import SequenceMatcher
from typing import Any

FIELDS = ("brand_name", "active_salt", "dosage_form")
STRENGTH_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%|units?)\b", re.I)


def normalize(value: Any) -> str:
    text = "" if value is None else str(value).casefold()
    text = text.replace("μ", "u")
    text = re.sub(r"(?<=\d)\s*(?=(?:mg|mcg|ug|g|ml|iu|%|units?)\b)", " ", text)
    return " ".join(re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", text))


def _strengths(text: str) -> set[str]:
    return {normalize(item).replace(" ", "") for item in STRENGTH_RE.findall(text)}


def _field_score(query: str, value: str) -> float:
    candidate = normalize(value)
    if not candidate:
        return 0
    if query == candidate:
        return 100
    if "/" in str(value):
        aliases = [normalize(alias) for alias in str(value).split("/") if alias.strip()]
        if any(query == alias for alias in aliases):
            return 100
    if query in candidate:
        return 82
    query_tokens, candidate_tokens = query.split(), candidate.split()
    matched = sum(any(tok == word or (len(tok) >= 4 and SequenceMatcher(None, tok, word).ratio() >= .84) for word in candidate_tokens) for tok in query_tokens)
    coverage = matched / max(len(query_tokens), 1)
    if coverage == 1 and query_tokens:
        return 68
    if coverage >= .6:
        return 48 * coverage
    # Typo tolerance only on the meaningful non-strength words.
    ratio = SequenceMatcher(None, query, candidate).ratio()
    return 44 * ratio if ratio >= .78 else 0


def rank_medicine(query: str, row: dict[str, Any]) -> float:
    q = normalize(query)
    q_strengths = _strengths(query)
    candidate_text = " ".join(str(row.get(field) or "") for field in FIELDS)
    candidate_strengths = _strengths(candidate_text)
    # With a requested strength, require the ingredient and strength in the same
    # catalogue field and in the same order. Merely containing that number elsewhere
    # in a combination medicine must not create a false match.
    values = [normalize(row.get(field)) for field in FIELDS]
    if q_strengths:
        exact_strength_phrase = any(q in value for value in values)
        # Permit a small typo in the ingredient while keeping its strength bound
        # to that ingredient in the catalogue field.
        fuzzy_strength_phrase = False
        unit_words = {"mg", "mcg", "ug", "g", "ml", "iu", "unit", "units"}
        query_words = [word for word in q.split() if not word.isdigit() and word not in unit_words]
        for value in values:
            words = value.split()
            for index, word in enumerate(words):
                if word.isdigit() and index + 1 < len(words):
                    strength = (word + words[index + 1]).replace(" ", "")
                    if strength not in q_strengths:
                        continue
                    preceding = words[max(0, index - 3):index]
                    if any(
                        SequenceMatcher(None, wanted, found).ratio() >= .84
                        for wanted in query_words for found in preceding
                    ):
                        fuzzy_strength_phrase = True
        if not exact_strength_phrase and not fuzzy_strength_phrase:
            return 0
    scores = [_field_score(q, str(row.get(field) or "")) for field in FIELDS]
    score = max(scores, default=0)
    if q_strengths and score and not any(q in value for value in values):
        score = max(score, 68)
    if q_strengths:
        score += 15
    return score


def search_rows(query: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = [(rank_medicine(query, row), row) for row in rows]
    ranked = [(score, row) for score, row in ranked if score > 0]
    ranked.sort(key=lambda item: (-item[0], int(item[1]["id"])))
    return [row for _, row in ranked]
