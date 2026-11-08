# MedEasy Read-Only Audit Report

**Audit scope:** repository source, bundled CSV files, live API checks on `127.0.0.1:8000`, and two unique live TinyFish discovery requests (one subsequent request was served from the in-memory cache). No source/config file was changed for this audit. The only allowed report output is this file. No API key, token, password, or `.env` value is included.

**Evidence labels:** `WORKING` means an endpoint or flow was actually called and produced the described result. `BROKEN` means it was called but failed its intended outcome. `STUB` means code returns static/demo data instead of the intended live behavior. `UNVERIFIED` means source exists but a successful live path was not observed.

## 1. STRUCTURE

Repository root: `/Users/ns-mac-008/Documents/GitHub/hackcbs`.

```text
backend/
  app/
    api/routes/       cart.py, health.py, medicines.py, pharmacies.py,
                      prescriptions.py, safety.py
    core/             config.py
    data/             MedEasy_catalogue_500_complete.csv
                      MedEasy_CDSCO_extraction_updated.csv
    models/           schemas.py, prescription_schemas.py, cart_schemas.py,
                      pharmacy_schemas.py, safety_schemas.py
    services/         medicine_service.py, search_service.py, price_service.py,
                      cart_service.py, pharmacy_service.py, tinyfish_service.py,
                      cdsco_safety_service.py, prescription/...
    main.py
  tests/              conftest.py, test_cart_pharmacy.py, test_medicines.py,
                      test_prescriptions.py, test_safety.py
  requirements.txt
  README.md
frontend/
  src/
    api/client.ts, types.ts, App.tsx, main.tsx
    components/home/, components/layout/
    context/CartContext.tsx
    pages/             About, BatchSafety, Cart, DataSources, Help, Home,
                       HowItWorks, MedicineDetail, Medicines, Scan, Stores
    assets/
  public/
  index.html, package.json, vite.config.ts
dist/                 built frontend assets (present in repo)
docs/                 product and API documentation
```

`backend/app/main.py:23-61` creates the FastAPI app, loads both CSV-backed services at lifespan startup, and registers routers. `frontend/src/main.tsx` is the React entry point; `frontend/index.html` is the Vite document entry. `frontend/src/App.tsx` composes routes/pages. `backend/app/core/config.py:6-8` derives the backend data path and loads the ignored `.env` file.

Exact local start commands from the READMEs:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

The backend was live and responded on `127.0.0.1:8000` during this audit. Frontend startup/build was **not run**.

## 2. ENDPOINTS

Schemas below are the Pydantic request/response models from the live OpenAPI document. Negative-path requests (404/503) verify route handling, but do not verify successful stateful operations.

| Method and path | Request schema | Response schema | Handler (`file:function`) | Status and evidence |
|---|---|---|---|---|
| GET `/api/health` | None | `HealthResponse` | `backend/app/api/routes/health.py:9-11` `health` | **WORKING** — 200, `catalogue_records: 500`. |
| GET `/api/medicines/search` | query `q` | `SearchResponse` | `backend/app/api/routes/medicines.py:26-32` `search_medicines` | **WORKING** — Paracetamol 500 mg returned 200 and 2 records. |
| GET `/api/medicines/maximum-savings` | optional query `provider` | `MaximumSavingsResponse` | `backend/app/api/routes/medicines.py:35-40` `get_maximum_savings` | **WORKING** — unfiltered and Jan Aushadhi-filtered calls returned 200; top list had 10 entries. |
| GET `/api/medicines/categories` | None | `CategoriesResponse` | `backend/app/api/routes/medicines.py:43-46` `get_categories` | **WORKING** — 200, 16 categories. |
| GET `/api/medicines/{medicine_id}` | path `medicine_id:int` | `MedicineResponse` | `backend/app/api/routes/medicines.py:49-54` `get_medicine` | **WORKING** — ID 1 returned 200. |
| POST `/api/prescriptions/scan` | multipart field `file` | `PrescriptionScanResponse` | `backend/app/api/routes/prescriptions.py:29-55` `scan_prescription` | **WORKING** — exact uploaded JPEG returned 200 and 5 extracted medicines. No catalogue matches. |
| GET `/api/prescriptions/{prescription_id}` | path `prescription_id` | `PrescriptionRecordResponse` | `backend/app/api/routes/prescriptions.py:58-66` `get_prescription` | **WORKING** — a scanned record returned 200. |
| GET `/api/prescriptions/{prescription_id}/medicines` | path `prescription_id` | `PrescriptionMedicinesResponse` | `backend/app/api/routes/prescriptions.py:69-77` `get_prescription_medicines` | **WORKING** — scanned record returned 200. |
| GET `/api/prescriptions/{prescription_id}/summary` | path `prescription_id` | `PrescriptionSummary` | `backend/app/api/routes/prescriptions.py:80-88` `get_prescription_summary` | **WORKING** — scanned record returned 200. |
| POST `/api/cart/add` | `CartAddRequest` | `CartResponse`, 201 | `backend/app/api/routes/cart.py:13-33` `add_to_cart` | **WORKING** — actual catalogue ID 1 added, 201. |
| GET `/api/cart` | query `cart_session_id` | `CartResponse` | `backend/app/api/routes/cart.py:36-38` `get_cart` | **WORKING** — returned the test cart, 200. |
| PUT `/api/cart/update/{item_id}` | path `item_id`; `CartUpdateRequest` | `CartResponse` | `backend/app/api/routes/cart.py:41-61` `update_cart_item` | **WORKING** — quantity update returned 200. |
| DELETE `/api/cart/remove/{item_id}` | path `item_id`; query `cart_session_id` | `CartResponse` | `backend/app/api/routes/cart.py:64-74` `remove_cart_item` | **WORKING** — test item removed, 200. |
| DELETE `/api/cart/clear` | query `cart_session_id` | `CartResponse` | `backend/app/api/routes/cart.py:76-81` `clear_cart` | **WORKING** — returned empty cart, 200. |
| POST `/api/pharmacies/nearby` | `NearbyPharmaciesRequest` | `NearbyPharmaciesResponse` | `backend/app/api/routes/pharmacies.py:23-32` `nearby_pharmacies` | **BROKEN/degraded** — live TinyFish-backed call took 80.44 s and returned 200 with 0 stores and warning `Some pharmacy discovery tasks failed; this result may be incomplete.` |
| POST `/api/pharmacies/enquiry/create` | `EnquiryCreateRequest` | `PharmacyEnquiryResponse`, 201 | `backend/app/api/routes/pharmacies.py:35-42` `create_enquiry` | **UNVERIFIED** — success path not possible because live discovery returned no store; invalid store correctly returned 404 `Pharmacy store not found`. |
| POST `/api/pharmacies/enquiry/{enquiry_id}/verify-batch` | path `enquiry_id`; `EnquiryBatchVerifyRequest` | `PharmacyEnquiryRecord` | `backend/app/api/routes/pharmacies.py:45-60` `verify_enquiry_batch` | **UNVERIFIED** — invalid enquiry returned 404 `Enquiry not found`; successful verification path not observed. |
| GET `/api/pharmacies/enquiry/{enquiry_id}` | path `enquiry_id` | `PharmacyEnquiryRecord` | `backend/app/api/routes/pharmacies.py:63-68` `get_enquiry` | **UNVERIFIED** — invalid ID correctly returned 404; valid enquiry unavailable. |
| PATCH `/api/pharmacies/enquiry/{enquiry_id}/status` | path `enquiry_id`; `EnquiryStatusUpdate` | `PharmacyEnquiryRecord` | `backend/app/api/routes/pharmacies.py:71-76` `update_enquiry_status` | **UNVERIFIED** — invalid ID correctly returned 404; valid update not observed. |
| GET `/api/safety/check-batch` | query `product_name`, `batch_number`, optional `manufacturer` | `SafetyCheckResponse` | `backend/app/api/routes/safety.py:32-41` `check_batch` | **WORKING** — actual CSV batch returned 200 `NEEDS_REVIEW`. |
| GET `/api/safety/check-medicine` | query `medicine_name` | `MedicineSafetySearchResponse` | `backend/app/api/routes/safety.py:43-52` `check_medicine` | **WORKING** — Dextrose returned 200 `NEEDS_REVIEW`, explicitly not a confirmed batch match. |
| GET `/api/safety/alerts` | queries `offset`, `limit` | `SafetyAlertsResponse` | `backend/app/api/routes/safety.py:54-69` `list_alerts` | **WORKING** — 200, 260 total. |
| GET `/api/safety/alerts/{alert_id}` | path `alert_id` | `SafetyAlert` | `backend/app/api/routes/safety.py:71-76` `get_alert` | **WORKING** — real alert ID returned 200. |
| PATCH `/api/safety/alerts/{alert_id}/review` | path `alert_id`; `SafetyReviewRequest`; header `X-CDSCO-Review-Key` | `SafetyAlert` | `backend/app/api/routes/safety.py:79-105` `review_alert` | **BROKEN/unconfigured** — valid-shaped request returned 503 `Manual CDSCO review is not configured`; `CDSCO_REVIEW_API_KEY` is required. |
| GET `/api/batch-safety/dataset-status` | None | `SafetyDatasetStatusResponse` | `backend/app/api/routes/safety.py:24-29` `dataset_status` | **WORKING** — 200, 260 loaded, 260 review-pending, 0 verified. |
| GET `/api/batch-safety/alerts` | queries `offset`, `limit` | `SafetyAlertsResponse` | `backend/app/api/routes/safety.py:54-69` `list_alerts` | **WORKING** — 200, 260 total. |
| GET `/api/batch-safety/check-batch` | query `product_name`, `batch_number`, optional `manufacturer` | `SafetyCheckResponse` | `backend/app/api/routes/safety.py:32-41` `check_batch` | **WORKING** — actual CSV batch returned 200 `NEEDS_REVIEW`. |

The successful API checks are runtime evidence; the pytest suite was **not run in this read-only audit**. Error-path responses above do not establish success-path behavior for enquiries or manual review.

## 3. PRESCRIPTION PIPELINE

**Observed path:** multipart file upload → `validate_document` checks size, file signature, MIME/format, pixel limit, and image decode → original image bytes and MIME type go to Gemini → JSON is validated as `ExtractionResult` → duplicate extraction entries are removed → each entry is matched against loaded catalogue rows → catalogue prices/savings are attached only for a `matched` entry → response is stored in in-memory `_prescriptions`.

Evidence: `backend/app/api/routes/prescriptions.py:29-55`; `backend/app/services/prescription/document_service.py:7-71`; `backend/app/services/prescription/prescription_service.py:20-70,92-143`.

The current document service is validation, not image enhancement: no crop, perspective correction, rotation, contrast, or deskew step was found. Gemini receives the original bytes (`extraction_service.py:74-84`). The successful run was the attached handwritten image; no patient name/contact details are reproduced here. It returned 5 medicine entries, 0 matched catalogue records, 5 unmatched, and ₹0 potential savings. This means extraction ran, but the requested medicine-to-price objective did not complete.

**Gemini model:** `GeminiExtractionProvider` reads `GEMINI_MODEL` and otherwise uses the code default at `backend/app/services/prescription/extraction_service.py:43-47`. The active `.env` value is intentionally not printed under the audit's secret-handling rule. The Gemini integration was actually invoked; the successful `/scan` returned HTTP 200.

**Prompt, verbatim** (`backend/app/services/prescription/extraction_service.py:29-31`):

> Read the prescription and extract every medicine that is actually prescribed. Return JSON only in this exact shape: `{"medicines":[{"prescribed_name":string|null,"normalized_name":string|null,"active_salt":string|null,"strength":string|null,"dosage_form":string|null,"dosage_instructions":string|null,"duration":string|null,"confidence":number|null}]}`. Preserve the written prescribed_name. Normalize spelling/casing only when legible; do not infer unreadable text. Use null for any unreadable or absent field. Extract all medicine lines, including uncertain handwriting, and lower confidence when uncertain. Do not include diagnoses, tests, investigation names, patient/doctor details, or general notes as medicines. Do not invent medicine names, strengths, forms, instructions, or durations. Avoid duplicate lines unless their instructions differ.

Structured output has a `medicines` list and optional nullable fields `prescribed_name`, `normalized_name`, `active_salt`, `strength`, `dosage_form`, `dosage_instructions`, `duration`, and numeric `confidence` constrained to `[0,1]` (`backend/app/models/prescription_schemas.py:5-18`). The endpoint response wraps each extracted medicine with match, prices, and savings fields (`:61-73,86-104`).

Error handling: empty/oversize/unsupported/corrupt input maps to 400/413/415; missing key 503; provider timeout 504; provider or parse error 502; zero medicines 422 (`prescriptions.py:34-55`). The API response deliberately returns generic provider errors. Current sanitized provider logging records upstream error type/detail and redacts recognized key patterns (`extraction_service.py:34-40,89-94`).

**Actual end-to-end scan evidence:** `POST /api/prescriptions/scan` returned 200. The extracted medicines did not match the catalogue, so the API correctly returned nullable prices and savings. The complete prescription response is retained only in server memory for the process lifetime; it was not written to disk by this pipeline.

## 4. CATALOGUE MATCHING

Actual file: `backend/app/data/MedEasy_catalogue_500_complete.csv`. Pandas inspection and live health endpoint both show **500 rows**. Columns, in file order:

`id`, `brand_name`, `active_salt`, `dosage_form`, `private_brand_price`, `jan_aushadhi_price`, `dava_india_price`, `category`.

Three actual sample rows:

| id | brand_name | active_salt | dosage_form | private_brand_price | jan_aushadhi_price | dava_india_price | category |
|---:|---|---|---|---:|---:|---:|---|
| 1 | Zerodol-P | Aceclofenac + Paracetamol (100 mg + 325 mg) | Tablet | 68.5 | 5.7 | 14.5 | Analgesics |
| 2 | Zerodol 100 | Aceclofenac 100 mg | Tablet | 54.0 | 3.84 | 10.5 | Analgesics |
| 3 | Ultracet | Acetaminophen + Tramadol Hydrochloride (325 mg + 37.5 mg) | Tablet | 142.0 | 5.6 | 18.0 | Analgesics |

Load and invalid-price handling: `backend/app/services/medicine_service.py:13-43` uses Pandas, checks the required columns, converts IDs/prices, drops invalid IDs, rejects duplicate IDs, and treats invalid/negative prices as unavailable. It preserves the 500 real rows; no synthetic rows are generated there.

**Brand → generic algorithm:** no LLM. `backend/app/services/prescription/medicine_matching_service.py:30-106` uses normalized exact brand/salt matches, ingredient token equality, strength extraction, exact dosage-form equality, and `SequenceMatcher` fuzzy name scores. Fuzzy candidate threshold is 0.86 (`:63-70`); candidate inclusion threshold is 0.55 (`:73-85`). Final status is `matched` at score ≥0.93 with extraction confidence ≥0.65; `possible_match` at score ≥0.75 and confidence ≥0.65; otherwise `needs_review`. With no candidates, extraction confidence <0.65/null gives `needs_review`, otherwise `not_found` (`:86-97`).

All three attributes are **not required**. A known strength mismatch is rejected only when both prescription and catalogue strength sets exist (`:37-40`); ingredient mismatch is rejected only when both ingredient sets exist (`:42-45`); dosage form is exact-rejected only when both forms exist (`:47-51`). Thus missing active salt/strength can leave name matching eligible. Fuzzy brand-name match does not require a known salt. This is a false-match risk when a handwritten brand is uncertain and catalogue metadata is incomplete.

When no match is returned, `medicine_id`, matched record, match confidence, all price fields, and savings fields are null/empty; no prices are guessed (`prescription_service.py:92-107`). In the real scan, none of the five extracted medicine names appeared as an exact catalogue brand, and the extraction provided no active salts or strengths to establish generic matches. Outcome: 0/5 matched; no price comparison was available.

## 5. CDSCO NSQ CHECK

The user-mentioned filename with `(1)` is not present in this repo or Downloads. The actual bundled/loaded file is `backend/app/data/MedEasy_CDSCO_extraction_updated.csv`; it contains **260 rows** and the following actual columns:

`notice_month`, `serial_no`, `product_name`, `batch_number`, `manufacturing_date`, `expiry_date`, `manufacturer`, `nsq_result`, `reported_by`, `source_pdf`, `extraction_text`, `review_status`.

Three actual complete sample rows (extraction text omitted to keep the report concise):

| notice_month | serial_no | product_name | batch_number | manufacturer | nsq_result | review_status |
|---|---:|---|---|---|---|---|
| 2025-06 | 1 | Dextrose Injection I.P. 5% w/v (D5) | 1-3098 | M/s. Tam-Bran Pharmaceuticals Pvt. Ltd., Pithampur, Dhar, Madhya Pradesh | Assay of Dextrose (Anhydrous) | Source PDF text extracted; manual review recommended |
| 2025-06 | 2 | Dexamethasone Sodium Phosphate Injection I.P. (Dexacos) | P24L220 | M/s. Paksons Pharmaceuticals Private Limited, Bahadurgarh, Haryana | Free Dexamethasone, Particulate matter and Description | Source PDF text extracted; manual review recommended |
| 2025-06 | 3 | Methylcobalamin Injection | S4H046 | M/s. Arion Healthcare, Baddi, Himachal Pradesh | Assay of Methylcobalamin, Particulate matter and Description | Source PDF text extracted; manual review recommended |

The live dataset status is `records_loaded: 260`, `review_pending_count: 260`, `verified_count: 0`, latest month `2025-06`. Source review labels include 174 `Text extracted; verify before production`, 55 `Source PDF text extracted; manual review recommended`, and 31 `OCR/manual verification required`. No source row was auto-marked verified.

**Batch matching logic:** normalize batch to uppercase alphanumeric characters only (`backend/app/services/cdsco_safety_service.py:40-45`); product/manufacturer normalize through the shared string normalizer (`:48-53`). The normalized batch comparison is exact; there is no fuzzy batch-number correction. Exact normalized batch plus matching product or manufacturer becomes `NSQ_FLAGGED` only after the row has an `officially_verified` review overlay (`:156-197,281-285`). Exact batch with pending/conflicting/incomplete identity becomes `NEEDS_REVIEW`; product similarity alone never confirms a batch. A different batch is not flagged solely because the product has another NSQ row. Missing batch is `INSUFFICIENT_DATA`; incomplete product data with an exact batch yields review. `CLEAR` returns `can_be_sold: true`, but the response disclaimer says this is only no-match-in-loaded-dataset, not a safety certificate (`:204-214,306-337`).

Five actual CSV product+batch pairs were sent to `/api/batch-safety/check-batch`; all returned 200 `NEEDS_REVIEW`, `batch_match_confirmed: false`, because their extraction review status is pending:

| CSV product | CSV batch | API result |
|---|---|---|
| Dextrose Injection I.P. 5% w/v (D5) | 1-3098 | NEEDS_REVIEW |
| Dexamethasone Sodium Phosphate Injection I.P. (Dexacos) | P24L220 | NEEDS_REVIEW |
| Methylcobalamin Injection | S4H046 | NEEDS_REVIEW |
| Tranexamic Acid Injection IP 500 mg/5 ml | Z24-185 | NEEDS_REVIEW |
| Oxytocin Injection I.P. 1 ml | AOX-2402 | NEEDS_REVIEW |

**Does it claim safe?** A `CLEAR` response sets `can_be_sold` and `can_be_dispensed` to `true`, while also including a disclaimer that it is not certification (`cdsco_safety_service.py:330-337`). That boolean can be misread by consumers or clients that ignore the disclaimer.

## 6. TINYFISH

`backend/app/services/tinyfish_service.py:10-11,74-97` calls Search with HTTP GET `https://api.search.tinyfish.ai`, query/location/language/purpose parameters, and an `X-API-Key` header. It expects JSON `results` containing public URLs. It then calls Agent with HTTP POST `https://agent.tinyfish.ai/v1/automation/run`, an extraction goal and JSON schema for store name/address/coordinates/phone/WhatsApp/hours/delivery/source (`:99-136`).

Timeout configuration is 15 s for Search and 75 s for Agent (`:56-67`). Pharmacy service searches each requested provider concurrently and runs up to three agent extraction tasks per provider with a semaphore (`backend/app/services/pharmacy_service.py:87-146`).

**Live test:** one Jan Aushadhi search for Lucknow, radius 6 km, took **80.44 s** and returned HTTP 200, `total_stores: 0`, `cached: false`, warning `Some pharmacy discovery tasks failed; this result may be incomplete.` No phone, WhatsApp, or stock data was obtained. A prior request returned HTTP 502; backend catches lower-level errors and does not expose the precise upstream reason. The successful-looking 200/empty result is therefore not proof discovery succeeded.

Phone fields are scraped/extracted from public listings, not independently phone-verified. `whatsapp_verified` only means a normalized Indian mobile number exactly matched the number in a returned WhatsApp URL (`backend/app/services/pharmacy_service.py:37-68,288-307`). It does not prove that the listing is current or owned by the pharmacy. Delivery is set from the page or `unknown`; stock is not checked by TinyFish. The WhatsApp message asks the pharmacy to confirm stock/prices.

## 7. CART + WHATSAPP

**Backend cart model:** `CartAddRequest` has numeric `medicine_id`, quantity, provider, optional session ID, batch, and manufacturer; `CartUpdateRequest` has session ID, optional quantity/provider/batch/manufacturer (`backend/app/models/cart_schemas.py:7-27`). Response lines contain catalogue name/salt/form, quantity, selected provider, prices/savings, batch safety state, and sale/dispense booleans (`:30-59`). Service uses process-memory `_carts` keyed by a client session ID (`backend/app/services/cart_service.py:21-29,78-91`).

All five backend cart routes were called successfully: add 201, get 200, update 200, remove 200, clear 200. The tested item was real catalogue ID 1; it was an independent cart API check, not one of this prescription's unmatched medicines. With no batch provided it was added as a planning item with `batch_verification_required: true` and `can_be_sold: null`. A batch `NEEDS_REVIEW`/`NSQ_FLAGGED` add is rejected 409 (`cart_service.py:147-168`, `routes/cart.py:13-33`).

Backend enquiry message creation is in `backend/app/services/pharmacy_service.py:155-197,345-376`. It URL-encodes a message and makes a `https://wa.me/{number}?text=...` URL only when the extracted number passed the URL-number equality check. It does **not** use the WhatsApp Business API and does **not** send a message. It requires a discovered store and nonempty backend cart. `user_confirmation_required` is true. Actual enquiry/link creation was **UNVERIFIED** because discovery returned zero stores; no message was sent.

The frontend cart is a separate `sessionStorage` state implementation, not connected to `/api/cart/*` (`frontend/src/context/CartContext.tsx:16-34,36-73`). Its store page uses a static demo pharmacy array (`frontend/src/pages/StoresPage.tsx:22-87`), persists an enquiry through a different nonexistent endpoint, and constructs/open a direct `wa.me` link itself (`:162-197`). If no pharmacy phone exists, frontend code uses a hardcoded fallback number (`:193-196`). This frontend WhatsApp path is **STUB** and unverified with a real pharmacy. No WhatsApp Business API call exists in inspected source.

## 8. FRONTEND-BACKEND GAPS

| Frontend call or model | Backend reality | Result |
|---|---|---|
| `POST /api/prescriptions/extract`, `ExtractionResponse` nested `extraction.items` (`frontend/src/api/client.ts:202-215`, `frontend/src/types.ts:129-153`) | Backend has `POST /api/prescriptions/scan`, response top-level `medicines[]` (`backend/app/api/routes/prescriptions.py:29-55`, `backend/app/models/prescription_schemas.py:61-94`) | **BROKEN contract.** Frontend also gives request only 12 s (`client.ts:206-210`) while backend provider timeout is 45 s (`extraction_service.py:43-55`); catch silently returns synthetic data. |
| `POST /api/prescriptions/search-confirmed` body `{items}` (`client.ts:217-230`) | No corresponding backend route in OpenAPI | **BROKEN contract.** Frontend fallback calls generic `/api/medicines/search` per medicine, which is not the same confirmation/matching flow (`client.ts:231-270`). |
| `POST/GET /api/pharmacy-enquiries` (`client.ts:298-357`) | Backend uses `/api/pharmacies/enquiry/create`, `/api/pharmacies/enquiry/{id}`, `/status`, `/verify-batch` and different request/response models (`backend/app/api/routes/pharmacies.py:35-76`) | **BROKEN contract.** Client catches and stores local-only enquiries. |
| `GET /api/batch-safety/dataset-status` response expects `source_name`, `dataset_file`, `records_loaded`, `last_modified`, `note` (`types.ts:258-264`) | Backend returns `success`, `dataset_file`, `dataset_path`, `records_loaded`, `review_pending_count`, `verified_count`, `dataset_latest_notice_month`, `ready` (`backend/app/models/safety_schemas.py:7-16`) | Partial field mismatch. Frontend fallback fabricates a 342-record October 2026 status (`client.ts:364-371`). |
| `POST /api/batch-safety/check` body and frontend `BatchCheckResult` (`client.ts:408-459`, `types.ts:234-256`) | Backend route is `GET /api/batch-safety/check-batch` with query fields and returns `safety_status`, `alert`, `possible_alerts`, etc. (`backend/app/api/routes/safety.py:32-41`) | **BROKEN contract.** Frontend fallback checks static hardcoded records with substring batch matching. |
| Frontend CDSCO “verified alerts” (3 records, says 342 total) (`client.ts:374-406`) | Backend has 260 source rows, all review-pending | **STUB / fabricated certainty risk.** Frontend labels its static values verified; backend does not. |
| Frontend `CartItem` and local `CartContext` (`types.ts:170-182`, `context/CartContext.tsx:18-34`) | Backend requires `medicine_id`, session ID and provider enum in `/api/cart/*` | Separate state models; no API calls from context. |
| `StoresPage` uses `DEMO_PHARMACIES` (`pages/StoresPage.tsx:22-87`) | Backend real discovery is `POST /api/pharmacies/nearby` | Frontend never calls live discovery in inspected code. |

API base URL is `VITE_API_BASE_URL`, default `http://127.0.0.1:8000` (`frontend/src/api/client.ts:17`). Vite proxies `/api` and `/health` to the same host/port (`frontend/vite.config.ts:5-13`). Backend CORS defaults to localhost ports 5173 and is configurable (`backend/app/core/config.py:11-14`, `main.py:48-53`). Local URL/CORS defaults align, but production origin/base URL must be configured.

## 9. ENV AUR CONFIG

Only names are reported; no `.env` values are included.

| Environment variable name | Use in code |
|---|---|
| `GEMINI_API_KEY` | `backend/app/services/prescription/extraction_service.py:45,50-51` |
| `GEMINI_MODEL` | `backend/app/services/prescription/extraction_service.py:46` |
| `MEDEASY_CSV_PATH` | `backend/app/main.py:25` |
| `CDSCO_ALERTS_CSV_PATH` | `backend/app/main.py:28`; default path in `backend/app/services/cdsco_safety_service.py:59-66` |
| `MEDEASY_CORS_ORIGINS` | `backend/app/core/config.py:11-14` |
| `TINYFISH_API_KEY` | `backend/app/services/tinyfish_service.py:64,69-72` |
| `PHARMACY_CACHE_TTL_SECONDS` | `backend/app/services/pharmacy_service.py:82` |
| `CDSCO_REVIEW_API_KEY` | `backend/app/api/routes/safety.py:86-90` |
| `VITE_API_BASE_URL` | `frontend/src/api/client.ts:17` |

The search for common hardcoded Google/OpenAI/OAuth token patterns in `backend/app` and `frontend/src` found **no matches**. `.env` contents were not printed or included in this report. Manual CDSCO review currently returns 503, so the required review-key configuration is not available to this running process.

## 10. RISKS (TOP 10)

| Severity | Risk | Evidence |
|---|---|---|
| **HIGH** | Frontend treats any extraction API failure as a successful synthetic prescription. The sample contains hardcoded medicine instructions, confidence, model label, and patient/doctor text. This can present invented patient-specific output as OCR. | `frontend/src/api/client.ts:202-215,485-555`; `frontend/src/pages/ScanPage.tsx:380-420` |
| **HIGH** | Frontend CDSCO client returns a hardcoded 342-record October 2026 status and static alert list after any API failure; its fallback uses partial substring batch matching. This conflicts with the real 260 pending records and can assert an unverified batch flag/no-match. | `frontend/src/api/client.ts:364-459` |
| **HIGH** | Prescription extraction has 0/5 catalogue matches in the actual test. No prices/savings result. Frontend generic fallback uses name search and does not enforce backend prescription strength/salt safeguards. | `prescription_service.py:92-107`; `medicine_matching_service.py:37-51,73-106`; `frontend/src/api/client.ts:231-270` |
| **HIGH** | Matcher does not require salt, strength, and form all to be present and equal; strength mismatch is rejected only when both sides expose strengths. Missing extracted/canonical fields can allow brand/fuzzy-name matches. Its “confidence” is a heuristic score, not a calibrated probability. | `backend/app/services/prescription/medicine_matching_service.py:37-70,86-105` |
| **HIGH** | All 260 CDSCO entries are review-pending; 0 verified. The only official review route is currently unavailable (503), so no row can be confirmed through the running instance. | `backend/app/services/cdsco_safety_service.py:117-147,180-197`; `backend/app/api/routes/safety.py:79-105` |
| **HIGH** | Live pharmacy discovery took 80.44 s and returned zero stores. Its degraded 200 response can be mistaken for a valid empty search; backend hides lower-level failure detail. | `backend/app/services/pharmacy_service.py:97-146`; `tinyfish_service.py:74-136` |
| **HIGH** | Frontend uses local/demo pharmacies and direct WhatsApp launch; it does not use backend batch verification. It has a hardcoded fallback number and stores enquiries locally after API mismatch. | `frontend/src/pages/StoresPage.tsx:22-87,162-197`; `frontend/src/api/client.ts:298-357` |
| **HIGH** | Prescription images are sent to the configured third-party Gemini provider. Backend does not persist image bytes, but keeps extracted prescription response in process memory and has no authentication/rate limit on the scan route. | `backend/app/services/prescription/document_service.py:32-71`; `extraction_service.py:65-88`; `prescription_service.py:23,49-70`; `routes/prescriptions.py:29-55` |
| **MED** | Batch normalization removes all punctuation (`1-3098` equals `13098`), creating possible identifier collisions; it intentionally does not fuzzy-match OCR batch errors. | `backend/app/services/cdsco_safety_service.py:40-45,167-179` |
| **MED** | `CLEAR` returns `can_be_sold: true` and `can_be_dispensed: true` although the same response says it is not a safety certification. Clients may ignore the disclaimer. The current supplied data also ends at 2025-06. | `backend/app/services/cdsco_safety_service.py:330-337`; dataset status runtime result |

Other privacy observation: frontend fallback extraction’s static `other_text` has patient/doctor details (`frontend/src/api/client.ts:547-551`). They are not repeated here. Backend scan logs observed during this audit contained request paths/status and sanitized provider errors, not uploaded image contents.

## 11. TEST RUN

**Live path: exact attached prescription image → `/api/prescriptions/scan` → Gemini extraction → matching:**

| Step | Result | Evidence |
|---|---|---|
| Upload actual JPEG to FastAPI | **PASS** — HTTP 200 | `POST /api/prescriptions/scan`; existing API response showed 5 detected entries. |
| Upload validation / image decode | **PASS** | JPEG was accepted by the endpoint; `validate_document` decodes the uploaded image. |
| Gemini Vision/VLM extraction | **PASS** | Actual provider invocation returned structured data; 5 medicines detected. No mock was used for this request. |
| Catalogue generic match | **FAIL (no match)** | 0/5 matched; 5 unmatched. No guessed salt, strength, price, or savings was emitted. |
| Prescription-derived cart item | **BLOCKED** | No matched `medicine_id` exists for these prescription lines. No unrelated catalogue record was substituted. |
| Independent cart API | **PASS** | Actual catalogue ID 1 added 201, fetched 200, quantity updated 200, removed 200, cleared 200. This was not the prescription-derived flow. |
| Live pharmacy discovery | **FAIL/degraded** | TinyFish route returned HTTP 200, 0 stores, warning; measured elapsed time 80.44 s. |
| Backend WhatsApp link | **UNVERIFIED / BLOCKED** | No real discovered store, so no backend enquiry/link could be created. No WhatsApp message was sent. |

The upstream provider errors observed during retries were surfaced by the public scan route as the generic exact response `{"detail":"Prescription extraction provider failed"}` with HTTP 502. The provider integration now logs sanitized upstream diagnostics, but no secrets or personal data are reported here. After configuration retries the scan returned HTTP 200. The exact active model value is withheld because the audit rules prohibit printing `.env` values.

Other exact runtime errors observed: invalid pharmacy store → HTTP 404 `{"detail":"Pharmacy store not found"}`; invalid enquiry → HTTP 404 `{"detail":"Enquiry not found"}`; manual CDSCO review → HTTP 503 `{"detail":"Manual CDSCO review is not configured"}`. The pytest suite and frontend build were not run in this read-only audit.

## SUMMARY TABLE

| Feature | Status | Evidence (file:line) | What's missing |
|---|---|---|---|
| FastAPI startup/catalogue | **WORKING** | `backend/app/main.py:23-61`; live `/api/health` 200, 500 rows | No auth/rate limit for public API routes. |
| Medicine search/prices | **WORKING** | `backend/app/api/routes/medicines.py:26-54`; live search/max-savings/categories/detail 200 | Search result can show multiple matching candidates; no frontend endpoint tests run. |
| Prescription Gemini extraction | **WORKING** | `backend/app/api/routes/prescriptions.py:29-55`; real image scan 200, 5 items | No image enhancement stage; front-end scan contract points to wrong route/schema. |
| Prescription generic matching | **BROKEN for tested prescription** | `backend/app/services/prescription/medicine_matching_service.py:30-106`; 0/5 matched | Catalogue does not include matching brands; extraction omitted salts/strengths, so price comparison did not occur. |
| CDSCO data load/status | **WORKING** | `backend/app/services/cdsco_safety_service.py:59-147`; live status 260/260 pending/0 verified | Source ends 2025-06; no verified rows. |
| CDSCO exact-batch check | **WORKING conservatively** | `backend/app/services/cdsco_safety_service.py:156-214`; 5 actual pairs returned NEEDS_REVIEW | Review endpoint is unconfigured; batch punctuation normalization can collide. |
| Manual CDSCO review | **BROKEN/unconfigured** | `backend/app/api/routes/safety.py:79-105`; live 503 | Configure reviewer key and persist review/audit state. |
| Backend cart | **WORKING** | `backend/app/api/routes/cart.py:13-81`; add/read/update/remove/clear all passed | Prescription flow cannot enter cart until a medicine matches; backend data is in memory. |
| TinyFish pharmacy discovery | **BROKEN/degraded** | `backend/app/services/tinyfish_service.py:74-136`; live 80.44 s, zero stores, warning | Need successful current listings and clearer upstream error/timeout behavior. |
| Backend pharmacy enquiry/WhatsApp | **UNVERIFIED** | `backend/app/services/pharmacy_service.py:155-197`; no real store to invoke success path | No real store means no actual `wa.me` link test; link preparation is not message delivery. |
| Frontend-backend integration | **BROKEN/STUB** | `frontend/src/api/client.ts:202-459`; `frontend/src/context/CartContext.tsx:18-73`; `frontend/src/pages/StoresPage.tsx:22-197` | Wrong scan, confirmed-search, enquiry, and safety routes; static fallbacks/demo data and separate local cart. |
| Privacy/storage | **PARTIAL / risk remains** | `backend/app/services/prescription/prescription_service.py:23,49-70`; `frontend/src/api/client.ts:547-551` | Backend image is not disk-persisted, but image goes to Gemini and extraction remains in RAM; frontend sample has PII-like static text; no auth/rate limiting. |

**Overall:** the backend prescription upload and Gemini extraction ran on the real image. The complete requested path **did not pass**: the extracted medicines had no generic catalogue matches, so actual prices/savings and prescription-derived cart were unavailable; live pharmacy discovery returned no stores, preventing WhatsApp enquiry creation. The frontend currently hides several such failures behind synthetic/static fallbacks.
