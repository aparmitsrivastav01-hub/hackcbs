# MedEasy — Product Requirements Document (MVP)

## 1. Document intent

This PRD defines the minimum shippable MedEasy vertical slice. Requirements marked **MUST** are release blockers. Requirements marked **SHOULD** matter but can be deferred if core reliability is at risk. **COULD** items are stretch/future scope.

## 2. Product objective

Enable a patient/caregiver to move from a reviewed medicine list to transparent catalogue price information, a local pharmacy availability enquiry and a source-linked batch-alert check—without MedEasy making clinical decisions or claiming live inventory/safety certification.

## 3. Success criteria

### Primary demo success

A user can, in one clean session:

1. Upload a synthetic prescription or manually search.
2. Review and explicitly confirm extracted medicine details.
3. Search the catalogue and view available price information.
4. Add an item to cart and adjust quantity.
5. Select a nearby pharmacy from a real Places result or clearly labelled demo directory.
6. Preview and open a prefilled WhatsApp enquiry.
7. Record a manual/simulated pharmacy response.
8. Check a supplied batch against a loaded, source-backed alert record or view the correct no-match/dataset-unavailable state.

### Reliability success

- No unhandled frontend crashes on normal error cases.
- No silent auto-search of unconfirmed OCR results.
- No fake data represented as live.
- No misleading “safe”, “authentic”, “in stock”, “sent” or “order placed” claims.
- Golden path repeatable from a clean browser session.

Do not define success using fabricated user, savings or pharmacy metrics.

## 4. Functional requirements

### FR-01 — Prescription upload

- **MUST** accept JPG/JPEG, PNG, WEBP and PDF as supported by backend.
- **MUST** enforce current reported 10 MB maximum and four-page PDF maximum, with backend authoritative validation.
- **MUST** show selected file/preview and allow remove/replace.
- **MUST** provide manual search fallback.
- **MUST** handle malformed, unsupported, oversized and failed uploads.

### FR-02 — AI extraction

- **MUST** call Gemini only through the backend.
- **MUST** receive structured output and validate it.
- **MUST** include confidence and uncertainty information per extracted medicine.
- **MUST** avoid inferring missing strength, formulation, dose, frequency or instructions.
- **MUST** show a clear AI-draft disclaimer.
- **MUST** keep extraction and search as separate actions.

### FR-03 — Human review gate

- **MUST** allow edit, add, remove, confirm and mark-unreadable per item.
- **MUST** block confirmed-search until at least one item is explicitly confirmed.
- **MUST** send only confirmed items to the confirmed-search endpoint.
- **MUST** preserve uncertain entries visibly; do not silently drop them.

### FR-04 — Medicine catalogue search

- **MUST** support manual medicine search.
- **MUST** support search of confirmed prescription items.
- **MUST** show returned catalogue name, active salt, dosage form, category and price fields where present.
- **MUST** handle empty, partial and error results.
- **SHOULD** provide category filters and simple sort where backend already supports them.

### FR-05 — Price comparison

- **MUST** show available private-brand, Jan Aushadhi and Dava India catalogue values separately.
- **MUST** display missing values as unavailable, not zero.
- **MUST** state catalogue values may differ from final pharmacy quote.
- **MUST** identify limitations around pack size, unit count, price type, source URL and freshness when those fields are missing.
- **MUST NOT** claim like-for-like savings unless product/strength/form/release type/pack comparability is verified.
- **MUST NOT** advise the user to switch to a cheaper product.
- **SHOULD** display source URL and checked date once validated fields are added.

### FR-06 — Cart

- **MUST** add/remove cart items and update quantities.
- **MUST** preserve state while moving to pharmacy search during the session.
- **MUST** label subtotal “Indicative catalogue subtotal” where calculated.
- **MUST NOT** expose payment, order-placement or checkout claims.

### FR-07 — Pharmacy discovery

- **MUST** support manual locality/PIN fallback.
- **SHOULD** support geolocation permission with explicit user action.
- **MUST** distinguish Places results from curated demo directory.
- **MUST** show a stock caveat near pharmacy results.
- **MUST NOT** infer inventory from provider place listings.
- **SHOULD** display provider-returned address, phone, hours and rating only when available.

### FR-08 — WhatsApp enquiry

- **MUST** show prefilled enquiry preview.
- **MUST** include only minimal cart details and questions needed to confirm availability/price/manufacturer/batch/expiry/delivery.
- **MUST** encode URL/message safely.
- **MUST** tell the user that WhatsApp opens and the user must press Send.
- **MUST** offer copy-message fallback if WhatsApp or phone details are unavailable.
- **MUST NOT** claim automated WhatsApp send/receive.

### FR-09 — Enquiry persistence and response

- **MUST** create/read/update enquiry using current backend routes.
- **MUST** inspect current API schema before implementation.
- **MUST** label manual or simulated response source.
- **MUST** handle backend save/update failures.
- **MUST NOT** expose enquiry records publicly without auth/ownership controls.

### FR-10 — CDSCO batch-alert check

- **MUST** submit product, manufacturer and batch to the backend checker.
- **MUST** handle `alert_match`, `manual_review_required`, `no_matching_alert_found` and `dataset_unavailable` outcomes, adapting to actual backend response values.
- **MUST** show alert source and date on matches.
- **MUST** display dataset coverage/update details only when known.
- **MUST** state no-match is not a safety certificate.
- **MUST NOT** claim real-time CDSCO crawl or full national coverage.
- **MUST NOT** import raw OCR-extracted 260-row file as verified records without source review and normalization.

### FR-11 — About/data-source disclosures

- **MUST** disclose catalogue and CDSCO data limitations.
- **MUST** distinguish live provider records from demo/curated records.
- **MUST** explain the app does not diagnose, prescribe, substitute, dispense or certify.

## 5. Non-functional requirements

### NFR-01 — Security and privacy

- Gemini secrets stay server-side.
- No secrets in Git, browser bundle or logs.
- Prescription uploads are transient and not persisted by default.
- Logs must avoid patient-identifying and prescription content.
- CORS must be limited to intended origins.
- Public deployment of enquiry endpoints requires authentication/authorization.

### NFR-02 — Performance

- Show progress for network/AI requests.
- Use finite timeout/retry behavior; do not retry expensive AI calls indefinitely.
- Keep medicine search responsive; catalogue is small enough for existing pandas-backed implementation.
- Lazy-load map provider where feasible.

### NFR-03 — Accessibility

- Keyboard-accessible forms and controls.
- Visible focus.
- Proper labels/errors.
- Color is not the only status indicator.
- Mobile layout usable at 360 px viewport width.

### NFR-04 — Maintainability

- Reuse existing React + Vite and FastAPI code.
- Typed/validated request and response handling.
- Tests for comparison logic, upload validation, confirmation gate, enquiry response and batch matching.
- Document any API/model changes.

## 6. MVP scope priority

### P0 — must be demonstrated

1. App entry, scan/search choice.
2. Prescription upload and Gemini draft extraction.
3. Editable per-item review and explicit confirmation.
4. Confirmed search and medicine results.
5. Transparent price comparison.
6. Cart with quantity.
7. Pharmacy list/map (live Places or labelled demo fallback).
8. WhatsApp preview and manual handoff.
9. Enquiry create + manual/demo response.
10. Batch-alert check with all honest result states.
11. Safety/data disclosure and end-to-end tests.

### P1 — if P0 stable

- Better prescription crop-to-item association.
- Add catalogue provenance/pack metadata.
- More robust alert data QA and coverage UI.
- Better pharmacy response UX.
- Demo script/seed utilities.

### P2 — post-MVP

- Pack photo OCR cross-check.
- Customer/pharmacy authentication and role management.
- WhatsApp Business Cloud API send/receive.
- Verified live pharmacy stock integrations.
- Orders, payments, fulfilment.
- Voice/Hindi, reminders, analytics and larger datasets.

## 7. Out-of-scope requirements

- Clinical advice, diagnoses, dosing advice.
- Automated brand/generic substitution.
- Safety/authenticity guarantees.
- Full live stock marketplace.
- Nationwide 7,900+ CDSCO dataset claim.
- Automated WhatsApp messaging.
- Payment and order fulfilment.

## 8. Definition of done

MVP may be called demo-ready only when:

- The golden path works from a clean session.
- OCR review gate is enforced and low-confidence path is shown.
- Price fields and caveats are truthful.
- Cart quantity and subtotal behavior is correct.
- Pharmacy results are truthfully labelled.
- WhatsApp message is previewed and not falsely marked sent.
- Enquiry response is persisted and correctly labelled manual/demo.
- Batch check works with a source-backed test alert and no-match/dataset-unavailable tests.
- All P0 error states work.
- Existing tests plus new relevant tests pass.
- Frontend production build succeeds.
- Secrets and real patient data are absent from repository.
- Demo rehearsal is repeatable.

## 9. Manual founder inputs required

- Confirm event/competition rules around previously developed code and seek organizer guidance.
- Provide access to the actual frontend and backend repositories to the coding agent.
- Supply/confirm approved synthetic prescription for demo.
- Confirm actual API keys and allowed provider configuration in local secrets (do not paste keys into code/Markdown).
- Confirm the source/provenance for each catalogue price if public price claims are planned.
- Review any imported CDSCO row before it is used to show a real alert.
- Decide whether pharmacy records are live Places or a curated demo dataset; do not let the agent silently choose.
