# MedEasy — Coding Agent Handoff Pack

> **Purpose:** Give a coding agent the product context, implementation boundaries, UX direction, API expectations and phase-by-phase execution plan required to build MedEasy without repeatedly asking the founder to restate the idea.
>
> **Product sentence:** MedEasy connects user-reviewed prescription understanding, medicine price information, local pharmacy availability enquiries and traceable batch-alert checks in one workflow.

## Read order — mandatory

The agent must read these files in this order before editing code:

1. [`idea.md`](idea.md) — product thesis, users, scope and non-goals.
2. [`prd_requirements.md`](prd_requirements.md) — normative MVP requirements and acceptance criteria.
3. [`architecture.md`](architecture.md) — component boundaries and runtime topology.
4. [`datamodels.md`](datamodels.md) — entities, field semantics and data-quality rules.
5. [`api_spec.md`](api_spec.md) — endpoint inventory and integration contract.
6. [`userflows.md`](userflows.md) — happy paths, branches and failure paths.
7. [`mvp_screens.md`](mvp_screens.md) — screen inventory and required states.
8. [`ui_ux_guidelines.md`](ui_ux_guidelines.md) — visual system and interaction rules.
9. [`ai_prompt_spec.md`](ai_prompt_spec.md) — Gemini Vision prompting and output validation.
10. [`task_plan.md`](task_plan.md) — phase-by-phase execution, acceptance gates and founder manual checkpoints.
11. [`roadmap.md`](roadmap.md) — post-MVP roadmap and final scope freeze checklist.

When a requirement conflicts across files, use this precedence:

1. Safety and privacy rules in `prd_requirements.md`.
2. Explicit product decisions in `idea.md`.
3. API and model compatibility rules in `api_spec.md` and `datamodels.md`.
4. UX expression in `mvp_screens.md` and `ui_ux_guidelines.md`.
5. Task ordering in `task_plan_roadmap.md`.

Do not silently resolve a conflict by inventing functionality. Record it in `DECISIONS_NEEDED` in the implementation notes and ask the founder only when it blocks progress.

## Product in one paragraph

A patient or caregiver can upload a prescription or manually search for a medicine. Gemini Vision can extract visible medicine details, but the user must correct and confirm the draft before those details are searched. MedEasy shows prices found in a bundled 300-row medicine catalogue, with clear source/pack/freshness caveats; it does not recommend switching medicines. The user can build a cart, discover listed nearby pharmacies, select one, and open a prefilled WhatsApp enquiry that the user manually sends. Pharmacy responses can be captured in a simple form. A provided product/manufacturer/batch can be checked against a locally imported CDSCO alert CSV. A no-match result is never a safety certificate.

## Locked MVP: one vertical slice

**Upload/search → review/confirm → compare → cart → pharmacy selection → WhatsApp enquiry → record response → batch-alert check.**

Prioritize a reliable, reproducible golden path over breadth. A manual medicine search is the fallback if OCR fails. A curated pharmacy test directory is an explicitly labelled fallback if live Places lookup is unavailable. A seeded pharmacy response is allowed only when clearly labelled as demo/simulated data.

## Status labels the agent must preserve

- **Existing / reported implemented:** FastAPI catalogue/search/comparison routes; Gemini prescription extraction; explicit confirmed-prescription search route; SQLite-backed pharmacy enquiry create/read/response routes; CSV-backed CDSCO batch checker. Backend tests previously reported as passing (7 tests) and `py_compile` passed.
- **Exists but must be re-verified in the current checkout:** all backend route shapes, actual response field names, current data files, model configuration and persistence configuration. Inspect the repository and `/openapi.json` before wiring the frontend.
- **Frontend reported as separate work:** React + Vite interface; the frontend source is not part of this handoff pack. Inspect it before replacing components or creating a second app.
- **Incomplete / proposed:** price provenance and pack comparability metadata; live Google Places behavior; real pharmacy inventory; automated WhatsApp; full CDSCO historical coverage; post-delivery pack-photo cross-check; authentication/authorization.

## Hard product boundaries — do not violate

1. MedEasy is not a doctor, diagnostic system, prescriber, dispenser, e-pharmacy, payment processor or order-fulfilment platform.
2. OCR is a draft transcription, never a verified prescription. The user reviews and confirms every candidate item before catalogue search.
3. Do not infer unclear drug strength, release type, dose, frequency, route or instructions. Preserve uncertainty and ask for manual correction.
4. Do not recommend, rank or automatically substitute a cheaper medicine as clinically equivalent. Catalogue comparisons are price-information only. A qualified prescriber/pharmacist determines whether a different product may be dispensed.
5. Pharmacy place listings do not establish live stock. Stock must be confirmed directly by the pharmacy.
6. A `wa.me` click-to-chat URL does not mean MedEasy sent or received a WhatsApp message. The user manually sends the prefilled message.
7. A batch match is a source-linked alert match against the currently imported dataset. A no-match means only that no matching record was found in that dataset; it does not prove safety, authenticity or quality.
8. CDSCO records are partial until sourced, normalized, checked for corrections and verified. Never claim “7,900+ records” or complete nationwide coverage unless proven in the deployed data.
9. Never invent prices, pharmacies, stock, alert records, sources, savings, partnerships, testimonials, or clinical outcomes.
10. Do not store prescription images or sensitive patient details unless the founder explicitly approves a necessary, privacy-reviewed feature.

## Current project assumptions

| Area | Decision for MVP |
|---|---|
| Frontend | Reuse existing React + Vite frontend if available; do not start a parallel app without checking. |
| Backend | Existing Python + FastAPI service. |
| Catalogue | CSV-backed 300-row dataset, loaded with pandas. |
| OCR / vision | Gemini Vision, server-side only. |
| Pharmacy enquiry persistence | Existing SQLite implementation; verify persistent storage if deployed. |
| Batch alerts | Local CSV import using `product_name, manufacturer, batch_number, alert_type, notice_date, source_name, source_url, notes`. |
| Map / place search | Google Maps Platform Places if key, billing, enabled APIs and live results are verified; otherwise labelled curated fallback. |
| WhatsApp | User-initiated `wa.me` prefilled message. |
| Auth | Not implemented in described backend; no public production exposure of private enquiry endpoints without auth. |
| Currency | INR (₹). |
| Locale | India-first; English MVP. Hindi/voice is future scope unless already built and tested. |

## Critical founder checkpoint before coding

The project history says that HackCBS 9.0's public FAQ stated that pre-existing project work/code was not allowed before the official start. The team has also described prior work on MedEasy. The founder must ask the organizer how this applies and follow the official ruling. Do not hide prior work, falsify timestamps or claim all code was written during the event if that is not true.

## Agent operating protocol

Before coding:

- Inspect the actual frontend and backend repositories.
- Identify the current branch, run the existing tests and record the baseline.
- Read `.env.example`, not secret `.env` values; never print or commit secrets.
- Inspect FastAPI Swagger/OpenAPI (`/docs` or `/openapi.json`) and reconcile every request/response against `api_spec.md`.
- Confirm the CSV filenames, column names, row count and null rates. Do not assume that an empty template is a populated dataset.
- Write a short implementation plan with files to modify and tests to run.

While coding:

- Prefer small vertical slices and preserve working functionality.
- Do not change endpoint paths or data semantics without updating this pack and adding compatibility tests.
- Keep AI output structured and schema-validated. Treat model text as untrusted input.
- Keep price, matching and savings logic deterministic in code, not delegated to the LLM.
- Add loading, empty, permission-denied, timeout and error states.
- Never present seed/mock data as live data.
- Update the docs when a meaningful architecture or scope decision changes.

Before completion:

- Run backend tests, frontend lint/type checks/build and the end-to-end golden path.
- Test OCR low-confidence and unreadable cases, not only a clean sample.
- Test location denied, Places empty/error, WhatsApp not installed, no alert dataset and no-match states.
- Confirm no secrets or patient data are in Git history/current diff.
- Make the demo repeatable from a clean browser/session.

## Founder manual checkpoint convention

Every phase in `task_plan_roadmap.md` contains a **FOUNDER MUST DO MANUALLY** section. The coding agent must:

1. Stop at that phase gate.
2. Present the founder with the exact decision or evidence needed.
3. Do not claim the manual task is complete on the founder's behalf.
4. Continue with non-blocked implementation tasks where possible.

## Delivery expectation

The final MVP should let a judge complete the primary user journey without a developer manually editing database rows mid-demo. It must label all data limitations and simulated states. One reliable end-to-end journey is the definition of success; feature count is not.
