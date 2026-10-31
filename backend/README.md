# MedEasy backend — Feature 1

FastAPI service for catalogue search and medicine price comparison. The application loads the provided CSV with Pandas during startup and never writes to it.

## Run locally

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI is available at `http://localhost:8000/docs`.

## Configuration

- `MEDEASY_CSV_PATH`: optional absolute or relative path to the catalogue; defaults to `app/data/MedEasy_catalogue_500_complete.csv`.
- `MEDEASY_CORS_ORIGINS`: comma-separated allowed origins; defaults to localhost ports 5173.

## Endpoints

- `GET /api/health`
- `GET /api/medicines/search?q=Paracetamol%20500%20mg`
- `GET /api/medicines/{id}`
- `GET /api/medicines/categories`
- `GET /api/medicines/maximum-savings` (optional `provider=jan_aushadhi` or `provider=dava_india`)

## Tests

From `backend/`, run `pytest -q`.
