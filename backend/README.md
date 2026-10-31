# MedEasy FastAPI backend

MedEasy's Python backend has two modular stages:

- **Stage 1:** CSV-backed medicine search and price comparison.
- **Stage 2:** prescription upload, Gemini vision extraction, conservative catalogue matching, and structured price comparisons.
- **Stage 3:** cart, nearby pharmacy discovery, and WhatsApp stock enquiry.
- **Stage 12:** CDSCO NSQ alert lookup and pharmacy batch verification.
- **MedSaathi:** Gemini healthcare chat with temporary session context and ElevenLabs text-to-speech.

The catalogue is loaded with Pandas on startup. Prescription images/PDFs are validated and processed in memory; uploaded files are not retained. Scan results use temporary in-memory storage and are lost when the server restarts or when a different worker receives a later request.

## Run locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI: `http://localhost:8000/docs`.

## Environment variables

- `GEMINI_API_KEY` — required to use the default Google Gemini extraction provider. If missing, scan returns HTTP 503. Never commit this key.
- `GEMINI_MODEL` — optional Gemini model name; defaults to `gemini-2.5-flash`.
- `ELEVENLABS_API_KEY` — required for speech synthesis; keep it in the backend environment only.
- `ELEVENLABS_VOICE_ID` — provider voice ID used for synthesis.
- `ELEVENLABS_MODEL_ID` — provider model; `eleven_multilingual_v2` is the default and infers Hindi or English from the text.
- `MEDEASY_CSV_PATH` — optional catalogue path; defaults to `app/data/MedEasy_catalogue_500_complete.csv`.
- `MEDEASY_CORS_ORIGINS` — comma-separated allowed browser origins; defaults to localhost ports 5173.
- `TINYFISH_API_KEY` — required for live pharmacy discovery; stored in ignored `backend/.env`.
- `PHARMACY_CACHE_TTL_SECONDS` — pharmacy discovery cache lifetime; defaults to 3600 seconds.
- `CDSCO_ALERTS_CSV_PATH` — optional path to the supplied CDSCO extraction; defaults to `app/data/MedEasy_CDSCO_extraction_updated.csv`.
- `CDSCO_REVIEW_API_KEY` — key required by the manual alert review endpoint. Keep it secret and configure it before verifying extracted records.

The Gemini provider implements a small extraction interface and can be replaced with another OCR/VLM adapter. Prescription content is sent to the configured provider for extraction. Do not log file contents or patient details.

## Stage 1 endpoints

- `GET /api/health`
- `GET /api/medicines/search?q=Paracetamol%20500%20mg`
- `GET /api/medicines/{id}`
- `GET /api/medicines/categories`
- `GET /api/medicines/maximum-savings` (optional `provider=jan_aushadhi` or `provider=dava_india`)

## Stage 2 endpoints

- `POST /api/prescriptions/scan`
- `GET /api/prescriptions/{prescription_id}`
- `GET /api/prescriptions/{prescription_id}/medicines`
- `GET /api/prescriptions/{prescription_id}/summary`

Upload one multipart field named `file`. Supported content formats are JPG/JPEG, PNG, WEBP, and PDF; maximum size is 10 MB. Formats are checked from file contents, not only the submitted filename or content type.

```bash
curl -X POST http://localhost:8000/api/prescriptions/scan \
  -F 'file=@/path/to/prescription.jpg'
```

The scan response contains each extracted medicine, its match status and candidate alternatives, catalogue prices only for confirmed matches, and a total explicitly labelled as potential (not guaranteed) savings. Low-confidence extraction is flagged for review. Strength or ingredient-combination mismatches do not become automatic matches. No medicines detected returns HTTP 422; unsupported files return 415; oversized files return 413; corrupt files return 400; missing Gemini configuration returns 503; provider failures return 502 or 504.

## Tests

From `backend/`, run `pytest -q`. Prescription tests use a mocked extraction provider and require no paid Gemini calls.

## MedSaathi AI and voice

- `POST /api/ai/chat` accepts `message`, optional `session_id`, `language` (`en` or `hi`), and `stream`. Set `stream: true` for Server-Sent Events (`meta`, `delta`, `done` or `error` frames); `stream: false` returns the JSON response directly.
- `POST /api/voice/elevenlabs/speak` accepts `text` and `language`, and returns playable `audio/mpeg` bytes. API credentials and the selected voice stay on the backend.
- Chat context is held in bounded, expiring in-memory sessions only. It is temporary conversation context, not persistent medical memory; restarts clear it.
- The existing browser SpeechRecognition implementation remains the microphone input path. The UI sends recognized speech and typed questions to Gemini. Typed replies can be spoken with the per-message **Speak response** control; voice-originated interactions can speak the response in the left voice panel. Playback supports pause, resume and stop.
- Gemini is instructed to provide general health information, avoid diagnosis/prescribing, flag emergency situations, and use catalogue facts only when supplied by the backend. A potential-emergency flag is a heuristic on the user message, not a clinical triage result.
- Gemini provider calls are asynchronous with bounded retries and timeout. ElevenLabs calls use the official SDK with a timeout. Provider errors are returned as HTTP errors (or an SSE `error` frame once streaming begins); no canned answer or fabricated audio is substituted.

## Stage 3: cart and pharmacy enquiries

TinyFish integration uses its documented REST APIs: Search (`GET https://api.search.tinyfish.ai`) finds candidate public listing URLs; Agent (`POST https://agent.tinyfish.ai/v1/automation/run`) extracts fields from those public pages into a declared output schema. REST requests use the `X-API-Key` header. Set `TINYFISH_API_KEY` in the ignored `backend/.env` file or the process environment. Agent extraction can incur TinyFish usage charges; no live TinyFish calls are made in the test suite. Search results and extracted listings are cached in memory for `PHARMACY_CACHE_TTL_SECONDS` (default 3600).

Cart endpoints:

- `POST /api/cart/add`
- `GET /api/cart?cart_session_id=...`
- `PUT /api/cart/update/{item_id}`
- `DELETE /api/cart/remove/{item_id}?cart_session_id=...`
- `DELETE /api/cart/clear?cart_session_id=...`

A session ID is returned when the first item is added. The frontend should retain it and send it with later cart operations. Duplicate medicine adds merge quantities into one line and apply the newly selected provider.

Pharmacy and enquiry endpoints:

- `POST /api/pharmacies/nearby` with latitude/longitude or a `postal_code`/`area`, radius, and providers.
- `POST /api/pharmacies/enquiry/create` with a discovered `store_id` and `cart_session_id`.
- `GET /api/pharmacies/enquiry/{enquiry_id}`
- `PATCH /api/pharmacies/enquiry/{enquiry_id}/status`
- `POST /api/pharmacies/enquiry/{enquiry_id}/verify-batch` (pharmacy supplied product, manufacturer, batch, expiry)

Nearby results include source URLs and the time TinyFish data was last verified. Missing coordinates yield a null distance; only valid coordinates are used for distance calculation. WhatsApp is marked verified only when the listing extraction returns a WhatsApp URL that matches the normalized listed number. Enquiries only prepare a click-to-chat URL; a person must confirm and send it. `user_opened_whatsapp` records only that the user opened the link, not that a message was sent. Pharmacy discovery, carts, and enquiries are temporary in-memory data.

## Stage 12: CDSCO NSQ batch safety

The supplied CSV is bundled at `app/data/MedEasy_CDSCO_extraction_updated.csv` and loaded with Pandas during startup. The API keeps incomplete rows and their `source_pdf`, `notice_month`, and `review_status` values for traceability. The supplied extraction currently contains 260 rows; its latest notice month is June 2025. Extraction records are review-pending by default. A matching row is therefore `NEEDS_REVIEW` until a reviewer verifies it against an official CDSCO notice. Reviewer verification is held in memory and is lost on restart; production should persist the audit and review overlay in a database.

Endpoints:

- `GET /api/batch-safety/dataset-status` — loaded filename, source record count, review-pending count, and verified count.
- `GET /api/batch-safety/alerts`
- `GET /api/batch-safety/check-batch?product_name=...&batch_number=...&manufacturer=...`
- `GET /api/safety/check-batch?product_name=...&batch_number=...&manufacturer=...`
- `GET /api/safety/check-medicine?medicine_name=...` — medicine-level candidates only; never confirms a batch.
- `GET /api/safety/alerts`
- `GET /api/safety/alerts/{alert_id}`
- `PATCH /api/safety/alerts/{alert_id}/review` — requires `X-CDSCO-Review-Key` matching `CDSCO_REVIEW_API_KEY`, an official HTTPS CDSCO URL, and verification notes.

Batch IDs match exactly after case and punctuation normalization; no fuzzy batch matching is used. A same-medicine/different-batch result does not flag the queried batch. Exact batch records with conflicting or incomplete identity data require review. `CLEAR` means only that no match was found in the loaded CSV; it is not a safety certification and does not establish current regulatory status. Check the original [CDSCO public NSQ portal](https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug) notice.

Cart requests that include a batch which is flagged or requires review are rejected with HTTP 409. A cart item without a physical batch can be added as a planning item, but pharmacy enquiries remain order-blocked until each requested cart line has a separately checked pharmacy batch. Marking stock available does not lift that block. The WhatsApp message asks the pharmacy to share the exact brand, manufacturer, batch, and expiry and to offer a different batch if needed. Enquiry batch checks are provisional, in-memory workflow records, not proof that the pharmacy physically checked a batch or sent a WhatsApp message.

Example requests:

```bash
curl -X POST http://localhost:8000/api/cart/add \
  -H 'Content-Type: application/json' \
  -d '{"medicine_id":1,"quantity":2,"selected_provider":"jan_aushadhi"}'

curl -X POST http://localhost:8000/api/pharmacies/nearby \
  -H 'Content-Type: application/json' \
  -d '{"area":"Hazratganj, Lucknow","radius_km":10,"providers":["jan_aushadhi","dava_india"]}'
```
