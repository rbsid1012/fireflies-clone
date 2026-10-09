# Fireflies Clone

Monorepo: `frontend/` (Next.js App Router, TS) and `backend/` (FastAPI, Python 3.12, SQLAlchemy 2.0, Alembic, SQLite + FTS5).

## Ground rules
- Work one phase at a time. After each phase: summarize what was built, list files touched, explain non-obvious decisions, then stop.
- Write everything fresh; do not copy existing Fireflies clones.
- Small, single-purpose files. No 500-line components.
- Every API route has Pydantic request/response schemas; never return raw dicts.
- Timestamps in transcript data are integer milliseconds.
- Layering: routers -> services -> models. No business logic or raw SQL in routers.
- After each phase, append a section to `docs/DECISIONS.md` explaining why.

## Backend
```bash
cd backend && source .venv/bin/activate   # uv venv --python 3.12 .venv
uv pip install -r requirements.txt
alembic upgrade head                      # also runs automatically on app startup
uvicorn app.main:app --reload
pytest
python -m app.seed.seed [--reset]       # seed demo data (also runs on startup if the DB has no users)
```
Tests build their DB with the real Alembic migrations, so FTS triggers are exercised.

## Frontend
```bash
cd frontend && npm install
npm run dev            # http://localhost:3000 (needs the backend on :8000, or set NEXT_PUBLIC_API_URL)
npm run gen:types      # regenerate lib/api-types.ts from the running backend's OpenAPI schema
npm test               # vitest: lib/ helpers and the API client
npm run typecheck && npm run lint && npm run build
```
Next.js here is v16: read `frontend/node_modules/next/dist/docs/` before using an API from memory (e.g. the error boundary prop is `retry`).
shadcn/ui is the Base UI flavour (`render` prop instead of `asChild`). Design tokens live in `app/globals.css`; reference screenshots in `docs/reference/`.

## Config (env or backend/.env)
See `backend/.env.example` for the full list. Main ones: `DB_PATH`, `MEDIA_DIR`, `CORS_ORIGINS` (comma separated), `FRONTEND_URL`, `APP_ENV` (`production` refuses the default `SECRET_KEY`), `SECRET_KEY`, `SEED_ON_STARTUP`, `DEMO_LOGIN_ENABLED`, `GOOGLE_CLIENT_ID`, `EMAIL_FROM` + `SMTP_*` or `RESEND_API_KEY` (neither = emails only go to the in-app outbox), `LLM_API_KEY` (unset = heuristic summaries and quote-based Ask Fred), `LLM_MODEL` (default `claude-opus-5-5`), `LLM_BASE_URL` (set to use an OpenAI-compatible provider such as Gemini or Groq instead of Anthropic), `STT_MODEL` (Whisper model used to transcribe a recording uploaded on its own; needs `LLM_BASE_URL` + `LLM_API_KEY`), `ALLOW_INSECURE_WEBHOOKS` (dev only).
Swagger UI: http://localhost:8000/docs. Deploy notes: `docs/DEPLOY.md`.
