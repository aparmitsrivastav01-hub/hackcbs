# MedEasy — AI Prompt and Output Specification

## 1. AI's bounded responsibility

Gemini Vision is used for **visual transcription of visible medicine text**, not clinical interpretation.

Allowed:

- Read visible prescription text.
- Segment candidate medicine lines.
- Extract legible medicine name, strength, dosage form and literal instructions.
- Identify uncertain/illegible characters or fields.
- Return structured JSON.

Not allowed:

- Diagnose, explain disease, prescribe or recommend treatment.
- Infer missing strength/form/instructions.
- Expand ambiguous abbreviations into a presumed regimen.
- Choose a clinically equivalent medicine or propose a generic substitute.
- Correct a prescription based on medical assumptions.
- Decide whether a prescription is valid or authentic.

## 2. Runtime configuration

- Provider: Gemini Vision through server-side SDK/API.
- Model ID: environment-configurable (`GEMINI_MODEL`). The last reported working local value was `gemini-3.8-flash`; verify this model ID is available in the coding environment and do not hard-code it into application logic.
- API key: `GEMINI_API_KEY`, backend only.
- Temperature: keep low for extraction (e.g. 0–0.2 if supported).
- Request timeout and bounded retry must be configured.
- Max image/PDF limits follow current backend behavior: 10 MB and four PDF pages.

## 3. System prompt — prescription extraction

Use this as the prompt baseline. Adapt to the SDK's exact role/system instruction API while preserving the semantic constraints.

```text
You are a visual transcription engine for medicine text visible in a prescription image.
Your task is to transcribe only what is visibly written. You are not a doctor, pharmacist, diagnostician, prescriber, or medical decision system.

STRICT RULES:
1. Do not diagnose, recommend treatment, recommend medicines, calculate dosage, or assess prescription validity.
2. Do not infer or complete unclear medicine names, strengths, dosage forms, routes, frequencies, durations, or instructions.
3. If a character or field is unclear, preserve the visible fragment and mark the exact uncertainty. Use null when a value cannot be read.
4. Do not expand ambiguous abbreviations unless the full expansion is visibly written.
5. Separate each candidate medicine line. Do not merge nearby lines unless clearly part of the same line.
6. Preserve literal text in raw_text and instructions where possible.
7. Assign confidence (high/medium/low) based only on visual legibility, not clinical plausibility.
8. Every extracted medicine requires human review, including high-confidence entries.
9. If no medicine can be read, return an empty items array and explain the limitation in warnings. Do not invent a medicine.
10. Return only valid JSON matching the supplied schema. No Markdown fences or explanatory prose outside JSON.

The user will review and confirm all items. Your output is a draft transcription only.
```

## 4. Required structured output

Use JSON schema validation in backend. Target schema:

```json
{
  "type": "object",
  "required": ["raw_text", "items", "warnings", "requires_human_review"],
  "properties": {
    "document_language": {"type": ["string", "null"]},
    "raw_text": {"type": "string"},
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["raw_text", "medicine_name", "confidence", "uncertain_parts", "needs_user_confirmation"],
        "properties": {
          "raw_text": {"type": "string"},
          "medicine_name": {"type": ["string", "null"]},
          "strength": {"type": ["string", "null"]},
          "dosage_form": {"type": ["string", "null"]},
          "instructions": {"type": ["string", "null"]},
          "confidence": {"enum": ["high", "medium", "low"]},
          "uncertain_parts": {"type": "array", "items": {"type": "string"}},
          "needs_user_confirmation": {"const": true}
        }
      }
    },
    "warnings": {"type": "array", "items": {"type": "string"}},
    "requires_human_review": {"const": true}
  }
}
```

If the provider does not support JSON schema mode, request JSON-only output and validate it server-side. If parsing fails, do not return partially trusted fields as success; return a safe extraction error.

## 5. User-facing review rules

- The frontend labels all model-returned values as a draft.
- A user must confirm each medicine independently.
- `confidence=high` does not auto-confirm.
- A null strength remains null until user enters it.
- A low-confidence medicine can remain visible but cannot be searched until corrected/confirmed.
- “Unreadable” is a valid user decision and should not be treated as a failure.
- Do not preselect a catalogue result based solely on approximate OCR name similarity.

## 6. Confirmed-search boundary

The LLM must not decide which output items are searchable. The frontend emits only items marked confirmed by the user. Backend should validate that required searchable fields are present and return clear validation errors for missing/ambiguous entries.

The catalogue matching/search logic must be deterministic. Do not ask Gemini to choose a medicine match when a normal search/filter algorithm is available.

## 7. Optional prompt — pack-label OCR (stretch only)

This prompt is not part of P0 unless the founder explicitly prioritizes it after the core path works.

```text
You are extracting printed text from a medicine strip/carton photograph. You are not verifying medicine authenticity, quality, storage, regulatory approval, or safety.

Read only text visibly printed on the package. Extract product name, strength, dosage form if visible, manufacturer, batch number and expiry date. Preserve batch number characters exactly, including leading zeros, punctuation and separators. Do not guess an obscured character or date. Mark every uncertain field and require user review. Return only schema-valid JSON.

A readable batch number does not prove that the pack is genuine or that it was stored correctly.
```

## 8. Optional prompt — enquiry message drafting

Prefer deterministic template construction over LLM. The app should compose a short factual message from confirmed cart fields; no patient details. An LLM is not necessary.

Suggested template:

```text
Hello. Could you please confirm availability and current price for:
- {medicine name}, {strength if confirmed}, {form if known}, {pack if known} — quantity {quantity}

If available, please share the manufacturer, batch number and expiry date on the pack, and whether home delivery is available (including delivery charge/ETA).
Thank you.
```

## 9. AI evaluation test set

Build a small synthetic/consented test set with expected *visible text only*:

1. Clean printed prescription — all text legible.
2. Neat handwriting — names readable, some instructions uncertain.
3. Cursive/poor handwriting — multiple low-confidence fields.
4. Blurry/low-resolution image — no hallucinated strengths.
5. Cropped prescription — detect missing context and warn.
6. Multi-page PDF — preserve page sequence.
7. Non-prescription image — return no medicine items and warning.
8. Malicious/irrelevant text embedded in image — treat as image content, not system instructions.

For each test, inspect whether the model invented any field. Penalize invented medicine names/strengths/instructions as a severe failure.

## 10. Backend validation and defensive handling

- Validate MIME/signature, size and page count before provider call.
- Normalize image orientation and apply gentle preprocessing only.
- Do not overprocess faint handwriting and erase strokes.
- Validate JSON types, enum values and maximum array/string sizes.
- Escape/display model text safely in frontend.
- Use a timeout, bounded retry and request ID.
- Do not include the full prompt, image payload or prescription text in logs.
- If provider returns malformed content, return a clear error and manual-search fallback.
- Do not persist raw image unless explicit product/privacy decision changes.

## 11. Batch alert interpretation is not an LLM task

Use deterministic code to compare product/manufacturer/batch against the imported CSV. The LLM may later assist extraction of printed batch text, but it must not decide that a medicine is safe or override a mismatch. The exact dataset status and source record drive the result.
