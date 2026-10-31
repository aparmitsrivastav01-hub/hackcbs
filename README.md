# MedEasy

> Healthcare Accessibility & Medicine Price Transparency Platform

MedEasy bridges prescription comprehension, transparent generic medicine price discovery, and neighborhood pharmacy inquiries into an accessible web application.

---

## Architecture & Codebase Structure

```text
hackcbs/
├── backend/                  # FastAPI Python backend (medicines catalogue, search, savings, cart, CDSCO alerts)
│   ├── app/                  # Application code (routes, services, models, data)
│   ├── tests/                # Pytest test suite
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Backend setup & development guide
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS frontend
│   ├── src/                  # Application components, pages, context, and API client
│   ├── public/               # Static assets & icons
│   ├── package.json          # Node dependencies and scripts
│   └── vite.config.ts        # Vite bundler configuration
├── docs/                     # Specifications (MVP screens, UI/UX guidelines, PRD, userflows)
├── FRONTEND_INTEGRATION.md   # Feature 1 API contract documentation
└── README.md                 # Monorepo architecture and instructions
```

---

## Quick Start

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
* **API Base:** `http://localhost:8000`
* **Swagger Docs:** `http://localhost:8000/docs`

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* **Web App:** `http://localhost:5173`
* **API Configuration:** Configurable via `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`).

---

## Key Features

1. **Prescription Transcription & Human Confirmation (`/scan`):** Upload image/PDF prescriptions with an mandatory verification gate before querying the catalogue.
2. **Transparent Price Discovery (`/medicines`):** Honest comparisons between Private Brand retail MRP, Jan Aushadhi (PMBJP), and Dava India.
3. **Maximum Savings Opportunities (`/medicines`):** Top 10 percentage and rupee discount opportunities.
4. **Pharmacy Enquiry Cart (`/cart`):** Build an enquiry list for local chemists without misleading checkout/payment flows.
5. **Nearby Store Discovery & WhatsApp Handoff (`/stores`):** Find local pharmacies and prepare structured WhatsApp availability enquiries.
6. **CDSCO Batch Quality Alert Checker (`/batch-safety`):** Check batch numbers against official government Not of Standard Quality (NSQ) bulletins.
