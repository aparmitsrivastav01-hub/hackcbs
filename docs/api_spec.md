# MedEasy — API Specification and Frontend Integration Contract

> **Important compatibility note:** The endpoint inventory below is the API surface recorded from the backend built earlier in the project. The actual backend source/Swagger contract was not included inside this documentation pack. Before implementation, inspect the current code and `GET /openapi.json` (or `/docs`) and reconcile exact parameter names, multipart field names, request models, response fields and status codes. Do not invent or silently rename them.

## 1. Base configuration

- Local backend: `http://<BACKEND_HOST>:8000`
- API base: same origin plus `/api` for application endpoints.
- Health route: `/health` (not under `/api`).
- Production: HTTPS base URL from environment.
- Frontend env: `VITE_API_BASE_URL`.
- Backend env: `CORS_ORIGINS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and existing data/SQLite configuration variables from `.env.example`.

Never hard-code API host or keys in components.

## 2. Existing endpoint inventory

| Method | Path | Purpose | Integration priority |
|---|---|---|---|
| GET | `/health` | Health check / medicine count | P0 |
| GET | `/api/stats` | Catalogue counts and price coverage | P1 |
| GET | `/api/categories` | Available categories | P1 |
| GET | `/api/medicines` | Browse/filter/sort/paginate | P1 |
| GET | `/api/medicines/search?q=...` | Search brand or active salt | P0 |
| GET | `/api/medicines/{id}` | Medicine detail | P0/P1 |
| GET | `/api/medicines/{id}/compare` | Comparison for one medicine | P0 |
| GET | `/api/compare?q=...` | Search + compare | P0/P1 |
| POST | `/api/prescriptions/extract` | Extract draft using Gemini Vision; must not search | P0 |
| POST | `/api/prescriptions/search-confirmed` | Search user-confirmed items | P0 |
| POST | `/api/pharmacy-enquiries` | Save selected pharmacy/cart enquiry | P0 |
| GET | `/api/pharmacy-enquiries` | List enquiries | P1 / demo admin only |
| GET | `/api/pharmacy-enquiries/{id}` | Read enquiry | P0/P1 |
| PATCH | `/api/pharmacy-enquiries/{id}/response` | Save manual shopkeeper response | P0 |
| GET | `/api/batch-safety/dataset-status` | Alert dataset status | P0 |
| POST | `/api/batch-safety/check` | Match product/manufacturer/batch against imported CSV | P0 |

## 3. Endpoint integration notes

### GET `/health`

Use at startup or app diagnostics. Display backend unavailable state when it fails. Do not expose secrets or internal stack traces.

### GET `/api/stats`

Use only if the UI needs catalogue statistics. Verify that returned record count matches the actual loaded CSV. Do not hard-code “300” if the backend reports a different count.

### GET `/api/categories`

Optional filter metadata. Do not block primary search if this fails.

### GET `/api/medicines`

Use for browse/filter/sort/pagination only if required. Inspect current OpenAPI for supported parameters before generating UI filters.

### GET `/api/medicines/search?q={query}`

Use for manual search. URL-encode `q`. Debounce requests and cancel stale queries. Do not send unconfirmed OCR content automatically.

### GET `/api/medicines/{id}`

Fetch a selected catalogue item if detail fields are not already returned by search. `id` must be the exact backend catalogue identifier.

### GET `/api/medicines/{id}/compare`

Primary comparison route for a selected catalogue medicine. Display missing values as unavailable. Verify whether backend returns computed best source/savings; if not, either implement deterministic comparison in backend or keep presentation to raw listed values. Do not compute savings if pack equivalence is unknown.

### GET `/api/compare?q={query}`

Optional combined search/compare endpoint. Prefer one clear route to avoid duplicate frontend logic. Inspect current response shape and avoid calling both search and compare redundantly.

### POST `/api/prescriptions/extract`

- Content type: `multipart/form-data`.
- Upload formats reported: JPG/JPEG, PNG, WEBP, PDF.
- Current reported limits: 10 MB, up to four PDF pages.
- Exact form field name must be read from OpenAPI/source before frontend code is written.
- Endpoint returns extracted candidate text and warnings; it does not perform catalogue search.
- Render all returned items as unconfirmed drafts.

### POST `/api/prescriptions/search-confirmed`

- Called only after user has reviewed/confirmed items.
- Exact request schema must be read from current OpenAPI/source.
- Frontend must filter out `needs_review`, `unreadable` and removed items.
- Backend should validate required fields and reject invalid item lists.

Suggested conceptual request (not authoritative until compared to actual API):

```json
{
  "items": [
    {
      "medicine_name": "User-confirmed medicine name",
      "strength": "500 mg",
      "dosage_form": "tablet"
    }
  ]
}
```

### POST `/api/pharmacy-enquiries`

- Create a record for the selected pharmacy and current cart.
- The described backend returns `whatsapp_sent: false`.
- Saving the enquiry does not mean WhatsApp opened or was sent.
- Exact body/response schema must be taken from OpenAPI/source.

Conceptual request only:

```json
{
  "pharmacy": {
    "name": "Selected pharmacy",
    "phone": "+91XXXXXXXXXX",
    "address": "Provider-returned address",
    "place_id": "provider-id-or-null"
  },
  "items": [
    {
      "medicine_id": "catalogue-id",
      "medicine_name": "Confirmed catalogue item",
      "quantity": 1
    }
  ]
}
```

Do not send patient diagnosis or the full prescription.

### GET `/api/pharmacy-enquiries`

Restricted/internal route unless authentication and ownership checks exist. Never expose another user's enquiries through a public unprotected page.

### GET `/api/pharmacy-enquiries/{id}`

Fetch one enquiry. Restrict by owner/role before public deployment.

### PATCH `/api/pharmacy-enquiries/{id}/response`

- Save a manually entered pharmacy response.
- Exact payload must be read from current OpenAPI/source.
- Conceptual response fields: availability, quoted price, manufacturer, batch number, expiry date, home-delivery availability, delivery charge and estimated delivery.
- Record whether the response is manually entered or simulated.

### GET `/api/batch-safety/dataset-status`

- Fetch before presenting batch-check results or when the screen loads.
- Expected conceptual fields: loaded/available status, row count, known coverage dates/period, last update and dataset message.
- Never invent missing metadata.

### POST `/api/batch-safety/check`

- Submit product name, manufacturer and batch number.
- Exact request/response fields must be verified from OpenAPI/source.
- Backend checks a locally imported CSV with columns `product_name, manufacturer, batch_number, alert_type, notice_date, source_name, source_url, notes`.
- Exact batch normalization and product/manufacturer compatibility are used by the described checker.
- Expected UI outcomes: alert match, manual review required, no matching alert found, dataset unavailable. Map actual backend enum/status strings safely.

Conceptual request only:

```json
{
  "product_name": "Exact product name",
  "manufacturer": "Manufacturer on pack",
  "batch_number": "Exact batch string"
}
```

## 4. Response normalization guidance

If the existing API has inconsistent field names, create a thin frontend adapter module (e.g. `src/lib/api/adapters.ts`) rather than scattering aliases through UI components. Do not change the backend response contract just to fit one component unless there is a documented migration and tests.

## 5. Error handling

Frontend must handle:

- `400` / `422`: invalid input or file; show actionable field-level message.
- `401` / `403`: authentication/permission denied; avoid leaking record existence.
- `404`: medicine/enquiry not found.
- `413`: upload too large.
- `429`: rate limit; show retry guidance.
- `5xx`: backend/provider issue; show manual search fallback for OCR.
- network timeout/offline: preserve safe current UI state and retry action.

Exact status codes depend on current FastAPI implementation; inspect and align.

## 6. API client requirements

- One centralized API client with base URL from env.
- Use `AbortController` or equivalent to cancel stale search requests.
- Set finite timeouts where supported.
- Do not automatically retry POST operations that may create duplicate enquiries unless an idempotency strategy exists.
- Validate important response shapes at runtime.
- Display user-safe errors; log request IDs if available.

## 7. Cross-laptop development

Backend laptop runs:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend laptop `.env.local` (example):

```env
VITE_API_BASE_URL=http://192.168.x.x:8000
```

Use the actual backend laptop LAN IP; do not copy the example IP. Set backend `CORS_ORIGINS` to the exact frontend origin. Test the API from the frontend device.

## 8. Required API contract audit before frontend integration

The agent must capture:

- [ ] `/openapi.json` from running API.
- [ ] multipart file field name, content rules and validation errors.
- [ ] extraction result schema.
- [ ] confirmed-search request/response schema.
- [ ] catalogue search/compare response schema.
- [ ] enquiry create/read/response schema.
- [ ] batch status/check schema and enum strings.
- [ ] CORS allowed origins and active port.
- [ ] database file path and persistence behavior.

Store a sanitized OpenAPI snapshot or generated client in the repo only if appropriate. Do not include real secrets or private data.
