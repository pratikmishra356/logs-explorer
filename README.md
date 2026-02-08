# Log Explorer Service

Multi-tenant log explorer with provider-agnostic architecture. Currently supports **Splunk Cloud**, designed for easy addition of OpenSearch and other providers.

## Architecture

- **Backend**: Python / FastAPI / SQLAlchemy (async) / PostgreSQL
- **Frontend**: React / TypeScript / Vite / Tailwind CSS
- **Provider pattern**: Abstract `BaseLogProvider` with per-provider implementations

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally on port 5432

### 1. Database

```bash
PGPASSWORD=postgres psql -U postgres -h localhost -d postgres -c "CREATE DATABASE logs_explorer;"
```

### 2. Backend (port 8003)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Update .env with your Splunk credentials if needed
# Run migrations
PYTHONPATH=. alembic upgrade head

# Start server
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

API docs at http://localhost:8003/docs

### 3. Frontend (port 3003)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3003

## Usage Flow

1. **Create an Organization** on the Organizations page
2. **Add a Provider Connection** (Splunk Cloud) with host URL and cookie credentials
3. **Test Connection** to verify connectivity
4. **Sync Metadata** to pull indexes, sourcetypes, apps, saved searches, and dashboards
5. **Search Logs** using the search interface

## Project Structure

```
backend/
  app/
    models/       # SQLAlchemy ORM (7 provider-agnostic tables)
    schemas/      # Pydantic request/response models
    api/routes/   # FastAPI route handlers
    providers/    # Provider integrations (splunk/, opensearch/ future)
    services/     # Business logic layer
  alembic/        # Database migrations

frontend/
  src/
    api/          # Axios client + TypeScript types
    pages/        # React page components
    App.tsx       # Router setup
```

## Adding a New Provider

1. Create `backend/app/providers/<name>/` with `client.py`, `provider.py`, `mappers.py`
2. Implement `BaseLogProvider` in `provider.py`
3. Register in `backend/app/providers/registry.py`
