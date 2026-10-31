# MedEasy frontend integration notes

Use these instructions when connecting the frontend to the Feature 1 FastAPI backend. The backend is the source of truth for medicine records, prices, search ranking, and savings calculations. Do not duplicate the catalogue or calculate alternate prices from hardcoded values in the frontend.

## Local development

Start the API from the repository's `backend/` directory:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The local API base URL is `http://localhost:8000`. Swagger docs are at `http://localhost:8000/docs`.

Configure the frontend API base URL through its environment configuration (for Vite, a variable such as `VITE_API_BASE_URL=http://localhost:8000`). Do not embed the development URL throughout components. The API's CORS origins are controlled by `MEDEASY_CORS_ORIGINS`; the default allows `http://localhost:5173` and `http://127.0.0.1:5173`.

## Endpoints

- `GET /api/health` — status and loaded catalogue record count.
- `GET /api/medicines/search?q={query}` — search by brand, active salt/composition, dosage form, or strength. URL-encode the query; use `URLSearchParams` or the HTTP client's params option.
- `GET /api/medicines/{id}` — one catalogue medicine by its numeric ID.
- `GET /api/medicines/categories` — available category labels.
- `GET /api/medicines/maximum-savings` — top 10 price-saving opportunities across both alternative providers.
- `GET /api/medicines/maximum-savings?provider=jan_aushadhi` or `?provider=dava_india` — same report filtered to one provider.

Allowed `provider` values are exactly `jan_aushadhi` and `dava_india`.

## Search response contract

`GET /api/medicines/search` returns:

```json
{
  "success": true,
  "query": "Paracetamol 500 mg",
  "total_results": 2,
  "results": [
    {
      "id": 17,
      "brand_name": "Crocin Advance 500",
      "active_salt": "Paracetamol 500mg Tab",
      "dosage_form": "Tablet",
      "category": "Analgesics",
      "prices": {
        "private_brand": 10.1,
        "jan_aushadhi": 4.51,
        "dava_india": 5.8
      },
      "cheapest_provider": "Jan Aushadhi",
      "cheapest_price": 4.51,
      "savings": 5.59,
      "savings_percentage": 55.35,
      "savings_comparison": {
        "jan_aushadhi": {
          "savings_amount": 5.59,
          "savings_percentage": 55.35
        },
        "dava_india": {
          "savings_amount": 4.3,
          "savings_percentage": 42.57
        },
        "maximum_savings": {
          "provider": "Jan Aushadhi",
          "amount": 5.59,
          "percentage": 55.35,
          "private_brand_price": 10.1,
          "alternative_price": 4.51
        }
      }
    }
  ]
}
```

The example is an actual catalogue result; the API may return multiple matches. Render all `results` in the order received. `total_results` is the number in the returned list.

- Use `id` for detail lookups and stable UI keys.
- Treat any price, savings amount, percentage, or provider as nullable. Missing prices are not zero.
- A negative provider savings amount means that alternative costs more than the private brand. Do not present it as a positive saving. Prefer showing a clear “Costs more” or equivalent state.
- `savings_comparison.maximum_savings` can be `null` when neither alternative is a savings opportunity. When providers tie, `provider` is an array of both display names; otherwise it is one display-name string. Render both cases.
- Existing `cheapest_provider`, `cheapest_price`, `savings`, and `savings_percentage` fields are retained for compatibility. Use `savings_comparison` when showing the separate Jan Aushadhi and Dava India comparisons.

## Maximum-savings response contract

Each opportunity in `top_savings`, `highest_savings_amount`, and `highest_savings_percentage` has this shape:

```json
{
  "medicine_id": 106,
  "medicine_name": "Gemzar / Cytogem 1000mg Inj",
  "private_brand_price": 2450.0,
  "alternative_provider": "Jan Aushadhi",
  "alternative_price": 631.21,
  "savings_amount": 1818.79,
  "savings_percentage": 74.24
}
```

- `top_savings` is sorted by `savings_amount` descending and contains at most 10 entries. It may be empty.
- `highest_savings_amount` is the top amount result; `highest_savings_percentage` may be a different medicine. Either is `null` when no savings opportunities are available.
- With no provider filter, opportunities from Jan Aushadhi and Dava India are ranked together. The filtered endpoint only returns the selected provider.
- `provider` in the response echoes the filter (`null` when unfiltered).

## UI and request behavior

- Debounce typeahead requests modestly (around 250–350 ms), cancel or ignore stale requests, and keep the current query visible.
- Show distinct loading, results, empty-results, and request-error states. An empty successful search has HTTP 200, `total_results: 0`, and `results: []`.
- Do not issue a search for a blank or whitespace-only query. The API responds with HTTP 422 for a blank query.
- A missing medicine ID returns HTTP 404. An unsupported provider value returns HTTP 422. Handle non-2xx responses without assuming they contain a medicine payload.
- Prices are in the catalogue's currency (Indian rupees). Format them as currency in the UI, but preserve the numeric values for calculations and sorting.
- Fetch categories from `/api/medicines/categories` rather than maintaining a second category list.
- Fetch maximum-savings results from its endpoint instead of deriving a partial ranking from only the medicines currently shown in search.

## Scope

This integration covers medicine search and price comparison only. Prescription OCR, authentication, carts, and other future features are outside this API contract.
