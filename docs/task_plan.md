# MedEasy — Task Plan, Roadmap and Founder Manual Checkpoints

## 1. Operating rule

Build one end-to-end vertical slice. Keep the current working app stable. Every phase has:

- Agent tasks.
- Deliverable.
- Acceptance gate.
- **FOUNDER MUST DO MANUALLY** — the agent cannot complete or claim these actions on the founder's behalf.

Do not begin P1/P2 work while a P0 gate is failing.

## 2. First 30 minutes — baseline and decisions

### Agent tasks

1. Inspect frontend and backend repositories; locate app entry points and existing screens.
2. Run backend tests and frontend lint/typecheck/build; record baseline.
3. Read `.env.example`; confirm required env var names without printing secret values.
4. Start backend and capture `/openapi.json` or `/docs` contract.
5. Verify catalogue file exists, exact row count, column names, price null rate and duplicate IDs.
6. Verify CDSCO file exists, actual row count and exact expected columns; confirm whether it is empty.
7. Identify current frontend API base URL and CORS configuration.
8. Produce a short file-by-file change plan; do not rewrite app structure yet.

### Deliverable

A baseline note: what runs, what fails, known API schemas, source files, env variables and top 5 blockers.

### Acceptance gate

- Existing app starts, or current blocker is clearly identified.
- No secret value appears in terminal output, logs or docs.
- Agent can explain existing architecture and API contract.

### FOUNDER MUST DO MANUALLY

- Give the agent access to the actual frontend and backend source folders/repositories on the machine where it is running.
- Confirm which repository/branch is the active source of truth.
- Ask HackCBS organizers how the pre-existing-project/code rule applies to the work already done; follow their answer honestly.
- Supply the approved synthetic prescription and one verified demo batch-alert record, if available.

## 3. Phase 1 — make the golden path work (priority P0)

### Agent tasks

1. Build/repair API client and environment configuration.
2. Connect upload screen to `/api/prescriptions/extract`.
3. Normalize extraction response into UI view model.
4. Build editable review cards with confirm/unreadable/remove/add states.
5. Enforce the confirmation gate in frontend and backend call site.
6. Connect confirmed items to `/api/prescriptions/search-confirmed`.
7. Render results with source fields and honest no-result states.
8. Add manual search fallback if OCR fails.

### Deliverable

Upload → extract → edit/confirm → search works end-to-end with actual backend responses.

### Acceptance gate

- A clean sample can be extracted.
- A poor/unclear sample visibly asks for correction.
- Zero unconfirmed items are sent to search.
- Manual search works during OCR/provider failure.

### FOUNDER MUST DO MANUALLY

- Test at least one synthetic clean prescription and one genuinely difficult/low-confidence sample.
- Confirm medicine name/strength in the sample against the original synthetic source; never use a real patient's prescription without consent.
- Decide which medicine item is the canonical demo example.
- Manually inspect one extraction result before calling the screen demo-ready.

## 4. Phase 2 — transparent catalogue and comparison

### Agent tasks

1. Connect search and compare routes using actual OpenAPI schema.
2. Build result cards and comparison screen.
3. Treat null/invalid/zero values correctly; do not use missing as ₹0.
4. Show source/pack/freshness caveat when the dataset lacks metadata.
5. Show savings only if existing backend data proves comparable pack semantics; otherwise hide savings and show raw listed prices.
6. Add tests for lower alternative, missing price, no saving and invalid value cases.

### Deliverable

A user can search a confirmed/manual medicine, inspect listed prices and add a catalogue item to cart.

### Acceptance gate

- Prices match the exact CSV row and backend response.
- No fabricated source, timestamp, pack size or discount.
- All missing-value paths render correctly.
- No substitute/recommendation wording exists.

### FOUNDER MUST DO MANUALLY

- Confirm the allowed price source for each source column; private-brand pricing must follow the Tata 1mg-only instruction recorded in the project.
- Check a small sample of product prices against original source pages/records and note the check date.
- Decide whether any product rows have verified like-for-like pack sizes. If not, approve the catalogue-only disclaimer and no-savings display.
- Confirm exact spelling/display naming for the canonical demo medicine.

## 5. Phase 3 — cart and pharmacy discovery

### Agent tasks

1. Implement cart state with add/remove/quantity.
2. Label subtotal as indicative catalogue subtotal.
3. Implement manual locality/PIN search and optional geolocation after user action.
4. Integrate Google Places only if current key, APIs and billing are verified.
5. Add provider label, stock caveat and map/list interaction.
6. Provide clearly labelled curated demo directory fallback if needed.

### Deliverable

Cart → pharmacy results → selected pharmacy works on desktop and mobile.

### Acceptance gate

- Cart survives the route transition to map/list.
- Geolocation denial has a useful manual fallback.
- Places results are distinguishable from demo directory records.
- UI never claims stock based on map listing.

### FOUNDER MUST DO MANUALLY

- Confirm Google Cloud project, enabled Places/Maps APIs, billing and HTTP-referrer restrictions in the console. Do not paste the key into Markdown or chat.
- Test live pharmacy results from the actual demo location on the target device/browser.
- If live Places does not work, approve use of a clearly labelled demo directory and provide its real test data.
- Verify the pharmacy name/address/phone displayed in the demo.

## 6. Phase 4 — WhatsApp handoff and enquiry response

### Agent tasks

1. Create message template from selected pharmacy + cart.
2. Preview message before opening.
3. URL-encode message and `wa.me` destination.
4. Save enquiry with current backend endpoint.
5. Add copy-text fallback and no-phone fallback.
6. Build simple manual response form using current PATCH contract.
7. Label manually entered or seeded response source.

### Deliverable

A saved enquiry, a prefilled WhatsApp chat link and a manually recordable pharmacy response.

### Acceptance gate

- Message includes only required medicine/cart details.
- User is clearly told to press Send.
- UI never claims message sent/delivered.
- Enquiry persistence is tested.
- If demo response is simulated, the screen visibly says so.

### FOUNDER MUST DO MANUALLY

- Verify the selected pharmacy phone number before a live demo.
- Review the exact WhatsApp message for sensitive information; remove any patient name, diagnosis or full prescription image.
- Open the WhatsApp link on the demo device and confirm it pre-fills correctly. Decide whether to actually send it during demo.
- If using a seeded shopkeeper response, approve the values and label them simulated; never pass them off as a real partner reply.

## 7. Phase 5 — batch-alert data and checker

### Agent tasks

1. Call dataset-status endpoint and render coverage.
2. Audit exact CDSCO import schema.
3. Validate loaded CSV file count and malformed rows.
4. Import only reviewed records with source URL/date/product/manufacturer/batch.
5. Connect batch check form to checker.
6. Render match/manual-review/no-match/dataset-unavailable states.
7. Add deterministic tests for exact, case/spacing normalized, mismatch and missing dataset cases.

### Deliverable

A source-linked batch-alert result or honest no-match/unavailable response.

### Acceptance gate

- Known source-backed sample returns expected record.
- Product/manufacturer mismatch does not become definitive match.
- No match is not green “safe”.
- Source URL and notice date appear for alert matches.
- Coverage metadata is not fabricated.

### FOUNDER MUST DO MANUALLY

- Review each CDSCO demo record against its original official PDF/page before importing as a confirmed alert.
- Do not use raw OCR rows from the 260-record partial file without QA; scanned June 2021 rows were known to contain extraction errors.
- Confirm the demo alert record's product, manufacturer, batch, alert type and source URL.
- Confirm whether any corrigendum, later lab result or regulatory follow-up changes the presentation.

## 8. Phase 6 — integration, security and regression

### Agent tasks

1. Test frontend-to-backend calls from the separate frontend laptop.
2. Confirm backend is bound to `0.0.0.0:8000`, correct LAN IP is used and CORS origin matches.
3. Test all empty/error/loading/denied states.
4. Ensure temporary uploads are cleaned up and images are not persisted by default.
5. Verify no secrets in repository/diff/build output.
6. Restrict public exposure of enquiry routes; if no auth, keep app private/local for judging.
7. Run backend tests, frontend lint/typecheck/build and end-to-end golden path.
8. Commit a known-good checkpoint before final polish.

### Deliverable

Stable build, test report and clean demo branch/commit.

### Acceptance gate

- Golden path can be repeated from a clean session.
- Regression suite passes.
- No console errors that break primary flow.
- Demo data is seeded in a deterministic way and labelled.

### FOUNDER MUST DO MANUALLY

- Test from the actual demo laptop and network; do not rely on the agent's localhost-only check.
- Rotate any API key that was previously exposed in a screenshot/chat/log; confirm the old key is revoked.
- Check GitHub/repository visibility and remove patient data/secrets before sharing.
- Approve whether the build is local/private demo only or safe to expose publicly. Do not publicly deploy unprotected enquiry APIs.

## 9. Phase 7 — demo and presentation

### Agent tasks

1. Prepare deterministic demo dataset (synthetic prescription + known catalogue item + pharmacy response + source-backed batch record).
2. Write a 2.5–3 minute demo sequence.
3. Add a fallback route that starts with manual search if OCR/network fails.
4. Prepare a backup screen recording only if the team has time and can verify it.
5. Freeze features; fix only P0 issues.

### Deliverable

A reproducible demo, concise pitch and known limitations sheet.

### Acceptance gate

- No manual DB editing mid-demo.
- No simulated data represented as live.
- Team can answer why price values may not be comparable, what Maps does/does not show, how WhatsApp works and what a no-match batch result means.

### FOUNDER MUST DO MANUALLY

- Rehearse the demo on the exact device/network and browser used for judging.
- Verify all links, source URLs, pharmacy details and data labels.
- Decide which actions are live and which are simulated; disclose this in the demo.
- Prepare the pitch and answer sheet; do not claim features that are not working.

## 10. 24-hour execution schedule (adapt to organizer start time)

| Time from official start | Goal | Work focus | Gate |
|---|---|---|---|
| 0–1 h | Scope + API freeze | Baseline, rules, roles, OpenAPI contract | No coding against assumed schemas |
| 1–4 h | Core vertical slice | Upload/review/confirmed search | OCR review gate works |
| 4–7 h | Price comparison + cart | Correct values, caveats, quantity | Cart total semantics clear |
| 7–10 h | Pharmacy discovery | Live Places or labelled fallback | Pharmacy source truthful |
| 10–13 h | Enquiry + batch checker | WhatsApp preview, response form, exact alert | No fake send/safety claims |
| 13–16 h | Integration hardening | Cross-laptop, errors, validation | Golden path works |
| 16–19 h | QA and polish | Mobile/responsive, seeded demo, copy | No P0 bugs |
| 19–21 h | Judge prep | Pitch, Q&A, mentor feedback | Limitations explained |
| 21–23 h | Freeze | Regression, clean commit, backup | No risky features |
| 23–24 h | Present | Demo and submission | Reproducible story |

## 11. Duo team split

### Builder A — frontend and demo experience

- Upload/review UI.
- Search/results/comparison cards.
- Cart.
- Pharmacy map/list.
- WhatsApp handoff.
- Responsive UI and demo flow.

### Builder B — backend/data/safety

- API stability and OpenAPI contract.
- Catalogue search/price logic.
- Enquiry persistence and response endpoints.
- CDSCO data validation/import and matching.
- Tests/logging/security.

### Both

- Scope, API contract and merge checkpoints.
- Golden path rehearsal.
- Judge Q&A and final presentation.
