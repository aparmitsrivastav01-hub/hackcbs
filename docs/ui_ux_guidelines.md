# MedEasy — UI/UX Guidelines

## 1. Visual direction

Use a cohesive, light, clean DawaWise-inspired visual language across the MVP: white/ice-blue surfaces, navy typography, bright electric-blue actions, soft blue borders and calm medical-service styling. The earlier dark/purple prescription-scan exploration is a separate visual variant; do not mix a dark scan module into a light application unless the founder explicitly requests that split. Consistency across the user journey is more important than copying an isolated mockup.

### Suggested design tokens

| Token | Suggested value | Usage |
|---|---|---|
| `color.brand` | `#1769FF` | Primary actions, selected navigation, links |
| `color.brandDeep` | `#0B3A8F` | Strong emphasis, hover/focus |
| `color.ink` | `#102044` | Headings and primary body text |
| `color.muted` | `#5E6F8C` | Secondary text |
| `color.canvas` | `#F7FAFF` | App background |
| `color.surface` | `#FFFFFF` | Cards and panels |
| `color.surfaceBlue` | `#EEF5FF` | Highlight/soft blue panels |
| `color.border` | `#DDE7F5` | Card/input boundaries |
| `color.success` | `#16824B` | Successful save/confirmed UI only (not safety status) |
| `color.warning` | `#A96A00` | Review-required states |
| `color.danger` | `#C62828` | Input errors / explicit alert matches with context |
| `radius.card` | `16–20px` | Cards/panels |
| `radius.control` | `10–12px` | Inputs/buttons |
| `shadow.card` | Subtle low-opacity shadow | Elevation, not heavy glassmorphism |

Typography: **Inter** for body and UI. Use a clear sans-serif heading hierarchy; do not overuse serif accent fonts in the app workflow. Use `₹` for INR and locale-aware number formatting.

These are defaults, not a demand to re-theme an existing well-built frontend. Inspect current CSS/design tokens first and preserve established components that already match the intended direction.

## 2. Layout principles

- Give the main task one clear focal point per screen.
- Use generous whitespace and compact, readable cards.
- Keep forms short and group related fields.
- Use a 12-column desktop grid where useful, but let mobile stack naturally.
- Use left-aligned headings and readable line length (roughly 60–80 characters for long body copy).
- Keep the primary CTA consistent in position and style.
- Avoid over-animated transitions, excessive gradients, glowing effects and decorative dashboard charts.
- Do not clutter the home page with metrics that have not been verified.

## 3. Interaction principles

### User confirmation

- The extraction review screen must make confirmation explicit per medicine.
- Use badges/text labels `High confidence`, `Medium confidence`, `Low confidence`, plus an explanation of what remains uncertain.
- Do not use a confidence score as a substitute for human review.
- The search action must be blocked until user confirmation is recorded.

### Price transparency

- Price columns need labels and provenance.
- Missing price means “Not available”, not `₹0`.
- Use “Lowest listed price” rather than “best medicine”.
- Show pack-size limitation alongside, not hidden in tooltip/legal footer.
- Avoid red/green colour alone for savings; pair colour with explicit text and amount.

### Pharmacy listings

- Distinguish provider-sourced places from curated demo entries.
- Show “Stock not confirmed” near the listing CTA.
- Display opening hours/ratings only when supplied by provider data.
- Do not use “verified pharmacy” unless a verification process exists.

### WhatsApp

- Always show a message preview before opening WhatsApp.
- User action must initiate `wa.me` open; the application must not imply automated send.
- Provide Copy message fallback if no phone number/WhatsApp handler exists.

### Batch-alert states

- Exact match: show an alert/result panel with source and date; not a universal safety statement.
- No match: neutral/informational treatment, not green “safe”.
- Dataset unavailable: clear warning that the checker cannot run.
- Manual review: explain which fields are missing/ambiguous.

## 4. Component guidance

### Buttons

- Primary: filled brand blue, one per screen where possible.
- Secondary: white/soft-blue fill with brand border/text.
- Destructive: reserved for remove/cancel.
- Disabled state must be visibly disabled and have adjacent explanation when blocked by review requirement.

### Cards

- Use subtle border and radius.
- Avoid excessive card nesting.
- Make card action areas large enough for touch.
- Keep price comparison cards aligned so source values are easy to scan.

### Inputs

- Persistent labels; placeholder is not a label.
- Show validation next to field.
- Use input type `file` with clear accepted formats/size.
- For batch number, preserve user-entered characters; do not auto-strip leading zeros or separators.

### Status chips

Use neutral labels for data states. Avoid celebratory green states for “no alert found”. Green can indicate “saved” or “confirmed by user”, not “medicine is safe”.

### Loading states

Use skeletons/progress indicator with a text description (e.g. “Reading visible text from prescription…”). Show retry/cancel when possible. Do not leave a spinner indefinitely.

## 5. Accessibility

- Contrast target WCAG AA for normal text.
- Keyboard reachable and visible focus ring.
- Buttons/links have descriptive accessible names.
- Form errors are associated with fields.
- Do not communicate confidence/alert only through colour or icons.
- Respect reduced-motion preferences.
- Map list must remain usable without map interaction.
- Provide alt text for uploaded prescription preview; do not use generated OCR text as alt text.

## 6. Medical-safety copy style

Be clear, non-alarmist and precise. Avoid claiming professional validation or certainty.

Approved examples:

- “AI-assisted transcription. Please review the original prescription.”
- “The listed pharmacy may not have this medicine in stock. Contact it to confirm.”
- “Prices are catalogue values and may not reflect the pharmacy's final quote.”
- “Pack sizes may differ, so these prices may not be directly comparable.”
- “No matching alert found in the imported dataset. This is not a safety certificate.”
- “Ask a qualified pharmacist or prescriber before changing a medicine.”

Avoid:

- “100% accurate AI prescription.”
- “Cheapest equivalent medicine.”
- “Guaranteed savings.”
- “In stock now” from a map listing.
- “WhatsApp message sent” without an actual send acknowledgement.
- “Safe/genuine/authentic” based only on no batch-alert match.

## 7. Content and localization

- English for MVP.
- Use familiar Indian pharmacy terms and INR.
- Avoid complex clinical jargon in user-facing copy.
- Do not translate or expand ambiguous prescription abbreviations automatically.
- Future Hindi/Hinglish support requires human-reviewed strings and model testing; do not ship partial machine translation.

## 8. Performance and resilience

- Keep initial landing page light.
- Lazy-load maps and prescription preview where possible.
- Avoid blocking the whole app while maps load.
- OCR processing must show progress and allow manual search fallback.
- Preserve current cart state if the user returns from pharmacy lookup.
- Avoid localStorage for sensitive prescription contents; session state is preferred.
