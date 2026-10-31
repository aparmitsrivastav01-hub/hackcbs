# MedEasy — Data Models and Field Semantics

> **Compatibility rule:** The existing backend and CSV files are the source of truth for current field names. The schemas below distinguish **current** fields from **recommended additions**. Do not rename persisted/API fields without migration tests.

## 1. Medicine catalogue — current CSV row

Filename reported by founder: `MedEasy_catalogue_300_complete.csv`.

| Field | Type | Nullable | Meaning | Notes |
|---|---|---:|---|---|
| `id` | integer/string identifier | No | Catalogue row ID | Preserve source ID; inspect actual file type. |
| `brand_name` | string | No | Listed brand/product name | Do not infer spelling from OCR without user confirmation. |
| `active_salt` | string | Maybe | Active ingredient/salt text | Not sufficient on its own to declare clinical equivalence. |
| `dosage_form` | string | Maybe | Tablet/capsule/syrup/etc. | Preserve exact form. |
| `private_brand_price` | decimal/null | Yes | Private-brand listed price | Founder specified Tata 1mg as the only source for private-brand prices. Row-level provenance still needs validation. |
| `jan_aushadhi_price` | decimal/null | Yes | Jan Aushadhi catalogue value | Source, pack, price type and freshness must be verified. |
| `dava_india_price` | decimal/null | Yes | Dava India catalogue value | Source, pack, price type and freshness must be verified. |
| `category` | string | Maybe | Product category | Display/filter metadata only. |

Do not silently cast missing prices to `0`. Treat blank, `NaN`, invalid or non-positive prices as unavailable. Use `Decimal` or safe decimal conversion for monetary calculations where practical; do not rely on binary floating-point for displayed currency totals.

## 2. Recommended medicine metadata extension (not present in current 8-column schema)

Add these only after source data can be populated and the backend migration is agreed:

| Field | Type | Purpose |
|---|---|---|
| `pack_size` | string | Human-readable pack, e.g. 10 tablets, 100 ml. |
| `unit_count` | decimal/integer | Comparable number of dosage units/volume. |
| `unit_type` | enum/string | tablet, capsule, ml, gram, etc. |
| `strength` | string | Explicit product strength; do not infer from brand text. |
| `release_type` | string/null | Immediate/extended/modified release when known. |
| `price_type` | enum | `MRP`, `selling_price`, `unit_price`, `unknown`. |
| `price_source` | string | e.g. Tata 1mg, Jan Aushadhi, Dava India. |
| `source_url` | URL/null | Direct product/source URL. |
| `checked_at` | ISO-8601 datetime/null | When the value was checked. |
| `currency` | string | `INR`. |
| `match_quality` | enum | `verified_like_for_like`, `partial`, `unknown`. |
| `data_notes` | string/null | Limitations and reviewer notes. |

Comparison must only be presented as like-for-like when active ingredient(s), strength, dosage form, release type and pack size/unit count are known to match. If the current dataset cannot prove this, show a non-comparable catalogue price, not a savings claim.

## 3. Prescription extraction result

The Gemini result is a **draft transcription**, never a prescription or clinical recommendation.

### Conceptual response model

```json
{
  "document_language": "unknown",
  "raw_text": "...",
  "items": [
    {
      "raw_text": "Amoxicillin 500 mg",
      "medicine_name": "Amoxicillin",
      "strength": "500 mg",
      "dosage_form": null,
      "instructions": null,
      "confidence": "medium",
      "uncertain_parts": ["dosage form not legible"],
      "needs_user_confirmation": true
    }
  ],
  "warnings": ["AI-assisted transcription; review the original prescription."],
  "requires_human_review": true
}
```

This is a target shape for frontend integration, not a guarantee that the existing endpoint already returns precisely these names. Inspect the live FastAPI schema and either adapt the frontend to the actual response or make a deliberate backward-compatible normalization layer.

### Confidence enum

- `high`: text is legible; still requires user confirmation.
- `medium`: plausible reading with uncertainty.
- `low`: ambiguous/poor quality; user should correct or mark unreadable.

Confidence is not clinical correctness. Even `high` requires user confirmation.

## 4. Confirmed prescription item

Frontend should maintain an explicit review state per candidate:

| Field | Type | Meaning |
|---|---|---|
| `client_item_id` | UUID/string | Stable row identity within the UI. |
| `source_raw_text` | string | Model's original visible text. |
| `medicine_name` | string | User-reviewed name to search. |
| `strength` | string/null | User-reviewed strength. |
| `dosage_form` | string/null | User-reviewed form. |
| `instructions` | string/null | Display only; do not reinterpret. |
| `confidence` | enum | Original extraction confidence. |
| `uncertain_parts` | string[] | Model's uncertainty list. |
| `review_status` | enum | `needs_review`, `confirmed`, `unreadable`, `removed`. |
| `confirmed_by_user` | boolean | Must be true before confirmed search. |

Rules:

- Search only items with `review_status=confirmed` and `confirmed_by_user=true`.
- Never turn null/unclear strength into an inferred strength.
- `unreadable` entries should not be searched; preserve them on screen so the user knows they were not silently discarded.
- User can add a manually entered medicine item without claiming it came from OCR.

## 5. Medicine search result / comparison view model

The backend's existing routes are documented in `api_spec.md`. UI normalization should support:

| Field | Type | Meaning |
|---|---|---|
| `medicine_id` | string/integer | Catalogue row ID. |
| `brand_name` | string | Catalogue brand. |
| `active_salt` | string/null | Catalogue active salt text. |
| `dosage_form` | string/null | Catalogue dosage form. |
| `category` | string/null | Catalogue category. |
| `private_brand_price` | decimal/null | Listed private-brand catalogue price. |
| `jan_aushadhi_price` | decimal/null | Listed Jan Aushadhi value. |
| `dava_india_price` | decimal/null | Listed Dava India value. |
| `best_available_listed_price` | decimal/null | Lowest available source value, only when calculable. |
| `best_available_source` | string/null | Source that supplied the lower listed value. |
| `price_difference` | decimal/null | Baseline minus alternative. |
| `price_difference_percent` | decimal/null | Percentage only if baseline valid/positive. |
| `comparison_status` | enum | `comparable`, `catalogue_only`, `incomplete`, `no_saving`, `unavailable`. |
| `data_limitation` | string | Clear note on provenance/pack equivalence. |

**Important:** The view model above is a frontend normalized concept. Verify whether the backend already returns some or all of these keys. Calculate nothing twice in two competing places. Prefer backend deterministic comparison output if it is already correct and tested.

## 6. Cart item — frontend state

No backend order/cart API is assumed.

| Field | Type | Meaning |
|---|---|---|
| `cart_item_id` | string | Stable frontend key. |
| `medicine_id` | string/integer | Catalogue ID. |
| `brand_name` | string | Display name. |
| `strength` | string/null | Only if confirmed/known. |
| `dosage_form` | string/null | Catalogue form. |
| `pack_size` | string/null | Null if not supplied in catalogue. |
| `quantity` | positive integer | Number of packs/units as explicitly defined in UI. |
| `selected_listed_source` | string/null | Source price shown to user. |
| `unit_price` | decimal/null | Listed unit/pack value only if type known. |
| `line_total` | decimal/null | `quantity * unit_price` only when price semantics are clear. |

Cart subtotal label must say “Indicative catalogue subtotal” unless the selected pharmacy confirms the quote. Do not call it an order total.

## 7. Pharmacy place

Place provider data is not inventory data.

| Field | Type | Meaning |
|---|---|---|
| `place_id` | string/null | Provider place identifier, if returned. |
| `name` | string | Pharmacy/business display name. |
| `address` | string/null | Provider address. |
| `phone` | string/null | Public phone number, if provided. |
| `location` | `{lat, lng}`/null | Coordinates if returned. |
| `opening_hours` | object/string/null | Only when provider supplies it. |
| `rating` | number/null | Only when provider supplies it; include provider attribution. |
| `provider` | enum | `google_places`, `curated_demo`. |
| `is_demo_data` | boolean | True for curated test directory. |
| `inventory_status` | enum | Must default to `unknown`; never `in_stock` based on a map result. |

## 8. Pharmacy enquiry record

An enquiry records a request, not a confirmed order.

### Conceptual model

| Field | Type | Meaning |
|---|---|---|
| `enquiry_id` | UUID/string | Backend-generated unique identifier. |
| `created_at` | ISO-8601 datetime | Creation time. |
| `status` | enum | `draft`, `prepared`, `awaiting_pharmacy`, `responded`, `closed`. |
| `pharmacy` | object | Selected provider place details. |
| `items` | array | Cart items and requested quantities. |
| `whatsapp_sent` | boolean | Backend currently reports false; saving an enquiry must not imply send. |
| `manual_message_opened` | boolean/null | Only record if actual UI event is measured; do not infer send. |
| `pharmacy_response` | object/null | Manually submitted shopkeeper data. |
| `is_simulated` | boolean | True for seeded/demo response. |

### Pharmacy response fields

- `availability`: `available`, `partially_available`, `unavailable`, `unknown`.
- `quoted_price`: decimal/null.
- `manufacturer`: string/null.
- `batch_number`: string/null.
- `expiry_date`: date/string/null.
- `home_delivery_available`: boolean/null.
- `delivery_charge`: decimal/null.
- `estimated_delivery`: string/null.
- `responded_at`: datetime.
- `response_source`: `manual_shopkeeper_form`, `demo_seed`, or another explicitly recorded channel.

Use actual existing SQLite field names after repository/OpenAPI inspection. Do not silently replace persisted schemas.

## 9. CDSCO alert record — current import CSV

Exact expected columns:

`product_name, manufacturer, batch_number, alert_type, notice_date, source_name, source_url, notes`

| Field | Type | Rule |
|---|---|---|
| `product_name` | string | Product/brand name as stated in the official source. |
| `manufacturer` | string | Manufacturer text as stated; preserve raw form. |
| `batch_number` | string | Preserve exactly, including leading zeros, slash/hyphen formatting. |
| `alert_type` | string/enum | Distinguish NSQ, Spurious, Adulterated, Misbranded and source terminology. |
| `notice_date` | date/string | Preserve notice/publication period; normalize separately if needed. |
| `source_name` | string | CDSCO, State drug authority, laboratory, etc. |
| `source_url` | URL | Link to original notice/PDF/page. |
| `notes` | string | Source context, corrections, disposition and review notes. |

### Recommended additional audit metadata

Not in the current eight-column loader unless explicitly implemented:

- `source_document_id`, `source_page`, `source_row_text`, `extraction_method`, `review_status`, `reviewer`, `reviewed_at`, `published_at`, `last_checked_at`, `correction_of_record_id`, `disposition_status`, `coverage_period_start`, `coverage_period_end`.

Use a separate metadata file/table if required to avoid breaking current loader.

### Alert matching outcomes

- `alert_match`: exact normalized batch and compatible product/manufacturer match.
- `manual_review_required`: possible/partial match or insufficient context.
- `no_matching_alert_found`: no matching row in this loaded dataset.
- `dataset_unavailable`: no usable alert data loaded.

No outcome may be translated into “safe”, “genuine”, “authentic” or “approved”. Show alert source and date. Historical alert status may have corrigenda/outcomes; retain source context.

## 10. Privacy / retention model

- Prescription file: transient processing only; do not persist by default.
- Raw extraction: keep in frontend session only unless a specific consented use case requires persistence.
- Cart: local frontend state for MVP.
- Enquiry: SQLite record; sensitive contact data should be minimized; access must be restricted before public deployment.
- Logs: metadata only; no raw image, full text, name, phone or diagnosis.
- Demo data: synthetic and marked as demo.
