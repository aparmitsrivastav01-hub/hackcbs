# MedEasy — Product Idea and Product Truth

## 1. Product definition

**MedEasy is a medicine affordability and pharmacy-coordination tool that connects prescription understanding, transparent catalogue price information, local pharmacy enquiries and batch-alert awareness.**

**One-line pitch:** From a reviewed prescription to a pharmacy enquiry and a traceable batch-alert check — in one workflow.

MedEasy is designed for a patient or caregiver who has a paper prescription or a known medicine name and needs to understand the written medicine details, compare the prices available in a catalogue, contact a nearby pharmacy about exact-pack availability, and check any supplied batch number against published regulatory alerts.

It is an information and coordination layer. It does not diagnose, prescribe, dispense, sell, authenticate or certify medicines as safe.

## 2. Core user problem

After receiving a prescription, a patient/caregiver may need to perform several disconnected tasks:

- Read medicine names and strengths from handwritten or printed text.
- Check what was actually written before searching.
- Find the correct medicine entry in a catalogue.
- Understand listed prices from available sources.
- Identify a nearby pharmacy and ask whether the exact product and pack are available.
- Ask the shopkeeper for manufacturer, batch and expiry information.
- Check whether supplied batch details appear in an official quality alert.

MedEasy joins these tasks into a guided flow while keeping clinical decisions with the prescriber/pharmacist and the user in control of confirmation.

## 3. Target users

### Primary: patient or caregiver

- Has a prescription or known medicine list.
- Wants to review medicine names and strengths before proceeding.
- Wants transparent price information, not an opaque recommendation.
- Prefers a nearby physical pharmacy or wants to check before travelling.
- Wants to ask about the exact product, pack, batch and expiry.

### Secondary: local pharmacist/shopkeeper

- Receives an availability enquiry.
- Confirms exact product/pack, stock, price, manufacturer, batch, expiry and delivery availability.
- Uses a simple form or reply flow; MedEasy is not intended to replace the pharmacy's POS/ERP.

### Not target MVP users

Doctors prescribing through MedEasy, pharmacies needing a full inventory-management suite, or consumers expecting a photo to prove authenticity.

## 4. Core product journey

1. **Start:** upload a prescription or search a medicine manually.
2. **Extract:** Gemini Vision returns a structured draft of visible text.
3. **Review:** user checks the source image, corrects the fields and explicitly confirms each medicine.
4. **Compare:** backend searches the 300-row catalogue and returns listed private-brand, Jan Aushadhi and Dava India values when available.
5. **Cart:** user adds selected catalogue entries and sets quantities.
6. **Find a pharmacy:** user grants location permission or enters a locality/PIN code; map/list results show known pharmacy places.
7. **Enquire:** user selects a pharmacy; MedEasy prepares a minimal, prefilled WhatsApp message and saves an enquiry record.
8. **Confirm details:** user or shopkeeper records availability, quoted price, manufacturer, batch, expiry and delivery details.
9. **Batch check:** MedEasy checks the exact supplied batch against the currently imported CDSCO alert CSV and shows the source/coverage state.
10. **Optional later feature:** after receiving the pack, user uploads a package photo; OCR reads text and user confirms it before comparing it to the shopkeeper record. This is a stretch/future feature, not core MVP.

## 5. Differentiation hypothesis

Prescription OCR, medicine price comparison, maps and regulatory alert portals are not individually unique. MedEasy's product hypothesis is the connected local-pharmacy loop:

**price information → exact local pharmacy enquiry → manufacturer/batch/expiry captured → source-linked alert check.**

This is a hypothesis that the demo must prove, not a market-leadership claim. Do not say “first”, “only”, “guaranteed savings” or “verified genuine medicine”.

## 6. Product modules

### A. Prescription understanding

Accept JPG/JPEG, PNG, WEBP and PDF files, subject to the backend's currently reported limit of 10 MB and up to four PDF pages. Return a draft containing raw visible text, medicine name, strength, dosage form, instructions, confidence and uncertainty markers. The UI must ask for human review. Extraction must not trigger catalogue search automatically.

### B. Medicine catalogue and comparison

Current CSV schema:

`id, brand_name, active_salt, dosage_form, private_brand_price, jan_aushadhi_price, dava_india_price, category`

The conversation records the founder's instruction that private-brand prices must be sourced only from Tata 1mg. Jan Aushadhi/Dava India values exist in the supplied dataset, but their per-row provenance, pack comparability and freshness still need validation.

The current schema does not include pack size, unit count, price type, source URL or checked timestamp. Treat price display as catalogue information with a visible limitation note. Do not claim a like-for-like saving unless exact pack comparability is established.

For values that are comparable:

- Private-brand price is the baseline.
- Lower available Jan Aushadhi/Dava India price can be displayed as the lowest listed alternative.
- `difference = private_price - lower_alternative_price`.
- `difference_percent = difference / private_price * 100` when private price is positive.
- If inputs are missing, incomparable or invalid, show “comparison unavailable”. If the difference is negative, show “no saving at listed prices”.

Do not call an alternative clinically equivalent or recommend switching. The app presents information only; a qualified professional advises on substitution.

### C. Cart

Local frontend state is sufficient for the MVP. The cart is an enquiry list, not a purchase order. It must show an indicative catalogue subtotal, clearly caveated, and must not imply a confirmed pharmacy quote, final checkout or payment.

### D. Nearby pharmacies

Use Google Maps Platform Places only when the API key, enabled APIs, billing/quota, referrer restrictions and actual live search are tested. Place metadata is not an inventory feed. If Places cannot be used, show a curated test directory with a clear “demo directory” label. Never blend curated test entries into a list presented as live Places data.

### E. WhatsApp enquiry

Generate a user-clicked `https://wa.me/<number>?text=<encoded>` link. The user reviews and presses Send in WhatsApp. The backend can store an enquiry and a manually supplied shopkeeper response. Do not claim automated WhatsApp send, delivery confirmation or reply ingestion.

The enquiry should contain only information required to ask about the cart. Do not automatically transmit full prescription images, diagnosis, patient name, phone number or instructions.

### F. CDSCO batch-alert check

The backend accepts product name, manufacturer and batch number and checks a local CSV with the fields:

`product_name, manufacturer, batch_number, alert_type, notice_date, source_name, source_url, notes`

The described checker uses normalized exact batch matching plus product/manufacturer compatibility. It is not a live CDSCO API or scraper. Every match must show its source and notice date. No-match copy must state that it only means no match was found in the currently imported dataset.

The available historical extraction was partial: 205 rows from four uploaded PDFs (including low-confidence OCR-derived rows from a scanned 2021 report) plus 55 manually transcribed June 2025 rows, for 260 raw/partially reviewed rows. This is not a complete 7,900-row or nationwide database. The updated 260-row file was not yet normalized to the backend's eight-column import schema. Do not load it as verified alerts without review.

### G. Pack photo cross-check — stretch/future

OCR of a delivered pack may read product, strength, manufacturer, batch and expiry. The user must review the extracted fields. The result can compare pack fields with the shopkeeper record and alert dataset. Use wording such as “pack details cross-check” or “batch-alert check”, not “authenticity verification”.

## 7. What exists vs. what remains

| Area | Known status from project history | Required behavior now |
|---|---|---|
| 300-row catalogue | CSV supplied and loaded in backend archive | Verify actual local data file and provenance before claiming current contents. |
| FastAPI catalogue/search/compare | Implemented and previously tested | Re-run tests and inspect current OpenAPI contract. |
| Gemini prescription extraction | Implemented; clean sample worked, cursive sample had low confidence | Keep review gate; test error/uncertainty states. |
| Confirmed prescription search | Separate backend endpoint exists | Ensure frontend only calls it after user confirmation. |
| Cart | Frontend was developed separately; code not included here | Inspect current frontend; verify add/remove/quantity. |
| Maps/Places | Google key was added per founder report; live behavior not independently verified | Prove real Places lookup or label fallback. |
| WhatsApp click-to-chat | Designed/defined | User manually sends; never imply backend send. |
| Pharmacy enquiry APIs | SQLite-backed create/read/manual response APIs implemented | Verify schemas and persistence; add auth before exposing publicly. |
| CDSCO matcher | CSV-backed checker implemented | Load only a reviewed, normalized dataset; expose coverage. |
| CDSCO records | Partial extraction only | Do not claim completeness; review source PDFs before import. |
| Photo OCR | Proposed | Stretch only. |
| Authentication | Not implemented in described backend | Required before public multi-user use of enquiry records. |
| Online order/payment | Not implemented | Explicitly out of scope. |

## 8. Non-goals

- Diagnosis, treatment advice, dosing calculation or prescription modification.
- Generic substitution recommendations or “equivalent medicine” decisions.
- Automated prescription approval.
- Live pharmacy inventory unless a real partner integration is built and tested.
- Automatic WhatsApp send/receive.
- Order placement, checkout, payment or fulfilment.
- Medicine authenticity, storage-condition or safety certification.
- Real-time CDSCO crawling or claims of complete alert coverage.
- User accounts/merchant accounts unless auth is completed and tested.
- Nationwide medicine coverage, full pharmacy onboarding or voice assistant in the MVP.

## 9. Demo narrative

A caregiver has a synthetic prescription. MedEasy extracts likely medicine lines, then the caregiver corrects and confirms one. The app searches the catalogue and shows the available listed price fields with caveats. The caregiver adds an item to the cart, chooses a listed local pharmacy, and opens a WhatsApp message asking about exact availability, quoted price, manufacturer, batch and expiry. The shopkeeper response is captured through a demo form (labelled if simulated). The batch checker returns a source-linked match or the carefully worded no-match state.

**Close:** “MedEasy does not decide what medicine a person should take. It helps users review what was prescribed, understand available price information, contact a nearby pharmacy for the exact product, and check supplied batch details against published regulatory alerts — with the user and pharmacist kept in control.”
