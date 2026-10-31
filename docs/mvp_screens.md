# MedEasy — MVP Screen Inventory and UI Behavior

## 1. Navigation model

Use a simple top-level navigation suitable for a responsive web app:

- Home / Start
- Scan Prescription
- Search Medicines
- Compare Prices
- Cart
- Nearby Pharmacies
- Data Sources / About

Keep the primary action visually obvious. Avoid creating many unused routes or a complex dashboard before the golden path works.

## 2. Screens

### Screen 1 — Home / Start

**Purpose:** Explain MedEasy quickly and route users into scan or search.

Required elements:
- MedEasy brand mark and name.
- Headline: “Making medicines more accessible.”
- Supporting copy explaining prescription review, price information and nearby pharmacy enquiries.
- Primary CTA: “Scan prescription”.
- Secondary CTA: “Explore medicines”.
- Three/four capability tiles: Understand prescriptions, Compare listed prices, Find nearby pharmacies, Check batch alerts.
- Safety note: user confirmation required; pharmacy listings do not guarantee stock; batch no-match is not safety certification.

States: first load, network unavailable, catalogue stats loading/empty. Do not show fake user counts, verified pharmacy counts or savings totals.

### Screen 2 — Prescription upload

**Purpose:** Accept an image/PDF and explain what happens next.

Required elements:
- Drag/drop and file chooser.
- Accepted file labels: JPG, JPEG, PNG, WEBP, PDF.
- Current reported max: 10 MB; PDF max 4 pages.
- Preview or filename, file size and remove/replace action.
- Clear privacy note: uploaded prescription is processed to extract text; do not upload someone else's prescription without consent.
- CTA: “Extract medicine details”.
- Secondary link: manual medicine search.

States: empty, selected, unsupported format, oversized, parsing/extracting, upload failed.

### Screen 3 — OCR extraction review

**Purpose:** Make human confirmation unavoidable.

Required elements:
- Original prescription preview (or page thumbnails) adjacent to extracted medicine cards.
- Banner: “AI-assisted draft — check the original prescription before continuing.”
- For each medicine: editable name, strength, form and instructions; confidence indicator; uncertainty text; confirm / mark unreadable / remove.
- Add medicine manually action.
- Per-item review status and total confirmed count.
- “Search confirmed medicines” CTA disabled until at least one usable item is confirmed.

States: high/medium/low confidence; no items found; partially extracted; provider timeout; malformed output; manual-only route. Low confidence must not be disguised as a warning icon only; explain what is uncertain.

### Screen 4 — Medicine search/results

**Purpose:** Find exact catalogue rows for manually searched or user-confirmed entries.

Required elements:
- Search bar.
- Search result cards with brand name, active salt, form and category.
- Distinguish exact vs partial search match if backend supports it.
- “View price comparison” and “Add to cart” actions.
- Empty result with a suggestion to try the brand or salt manually; do not autocomplete clinical details.

States: loading, results, no results, backend unavailable, invalid query.

### Screen 5 — Price comparison detail

**Purpose:** Present the price fields honestly.

Required elements:
- Product name, active salt and dosage form.
- Comparison columns/cards for Private brand, Jan Aushadhi and Dava India.
- Show unavailable values as “Not available in catalogue”, never ₹0.
- Source/freshness caveat; specifically label private brand source as Tata 1mg only only if per-row data has been validated.
- Pack-size comparability status. If pack metadata is absent, say packs may not be directly comparable.
- Best available listed price only when calculation is valid.
- Savings amount/percentage only when same pack semantics are verified.
- Disclaimer: not a substitution recommendation; consult qualified pharmacist/prescriber before changing product.

States: all prices available, partial prices, no prices, non-comparable packs, lower alternative unavailable, no saving.

### Screen 6 — Cart

**Purpose:** Build an enquiry list for a pharmacy.

Required elements:
- Items and requested quantities.
- Edit/remove controls.
- Unit/pack price basis shown if known.
- “Indicative catalogue subtotal” clearly labelled.
- Notice: final price and availability must be confirmed by pharmacy.
- CTA: “Find nearby pharmacies”.

States: empty, populated, invalid quantity, missing price. Never present a checkout/payment button.

### Screen 7 — Nearby pharmacy list + map

**Purpose:** Choose a business to contact.

Required elements:
- Use my location button.
- Manual locality/PIN input.
- List/map layout with pharmacy name, address, phone and opening hours only when returned by provider.
- Provider attribution if required.
- Result source label: “Google Places results” or “Demo pharmacy directory”.
- Each result CTA: “Select pharmacy”.
- Strong notice: “Listing does not confirm medicine stock. Contact pharmacy to verify.”

States: permission prompt, permission denied, loading, empty, Places error/quota, demo fallback. A map must not show fake markers presented as live search results.

### Screen 8 — Enquiry preview / WhatsApp handoff

**Purpose:** Let user inspect minimum necessary enquiry details and start the manual contact.

Required elements:
- Selected pharmacy details.
- Cart line items and quantities.
- Prefilled message preview.
- Questions about exact product/pack, availability, current quoted price, manufacturer, batch number, expiry date and delivery.
- CTA: “Save enquiry” / “Open WhatsApp” with explanatory copy.
- Explicit note that user must press Send in WhatsApp.
- If phone missing, offer Copy message.

States: preview, save pending, saved, save failed, invalid/missing phone, WhatsApp open failure. Do not show message as sent.

### Screen 9 — Pharmacy response form (minimum viable merchant/demo view)

**Purpose:** Capture a manually supplied pharmacy response.

Required elements:
- Enquiry summary.
- Availability status.
- Quoted price.
- Manufacturer, batch number, expiry.
- Home delivery, delivery charge, estimated delivery.
- Save response action.
- Source label: manual shopkeeper response or simulated demo response.

States: incomplete, saved, invalid batch/date/price, demo seeded. Do not create a full pharmacy dashboard unless core UX is finished.

### Screen 10 — Batch-alert result

**Purpose:** Show a traceable result from the imported dataset.

Required elements:
- Product, manufacturer and batch submitted.
- Result status: Alert match / Manual review required / No matching alert found / Dataset unavailable.
- For match: alert type, notice date, source name, direct source URL and notes.
- Dataset coverage/update metadata if available.
- No-match warning in visible text: “No matching alert found in the imported dataset. This is not a safety certificate.”
- Never display a green “safe” badge or tick.

States: exact match, manual review, no match, no dataset, invalid input, backend error.

### Screen 11 — Data Sources / About / Safety

**Purpose:** Explain what data supports MedEasy and what it does not prove.

Required elements:
- Catalogue record count (only after runtime verification).
- Price sources and data freshness status where known.
- CDSCO sources and actual imported coverage (do not claim comprehensive data).
- Explanation of Places vs inventory.
- Explanation of WhatsApp manual send.
- Medical/safety boundary and privacy contact/help path if available.

## 3. Responsive behavior

- Mobile-first layout; all essential flows must work at 360 px width.
- On desktop, use split panes for prescription preview/review and pharmacy list/map.
- On mobile, stack content vertically; map may become a collapsible panel.
- Keep primary action reachable without horizontal scrolling.
- Avoid tiny dense tables; use cards/stacked price comparisons on mobile.

## 4. MVP screen implementation priority

P0: Screens 2, 3, 4, 5, 6, 7, 8, 10; Screen 1 provides entry. Screen 9 may be a simple demo/admin form.

P1: Improved data-source page, richer pharmacy response UX, post-delivery photo upload.

P2: accounts, order management, reminders, voice, analytics, full merchant portal.

## 5. Screen completion rule

A screen is not complete when it only matches a screenshot. It is complete when its primary action works, its loading/empty/error states are present, its data labels are truthful, it is responsive, and it can be reached in the golden path.
