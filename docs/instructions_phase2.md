# MedEasy — Phase 2 Implementation Instructions

> **Phase:** Patient accounts, identity, privacy boundary, local health vault integration, and Meko runtime hand-off  
> **Product track:** HackCBS 9.0 — Meko Track A (Open Project), within the HealthTech theme  
> **Status:** Proposed implementation contract. Inspect the live repositories and confirm decisions with the founder before changing code.

---

## 0. Executive decision

The proposed Phase 2 is technically feasible, with one mandatory privacy correction:

**Keep original medical documents and detailed health records on the patient's device. Store account/profile/consent metadata in the MedEasy YugabyteDB YSQL database. Send only a small, user-approved, pseudonymous subset of derived health context to Meko when the user explicitly opts in.**

That subset is still sensitive health information even when names and direct identifiers are removed. Because Meko is a cloud-hosted service and stores the content sent to it, MedEasy must not promise that *all* health data stays local when patient-specific facts are stored in Meko.

If the product requirement is interpreted as **zero patient-specific health data ever leaves the device**, then Meko cannot perform persistent patient-specific medical-history recall. In that strict-local mode, Meko can only be used for non-personal context such as generic workflow instructions, public medical reference material, or team/build knowledge. The founder must choose and accurately communicate the intended privacy mode.

### Recommended hackathon mode

Use **Local Health Vault + Opt-in Meko Memory**:

- Original prescription photos, PDFs, detailed records and full patient history stay in local encrypted browser storage.
- YugabyteDB stores identity, minimal profile fields, privacy-consent state and the internal mapping between the MedEasy account and its Meko datapack.
- Meko receives only explicitly approved, minimum-necessary, pseudonymous memory facts. Never upload raw prescription/medical-record documents for this MVP.
- The user can inspect, correct and delete the Meko memories associated with their account.
- No patient-specific memory is promoted to shared knowledge.
- Use synthetic/demo patients for the hackathon demonstration unless the Meko team has explicitly confirmed the data handling terms and the person has given informed consent.

---

## 1. Product and hackathon context

MedEasy's existing MVP connects:

**Prescription upload/manual search → user review and confirmation → catalogue price comparison → enquiry list/cart → pharmacy selection → user-sent WhatsApp enquiry → pharmacy response → batch-alert check.**

Phase 2 adds patient identity and a context-memory layer. It must not replace or destabilise the working Phase 1 workflow.

### Meko Track A criteria this phase must support

The supplied HackCBS Meko challenge brief describes Track A as an open project where remembering must change the outcome. The relevant acceptance requirements are:

- **A1 — Context changes the result:** show the same flow with Meko enabled and disabled; the outputs must differ for a clear reason.
- **A2 — At least three real Meko uses:** select at least three from datapacks as scopes, extracted memories, recall before reasoning, promotion to shared knowledge, sharing across users/agents, or documents.
- **A3 — One user and story:** one primary persona, one problem, one repeatable demo story.
- **A4 — Visible context:** UI shows what Meko recalled and what was stored; user can correct or forget it.
- **A5 — Honest and private:** do not send personal data the story does not need; never display context that Meko did not actually return.

The Track A submission also expects a repository with setup in five commands or fewer, a demo of five minutes maximum showing the same flow with Meko on and off, and a Meko feature proposal. The team must also build using coding agents connected to Meko and a shared team build datapack; keep the build datapack separate from all product/runtime datapacks.

The supplied challenge brief also says to build the project at the event and not bring a pre-existing project; it separately permits setting up Meko and coding agents beforehand. Because MedEasy's Phase 1 work predates this phase, the founder must confirm with the organiser whether continuing the existing project is permitted. Do not hide prior work or misrepresent when code was written.

**Do not claim Track A completion merely because an MCP connection succeeds.** Meko must materially change the MedEasy outcome and the UI must make this visible. The brief does not make a separate MedEasy-owned YugabyteDB cluster a Track A scoring requirement; using YSQL for the app's account metadata is a separate architecture choice, not proof of Meko integration.

---

## 2. Architecture and data boundaries

### 2.1 Target topology

```text
┌─────────────────────────────────────────────────────────────┐
│ React + Vite frontend                                       │
│                                                             │
│  Login / Profile / Consent                                  │
│  Existing MedEasy prescription + comparison + pharmacy UX   │
│  Local encrypted health vault (IndexedDB)                   │
│  Meko memory review / correct / forget UI                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS + authenticated session
┌──────────────────────────────▼──────────────────────────────┐
│ MedEasy FastAPI backend                                     │
│                                                             │
│  Auth + profile routes                                      │
│  User authorization + consent checks                       │
│  Existing catalogue / pharmacy / batch routes               │
│  Meko orchestration hand-off (owned by teammate)            │
│  Server-side user_id → meko_datapack_id mapping              │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
      SQL over TLS                 MCP over HTTPS
               │                           │
┌──────────────▼──────────┐      ┌─────────▼──────────────────┐
│ YugabyteDB YSQL         │      │ Meko hosted MCP service   │
│                         │      │                           │
│ users                   │      │ Per-patient datapack      │
│ patient_profiles        │      │ Approved minimal memories │
│ privacy_consents        │      │ memory search/add/update  │
│ meko_datapack_links     │      │ memory delete             │
│ refresh_sessions        │      │ No patient memory sharing │
└─────────────────────────┘      └────────────────────────────┘

Patient's device:
  IndexedDB (encrypted)
    - original prescriptions and reports
    - detailed health history
    - user-reviewed structured records
    - local provenance/source references
```

### 2.2 System-of-record rules

| Data | Authoritative location | May be sent to Meko? |
|---|---|---|
| Email/login identity | YugabyteDB | No |
| Password hash | YugabyteDB | Never |
| Patient display alias | Local profile or minimal account profile | No by default |
| Original prescription image/PDF | Local encrypted vault | No |
| Full extracted prescription | Local encrypted vault pending human review | No |
| Detailed longitudinal medical history | Local encrypted vault | No |
| User-approved, minimal derived health facts | Local vault is source of truth | Yes, only after specific opt-in |
| Meko datapack ID | YugabyteDB mapping table | No |
| Meko API key | Server-side secret/environment only | Never expose to browser |
| Catalogue prices and public CDSCO data | Existing backend/source datasets | Not patient-specific; only send if needed for the agent task |
| Auth/session tokens | Secure session mechanism | Never send to Meko |

**Meko is a context/recall layer, not the canonical medical record.** If a Meko memory conflicts with the local source record, prefer the user-reviewed local source and flag the discrepancy for user review. Do not silently overwrite the local record.

### 2.3 Why these boundaries matter

Meko datapacks are persistent stores for conversations, memories and knowledge. A datapack is an isolation unit, but datapack members can access data in a shared datapack. Meko states that its service is cloud-hosted and that it stores what is sent; it does not automatically anonymise or strip names. Pseudonymisation reduces direct identification risk but does not turn health facts into non-sensitive data.

The app must therefore use a separate, unshared datapack for each patient context. Never put multiple unrelated patients into one runtime datapack. Never share a patient's datapack with another patient or a team member for convenience.

---

## 3. Responsibilities and ownership

### 3.1 Our workstream — user account, YugabyteDB schema, frontend auth/privacy

Own:

1. Inspect the current FastAPI and React/Vite repositories before editing.
2. Add a YugabyteDB YSQL connection and migrations for user identity/profile/consent metadata.
3. Implement basic email/password sign-up, login, logout and current-user/profile endpoints, unless the teammate explicitly owns these routes.
4. Implement user-scoped route protection and frontend auth state.
5. Add first-login privacy explanation and explicit Meko-memory opt-in.
6. Add a patient profile / account view that exposes privacy state without collecting unnecessary health details.
7. Add the frontend Meko memory panel contract: show what was actually recalled/stored; allow edit/correction and forget.
8. Ensure local health documents do not get uploaded to YugabyteDB or Meko.
9. Preserve the existing Phase 1 MedEasy workflow and regression-test it.

### 3.2 Teammate workstream — Meko / Gemini / agent backend

Own:

1. Connect the Meko remote MCP server from Python.
2. Integrate MCP tools into the Gemini/LangChain agent loop.
3. Implement the Meko memory lifecycle: opt-in write, recall before response, edit/correct, delete/forget.
4. Enforce the internal account-to-datapack mapping passed from authenticated backend context.
5. Return auditable fields for UI display: operation, source memory ID, exact returned memory text/facts, timestamp/metadata where supplied by Meko, and success/error state.
6. Never return invented or reconstructed memories as if Meko returned them.
7. Implement Meko-on/Meko-off switch for the controlled comparison demo.
8. Keep Meko secrets server-side.

### 3.3 Shared integration agreement

Before implementation, agree and write down:

- The auth mechanism used by FastAPI.
- The authenticated user identifier format (`UUID`).
- The route that the agent backend calls after auth.
- Who creates a patient's datapack and when.
- The exact Meko memory payload schema.
- The memory write consent rule.
- The Meko tool output schema consumed by the frontend.
- The deletion/forget behavior and its failure state.
- Who owns each backend file so both teammates do not edit the same code concurrently.

Do not create two parallel auth systems or duplicate account tables.

---

## 4. YugabyteDB schema requirements

Use YugabyteDB **YSQL**. Treat it as a PostgreSQL-compatible relational database for MedEasy's account/profile metadata. YugabyteDB documents support for PostgreSQL drivers and SQLAlchemy; use a supported driver/version combination and test against the actual cluster, not only SQLite.

### 4.1 Minimum tables

#### `users`

| Column | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; generated server-side |
| `email` | VARCHAR(320) | Required; normalized lowercase; unique |
| `password_hash` | TEXT | Required; Argon2id hash only |
| `is_active` | BOOLEAN | Default true |
| `email_verified_at` | TIMESTAMPTZ | Nullable; do not pretend verified if email flow is not implemented |
| `created_at` | TIMESTAMPTZ | Server timestamp |
| `updated_at` | TIMESTAMPTZ | Server timestamp |
| `last_login_at` | TIMESTAMPTZ | Nullable |

#### `patient_profiles`

MVP rule: one patient profile per user account unless the founder explicitly approves caregiver/multiple-dependent support.

| Column | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `users.id`, unique for one-profile MVP |
| `display_label` | VARCHAR(80) | Optional alias, not a legal identity requirement |
| `preferred_language` | VARCHAR(12) | Default `en` |
| `created_at` | TIMESTAMPTZ | Server timestamp |
| `updated_at` | TIMESTAMPTZ | Server timestamp |

Do not add date of birth, sex, address, phone, ABHA/health ID, diagnosis, drug list or medical history merely because a profile form has space. Add any field only when a validated product requirement needs it.

#### `privacy_consents`

| Column | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `users.id` |
| `purpose` | VARCHAR(64) | For example `meko_patient_memory` |
| `policy_version` | VARCHAR(32) | Version of exact consent copy shown |
| `granted` | BOOLEAN | Explicit state |
| `granted_at` | TIMESTAMPTZ | Nullable |
| `withdrawn_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Server timestamp |

Consent must be specific to Meko patient-memory processing. Login/signup is not consent. A user who declines must still be able to use the existing MedEasy non-Meko flow.

#### `meko_datapack_links`

| Column | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `users.id`; unique for one patient datapack MVP |
| `patient_profile_id` | UUID | Foreign key to `patient_profiles.id` |
| `datapack_id` | VARCHAR(128) | Meko ID; server-only mapping |
| `status` | VARCHAR(24) | `provisioning`, `active`, `deleting`, `deleted`, `error` |
| `created_at` | TIMESTAMPTZ | Server timestamp |
| `updated_at` | TIMESTAMPTZ | Server timestamp |

Do not accept a `datapack_id` from an untrusted frontend request and use it directly. Backend must resolve the datapack ID from the authenticated user. The client should only send the patient's task/question or explicit memory action.

#### `refresh_sessions` (only if using refresh tokens)

Store a hash of each opaque refresh token, never the raw token. Include `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `last_used_at`.

### 4.2 Optional event/audit table

If an event log is useful, log only metadata such as:

- user UUID;
- operation (`consent_granted`, `consent_withdrawn`, `meko_memory_add`, `meko_memory_search`, `meko_memory_delete`);
- success/failure;
- timestamp;
- Meko request/trace ID if returned.

Do not put medical text, prescription content, passwords, access tokens or Meko API keys in logs.

### 4.3 Migrations and database configuration

- Use Alembic migrations; do not rely on `metadata.create_all()` as the production schema lifecycle.
- Use SQLAlchemy 2.x and a Yugabyte-supported PostgreSQL driver (confirm exact driver/cluster compatibility during setup).
- Keep the YSQL connection string in an environment variable such as `DATABASE_URL`.
- Use TLS/SSL as required by the selected YugabyteDB deployment (YugabyteDB Aeon requires SSL).
- Add connection pooling, transaction rollback on error, and health checks.
- Keep a separate local development database configuration; never commit credentials.
- Test UUIDs, unique email behavior, migrations, transaction rollback and concurrent duplicate signups against YugabyteDB.

---

## 5. Authentication and security requirements

### 5.1 MVP authentication

Implement:

- Sign up with email + password.
- Login with email + password.
- Logout.
- Get current user/profile.
- Update only permitted profile preferences.

### 5.2 Password handling

- Hash passwords using **Argon2id** with a maintained library.
- Never store or log plaintext passwords.
- Never use reversible encryption for passwords.
- Normalize email consistently before lookup and uniqueness checks.
- Use generic login errors so the endpoint does not reveal whether an email exists.
- Add basic login/signup rate limiting if supported by the current hosting setup.

### 5.3 Session handling

Preferred browser approach:

- Short-lived access token held in memory.
- Refresh token in an `HttpOnly`, `Secure`, appropriately `SameSite` cookie.
- Store only a hash of opaque refresh tokens server-side; support rotation/revocation.
- Configure exact CORS origins and credential handling.

If the existing backend already uses a secure, tested session mechanism, preserve it rather than introducing a second one. Do not put long-lived bearer tokens in `localStorage`.

### 5.4 Authorization

- All profile, consent and Meko-linked operations require authentication.
- Derive `user_id` from the validated session/token, never from a caller-supplied body field.
- Apply ownership checks to every profile/session/datapack operation.
- Never trust `user_id`, `patient_profile_id` or `datapack_id` sent by the browser without server-side ownership verification.
- Do not expose a general Meko proxy endpoint that accepts arbitrary tool names or arbitrary datapack IDs from the browser.

### 5.5 Secrets

- `MEKO_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` and JWT/session secrets stay in backend environment/secrets storage.
- Never bundle secrets into Vite `VITE_*` variables; these are public in the browser build.
- Never commit `.env` files or screenshots containing active API keys.
- If a key has been exposed, revoke and rotate it.

---

## 6. Local health vault requirements

### 6.1 Data that stays local

The following stay in browser/device storage and are not sent to YugabyteDB or Meko:

- Original prescription images and PDFs.
- Original lab reports and medical documents.
- Full extracted prescription JSON.
- Detailed medical history and clinician notes.
- Complete medication timeline.

Only records the user reviewed/confirmed may be considered for a minimal Meko memory proposal.

### 6.2 Local storage

- Use IndexedDB for structured records and file blobs; do not use `localStorage` for health records.
- Encrypt local vault payloads at rest using Web Crypto AES-GCM or a well-reviewed library that uses a standard authenticated-encryption scheme.
- Use a dedicated local-vault passphrase/key flow. Do not derive the vault encryption key from the password used to log into the cloud account.
- Keep decrypted data and encryption keys in memory only while the vault is unlocked; lock/clear in-memory key state on logout, timeout or explicit lock.
- Do not claim encryption protects against malware, a compromised browser, keyloggers, screenshots or an already-unlocked device.
- Provide a clear warning that clearing browser data or losing the device may remove locally stored records. Encrypted export/backup can be a follow-up feature if not completed in this phase.
- Do not silently sync local health records to another device.

### 6.3 If local encryption cannot be completed in time

Do not quietly ship unencrypted persistent health records while advertising them as securely local. For the hackathon demo, use synthetic data and session-only records, label the limitation clearly, and leave persistent health-vault encryption as an explicit unfinished requirement. Do not present browser storage as a complete privacy/security solution.

---

## 7. Meko runtime integration contract

This section is mainly for the Meko/backend teammate, but the account/frontend work depends on these contracts.

### 7.1 Connection path

Meko exposes a hosted MCP endpoint:

`https://mcp.mekodata.ai/mcp`

The Meko API key and `User-Agent` header are backend-only. The app backend must connect to Meko as an MCP client. The agent teammate should use the currently supported Meko tool schemas and verify them against the live MCP server rather than hardcoding old schemas.

**Gemini integration caution:** Gemini SDK support for MCP has version/API-specific limits and is experimental in some paths. Do not assume that Gemini's remote-MCP feature can directly connect to Meko in every API/model combination. A practical integration route is:

1. Python MCP client connects to Meko over its supported remote HTTP/Streamable HTTP transport.
2. `langchain-mcp-adapters` exposes the discovered Meko tools as LangChain tools.
3. A Gemini-backed LangChain model uses those tools through its tool/function-calling loop.
4. The backend validates tool arguments and results and enforces the per-user datapack mapping.

Pin compatible package versions and write a smoke test that connects, lists tools, adds one synthetic memory, searches it and deletes it. Do not have two competing MCP integration paths in the MVP.

### 7.2 Required Meko uses for Track A

Use at least these three A2 capabilities, and explicitly show each in the demo:

1. **Datapacks as scopes:** one isolated runtime datapack per MedEasy patient account/profile.
2. **Extracted memories:** turn only user-approved and confirmed source facts into short persistent memory entries.
3. **Recall before reasoning:** search the patient's Meko memories before Gemini generates a context-aware answer or summary.

Do not use patient-memory promotion to shared knowledge. Promotion is for intentionally shared knowledge and can expose memories to datapack members; it is not needed for private patient continuity. Avoid storing full conversations or raw documents in Meko.

### 7.3 What may be sent to Meko

Only after a specific, informed opt-in, the backend may send a minimal memory fact such as:

```json
{
  "memory_type": "patient_context",
  "fact": "Patient-reported allergy to [example substance]; entered by user and confirmed on 2026-10-31.",
  "source_type": "user_confirmed_local_record",
  "source_record_local_id": "opaque-local-reference",
  "recorded_at": "2026-10-31T00:00:00Z",
  "review_status": "user_confirmed"
}
```

This is an illustrative schema only. Do not use this exact clinical fact as real seed data. Ensure dates/times are real and correctly converted; never invent them.

Do not send:

- Name, email, phone, address, date of birth, ABHA/health ID or government identifiers.
- Raw prescription/medical report PDFs or images.
- Full OCR output before user correction.
- Full medication list if only one fact is relevant to the user's current question.
- Unverified diagnoses, AI-inferred allergies or dosage assumptions.
- Passwords, auth tokens, session data, API keys or local encryption keys.
- Whole chat transcripts by default.

Pseudonymous or de-identified clinical facts are still potentially re-identifiable and sensitive. Keep the payload minimal and obtain consent for the Meko processing specifically.

### 7.4 Memory lifecycle

1. **Read consent:** if the user has not opted into Meko memory, do not write patient facts to Meko.
2. **Select minimum facts:** the backend agent proposes only confirmed facts relevant to the task.
3. **Show before save:** present the proposed memory in plain language before storing it.
4. **Explicit approval:** user approves the exact memory text/facts.
5. **Write:** agent calls Meko memory-add tool with the authenticated user's server-resolved datapack ID.
6. **Confirm:** UI shows success only after Meko confirms the write.
7. **Recall:** before responding to a future patient-history question, agent searches the correct datapack.
8. **Evidence:** return the exact recalled memory content and source memory ID to the UI.
9. **Correct:** user edits the local source-of-truth record; if a Meko memory is wrong, agent updates or deletes that specific memory only after user confirmation.
10. **Forget/withdraw:** revoke consent, stop future writes/recalls, request deletion of Meko memories and update status only after backend confirms deletion. If deletion fails, show a pending/error state; do not falsely say the data has been deleted.

Never automatically promote a patient memory. Never allow one user's agent to query another user's datapack. Never use a shared team build datapack for patient data.

### 7.5 Meko account/key model warning

Meko API keys are associated with a Meko account, while the datapack ID selects the target datapack in tool calls. For a backend service account, this means the service credential may have access to multiple datapacks owned by that Meko account. Therefore:

- Keep the key server-side.
- Resolve each user's datapack ID only from the authenticated server-side mapping.
- Never accept arbitrary datapack IDs from the frontend.
- Never share patient datapacks with teammates or other patients.
- Treat the central Meko service key as a high-impact secret.
- Confirm with Meko whether a stronger per-customer credential or tenant isolation pattern is available before production use.

### 7.6 Required response shape for frontend

The teammate should expose a stable API response similar to:

```json
{
  "meko_enabled": true,
  "operation": "recall",
  "status": "success",
  "context_items": [
    {
      "memory_id": "<actual-meko-memory-id>",
      "text": "<exact text returned by Meko>",
      "source": "Meko memory",
      "recorded_at": "<timestamp-if-returned>",
      "review_status": "user_confirmed"
    }
  ],
  "message": "Recalled 1 patient-approved context item."
}
```

This is a proposed MedEasy response contract, not a Meko-native schema. Return only fields supported by the actual Meko tool response. If Meko does not return a timestamp/source field, omit it rather than fabricate it. Include `status: "disabled"`, `"empty"`, or `"error"` when appropriate.

---

## 8. Frontend changes owned by our workstream

### 8.1 Routes/screens

Add only what is necessary:

- `/signup`
- `/login`
- `/account` or `/profile`
- a first-login Meko privacy-consent screen/panel
- a patient-context review panel in the existing assistant/workflow UI

Do not redesign or recreate the entire Phase 1 application as part of account work.

### 8.2 Sign-up form

Fields:

- Email address.
- Password.
- Confirm password.
- Required acceptance of Terms/Privacy notice only if those documents are supplied and approved by the founder.

Do not request full medical history at registration. Do not make Meko opt-in mandatory for account creation.

### 8.3 Login form

- Email.
- Password.
- Show/hide password control.
- Clear field-level validation.
- Generic authentication error.
- Loading state and disabled duplicate submit.
- Link to sign up.

Only implement password reset/email verification if the team can configure and test the underlying email delivery. Do not build a fake success screen.

### 8.4 First-login consent

Show two separate choices:

- **Use MedEasy without persistent Meko memory** — continue with existing core MVP, no patient-specific memory written to Meko.
- **Enable Meko memory for selected health context** — explain that selected, user-approved summaries will be sent to and stored by the hosted Meko service; original files remain local; summaries are still sensitive health information; user can review and request deletion.

Consent must be explicit, versioned, recorded in YugabyteDB and revocable. Do not bundle this consent into Terms acceptance.

### 8.5 Patient context panel

Show:

- Meko status: On / Off / Not connected / Error.
- What was recalled, using exact Meko-returned text.
- Which source record the local app associates with it, using an opaque local reference only.
- What memory is proposed for saving, before it is sent.
- Edit/correct action.
- Save to Meko action with explicit approval.
- Forget/delete action.
- A clear statement that Meko memory is a helper context, not the authoritative medical record.

Do not show a fabricated “memory score”, “health intelligence score” or unsupported accuracy percentage.

### 8.6 Meko on/off demo switch

For the controlled Track A demo, provide a clearly labelled Meko-enabled/disabled mode. It must not be an untracked production bypass. In disabled mode, no patient-specific Meko recall/write occurs. In enabled mode, show the real Meko read/write events and exact returned context.

---

## 9. Backend/API contract for our workstream

First inspect the existing FastAPI `/openapi.json` and repository. Reuse routes if auth already exists. Do not assume route names below exist; they are proposed contracts to coordinate with the backend owner.

| Method | Proposed route | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create account + minimal profile |
| POST | `/api/auth/login` | Authenticate |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/auth/me` | Return current user and minimal profile |
| PATCH | `/api/profile` | Update permitted profile preferences |
| GET | `/api/privacy/consent` | Read current Meko consent state |
| PUT | `/api/privacy/consent/meko-memory` | Grant/update Meko memory consent |
| DELETE | `/api/privacy/consent/meko-memory` | Withdraw consent and trigger memory deletion workflow |
| GET | `/api/meko/context` | Return actual recalled context / connection status (teammate-owned) |
| POST | `/api/meko/memories/propose` | Produce a memory proposal without writing it (teammate-owned) |
| POST | `/api/meko/memories` | Save exact approved memory (teammate-owned) |
| PATCH | `/api/meko/memories/{memory_id}` | Correct memory (teammate-owned) |
| DELETE | `/api/meko/memories/{memory_id}` | Forget/delete memory (teammate-owned) |

All Meko routes must infer `user_id` from auth context and resolve `datapack_id` in the backend. Never allow the client to choose a different account's datapack.

### Suggested signup response

```json
{
  "user": {
    "id": "<uuid>",
    "email": "person@example.com"
  },
  "profile": {
    "id": "<uuid>",
    "display_label": "My health profile",
    "preferred_language": "en"
  }
}
```

Do not return password hashes, internal Meko keys, or raw datapack IDs to the frontend.

---

## 10. Phase-by-phase execution plan

### Phase 2A — Repository and ownership inspection

**Agent tasks**

- Inspect frontend/backend repo structure and current branch.
- Run current tests/build and record baseline.
- Identify existing auth, database setup and API conventions.
- Create `PHASE2_DECISIONS.md` with exact ownership and unresolved choices.

**Founder must do manually**

- Confirm whether the product supports one patient per account for the hackathon (recommended: yes).
- Confirm the selected privacy mode: strict local-only or opt-in Meko memory (recommended: opt-in, limited summary).
- Ask the Meko mentor/organizer whether pseudonymous health context may be stored in their hosted service and obtain the applicable privacy/retention/deletion terms.

**Gate:** Do not send patient facts to Meko until the privacy mode and consent copy are approved.

### Phase 2B — YugabyteDB connection and migrations

**Agent tasks**

- Configure YSQL connection using environment secrets.
- Add SQLAlchemy models + Alembic migrations.
- Create `users`, `patient_profiles`, `privacy_consents`, `meko_datapack_links`, and optionally `refresh_sessions`.
- Add indexes/unique constraints and ownership foreign keys.
- Run migrations against a real YugabyteDB development cluster.

**Founder must do manually**

- Create the YugabyteDB cluster/database and database user, or provide the existing connection secret through the approved secret manager.
- Confirm TLS/SSL settings and permitted network access.
- Never paste credentials into source code, screenshots or chat logs.

**Gate:** Verify a signup record and profile row appear in YugabyteDB; confirm no prescription or medical-content fields were created.

### Phase 2C — Auth implementation

**Agent tasks**

- Implement signup/login/logout/current-user.
- Hash passwords with Argon2id.
- Add secure session handling and route dependencies.
- Add generic errors, validation, rate limiting if feasible.
- Add tests for duplicate email, wrong password, inactive user, expired/revoked session and cross-user access.

**Founder must do manually**

- Create two test accounts with synthetic email addresses you control.
- Test signup, logout, login and browser refresh.
- Attempt to access Account A's profile while signed in as Account B; it must fail.

**Gate:** Auth must work without breaking unauthenticated public catalogue browsing if that is part of the current product design.

### Phase 2D — Local vault and privacy UX

**Agent tasks**

- Inspect current prescription state/storage approach.
- Ensure originals/full records stay in IndexedDB/local device storage, not cloud DB or Meko.
- Implement/verify encryption before persisting real health documents.
- Add local-vault lock/unlock and clear privacy messaging.
- Add first-login consent with Meko disabled by default.

**Founder must do manually**

- Test a synthetic prescription upload.
- Inspect browser network requests: uploading/storing a local record must not POST the original file or full OCR data to YugabyteDB or Meko.
- Verify browser refresh behavior, logout behavior and local-data loss warnings.

**Gate:** If encryption or network-boundary verification is incomplete, demo only synthetic/session data and label the local persistence limitation.

### Phase 2E — Meko teammate integration hand-off

**Agent tasks (teammate)**

- Connect to Meko MCP from Python using the current remote MCP transport.
- Use LangChain MCP adapters as the bridge if the chosen Gemini API path does not support direct remote MCP in the target model/API.
- Verify actual tool schemas at runtime.
- Implement per-user datapack resolution from authenticated backend mapping.
- Add one synthetic memory, search it on a later turn, update/delete it and capture real tool outputs.

**Founder must do manually**

- Create/approve the Meko application account and runtime datapack provisioning process.
- Confirm each test patient gets a separate unshared datapack.
- Verify no patient data is stored in the Meko team build datapack.
- Check that Meko API key is absent from frontend bundles and Git.

**Gate:** A memory from User A must never appear for User B. If this test fails, stop Meko integration.

### Phase 2F — Frontend integration and context transparency

**Agent tasks**

- Add auth routes and protected account/profile view.
- Add consent page/panel.
- Add context panel with actual recall/write/delete results.
- Preserve existing core MVP state when moving between auth and workflow pages.
- Add loading/empty/error/offline/Meko-disabled states.

**Founder must do manually**

- Ask a non-technical tester to sign up and complete the core flow.
- Ask them to explain, in their own words, what information remains on the device and what is sent to Meko.
- If they cannot explain it, simplify the UI/consent explanation before continuing.

**Gate:** User can identify exactly what Meko remembered and can request correction/forgetting without contacting the development team.

### Phase 2G — Track A proof and final regression

**Agent tasks**

- Build the same repeatable patient story with Meko ON and OFF.
- Show Meko datapack selection, actual memory extraction/add, later recall before reasoning, and returned context in UI.
- Log real Meko calls for the demo; no fabricated events.
- Keep one source synthetic patient and deterministic seed data.
- Run backend tests, frontend lint/typecheck/build and end-to-end regression.

**Founder must do manually**

- Rehearse the full 5-minute demo with a timer.
- Check every context item shown is exactly returned by Meko.
- Check Meko OFF produces a clearly less context-aware result.
- Confirm the README setup works in five commands or fewer.
- Verify the repo contains no API keys, real patient data, prescription files or personal health data.

**Gate:** Do not claim Track A A1–A5 are complete unless the evidence exists for each requirement.

---

## 11. Acceptance tests (must pass)

### Account/database

- [ ] Signup creates one `users` row and one minimal `patient_profiles` row.
- [ ] Duplicate email is rejected safely.
- [ ] Password database value is an Argon2id hash, not plaintext.
- [ ] Wrong password returns generic auth failure.
- [ ] User cannot read/update another user's profile or consent.
- [ ] Logout revokes/invalidates the session.
- [ ] Migrations apply cleanly on YugabyteDB YSQL.

### Privacy/data boundaries

- [ ] No raw prescription or detailed history column exists in YugabyteDB.
- [ ] No original file/full OCR document is sent to Meko.
- [ ] Meko memory write is blocked until specific consent is granted.
- [ ] Consent is revocable and stored with policy version/timestamps.
- [ ] A user can see the exact remembered item returned by Meko.
- [ ] A user can correct/delete a memory; UI shows pending/error rather than false success if deletion fails.
- [ ] Patient runtime datapacks are not shared or promoted.
- [ ] No patient's memory appears in another patient's session.
- [ ] No secrets appear in browser bundle, logs or Git.

### Meko Track A

- [ ] Datapacks are used as patient scopes.
- [ ] At least one actual approved memory is stored through Meko.
- [ ] A later task recalls that memory before the agent reasons/responds.
- [ ] User interface displays exact Meko-returned context and enables correction/forget.
- [ ] Meko ON and OFF produce clearly different results on the same story.
- [ ] All displayed Meko interactions are backed by actual call logs/results.
- [ ] Team build datapack is separate from product runtime datapacks.
- [ ] Build datapack has at least ten promoted decisions from at least two teammates' coding agents and passes the challenge's Check T procedure.

### Existing MedEasy regression

- [ ] Manual medicine search still works.
- [ ] Prescription upload/extraction route still works.
- [ ] User-confirmation gate still works.
- [ ] Catalogue price comparison still works with missing-price handling.
- [ ] Enquiry list/cart still works.
- [ ] Pharmacy list/map fallback still works.
- [ ] WhatsApp remains a manual user-initiated hand-off.
- [ ] Batch-alert checker still distinguishes match/no-match/dataset-unavailable.

---

## 12. Meko-on vs Meko-off demo design

Use a synthetic patient profile and synthetic records only.

### Scenario

A returning user asks a question that depends on an earlier, explicitly approved context fact. Example: "Summarise the relevant details I previously asked MedEasy to remember before I contact the pharmacy."

### Meko OFF

- Agent has only the current prompt and current local screen context allowed by the app.
- Agent does not call Meko or receive stored patient memories.
- It must explain that it does not have the earlier approved context available in this mode.

### Meko ON

- Agent searches the current user's datapack.
- The UI shows the exact retrieved memory/fact and source memory ID.
- Agent uses that returned fact alongside current user-provided information.
- UI lets the user correct or forget the memory.

Do not create an artificial difference by hiding ordinary information from the Meko-OFF path. The distinction must be the absence/presence of genuinely persistent Meko context.

### Five-minute presentation outline

1. Problem + patient persona (30 seconds).
2. Existing MedEasy workflow (45 seconds).
3. Meko OFF result (45 seconds).
4. Meko ON: show actual recall and changed output (90 seconds).
5. Show context inspection/correction/forget and privacy boundary (60 seconds).
6. Close with limitations and Meko feature proposal (30 seconds).

---

## 13. Explicit non-goals for Phase 2

Do not attempt to build these in this phase unless the founder reprioritises:

- Cloud sync of full medical history.
- Uploading all prescription PDFs/images to Meko knowledge bases.
- Sharing patient datapacks with family members, doctors or pharmacies.
- Automatic memory promotion to shared Meko knowledge.
- Diagnosis, treatment recommendations, drug interaction decisions or dosage advice.
- Automatic generic substitution.
- ABHA/ABDM integration or official health-record import unless separately scoped and validated.
- Multi-dependent family accounts.
- Full password reset/email verification if no email infrastructure is available.
- Cross-device medical record sync.
- Production healthcare compliance claims or certifications.

---

## 14. Decisions that require founder confirmation

The coding agent must record these in `PHASE2_DECISIONS.md` and must not silently assume answers:

1. **Privacy mode:** opt-in minimal Meko memory vs strict local-only with no patient-specific Meko memory.
2. **Account model:** one patient per account for hackathon (recommended) vs caregiver with multiple patient profiles.
3. **Local vault:** encrypted persistent IndexedDB vs session-only synthetic demo data until encryption is complete.
4. **Meko provisioning:** central service account creates one isolated datapack per patient vs another Meko-approved tenant/credential scheme.
5. **Consent/retention:** what exact data Meko may store, how long, and how deletion is confirmed.
6. **YugabyteDB:** which cluster/environment and who owns credentials/backups.
7. **Agent integration path:** remote MCP through LangChain MCP adapters vs a different verified approach supported by the chosen Gemini model/API.
8. **Existing backend ownership:** which teammate owns authentication, Meko orchestration and FastAPI route integration.

### Recommended default decisions for the hackathon

- One patient profile per user.
- Meko memory off by default and separately opt-in.
- Original files and detailed medical history local only.
- Minimal pseudonymous memory facts only, each user-approved.
- Separate runtime datapack per patient; no sharing and no promotion.
- YugabyteDB stores identity/profile/consent/mapping metadata only.
- Existing core workflow remains available when Meko is off.
- Use synthetic demo data until storage terms and consent are reviewed.

---

## 15. Source references

### Supplied challenge brief

- HackCBS 9.0 — Meko Challenge PDF supplied by the founder (31 Oct–1 Nov 2026), especially Track A requirements A1–A5, shared build datapack and submission/scoring sections.

### Meko documentation

- Datapacks and isolation: https://docs.mekodata.ai/architecture/core-concepts/datapacks/
- Meko MCP server/tools: https://docs.mekodata.ai/reference/mcp-server/
- Connect programmatically: https://docs.mekodata.ai/integrations/connect-programmatically/
- Work with memory: https://docs.mekodata.ai/guides/working-with-memory/
- Meko FAQ (data handling and hosting): https://mekodata.ai/faq/
- How Meko fits in your stack: https://docs.mekodata.ai/architecture/how-meko-fits/

### Gemini / LangChain / YugabyteDB documentation

- Gemini function calling and MCP: https://ai.google.dev/gemini-api/docs/function-calling
- LangChain MCP tools: https://reference.langchain.com/python/langchain/mcp/tools
- YugabyteDB drivers and ORMs: https://docs.yugabyte.com/stable/develop/drivers-orms/
- YugabyteDB SQLAlchemy integration: https://docs.yugabyte.com/stable/integrations/sqlalchemy/
- YugabyteDB PostgreSQL API compatibility: https://docs.yugabyte.com/stable/faq/compatibility/

---

## Final instruction to the coding agent

**Read this file and the existing MedEasy handoff pack before changing code. Inspect the actual repositories and live OpenAPI schema. Preserve the Phase 1 MVP. Implement only the account/profile/privacy/frontend work assigned to this workstream, agree the API contract with the Meko teammate, and stop at each founder gate. Never claim patient medical records remain exclusively local if any patient-specific health fact is written to hosted Meko.**
