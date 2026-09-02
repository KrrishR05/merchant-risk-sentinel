# RiskSūtra — AI Merchant Risk Intelligence

> Detect merchant account takeover through behavioral genome analysis and temporal attack-chain detection.

**Razorpay Buildathon 2026 · Track 02 Submission**

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│   Next.js Frontend  │────▶│   FastAPI Backend     │────▶│  PostgreSQL/SQLite │
│   (Port 3000)       │     │   (Port 8000)         │     │  (Dual-mode DB)   │
└─────────────────────┘     └──────────┬───────────┘     └───────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────▼─────┐    ┌──────▼──────┐    ┌─────▼──────┐
              │  Baseline  │    │  Risk Fusion │    │  Synthetic │
              │  Engine    │    │  Engine      │    │  Generator │
              └───────────┘    └─────────────┘    └────────────┘
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m scripts.seed_data     # Generate synthetic merchants + inject scenarios
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Starts on http://localhost:3000
```

### Database Switch (SQLite → PostgreSQL)
```bash
# In .env or environment:
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/risksutra
```

## Test Suite
```bash
cd backend
python -m pytest tests/test_core.py -v    # 27 tests
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + DB status |
| GET | `/overview` | Dashboard overview data |
| GET | `/merchants` | List all merchants |
| GET | `/merchants/{id}` | Merchant details |
| GET | `/merchants/{id}/risk` | Current risk assessment |
| GET | `/merchants/{id}/profile` | Behavioral genome |
| GET | `/merchants/{id}/events` | Recent events |
| GET | `/merchants/{id}/timeline` | Temporal event sequence |
| POST | `/events` | Ingest single event |
| POST | `/events/batch` | Ingest event batch |
| GET | `/incidents` | List incidents |
| GET | `/incidents/{id}` | Incident details |
| POST | `/scenarios/inject` | Inject test scenario |

## Project Structure

```
merchant-risk-sentinel/
├── backend/
│   ├── api/main.py               # FastAPI application
│   ├── db/database.py            # Dual-mode DB (PostgreSQL + SQLite)
│   ├── models/schemas.py         # Pydantic domain schemas
│   ├── risk/
│   │   ├── baseline_engine.py    # Behavioral genome builder
│   │   └── fusion_engine.py      # Risk signal aggregator
│   ├── services/
│   │   ├── risk_orchestrator.py  # Pipeline orchestrator
│   │   └── synthetic_generator.py # Data generator
│   ├── scripts/seed_data.py      # DB seeder
│   ├── tests/test_core.py        # 27 automated tests
│   └── requirements.txt
├── frontend/
│   └── src/app/page.tsx          # Dashboard UI
├── docs/                         # Architecture documentation
├── data/                         # SQLite DB + generated data
└── .env.example
```

## Tech Stack

- **Backend**: Python 3.14, FastAPI, Pydantic v2
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Database**: PostgreSQL (production) / SQLite (development)
- **Risk Engine**: Statistical z-score deviation, weighted multi-category fusion
- **Data**: Synthetic merchant archetypes with reproducible ATO/benign scenarios

## License

MIT
