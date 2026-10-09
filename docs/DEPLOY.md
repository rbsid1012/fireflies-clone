# Deploying

Backend on Render (free) or Railway (persistent volume), frontend on Vercel.

## 1a. Backend — Render (free, demo-grade)

1. Render dashboard → **New → Blueprint** → pick this repo; it reads `render.yaml`.
2. When asked, set `CORS_ORIGINS` and `FRONTEND_URL` to your Vercel URL (you can edit them later under Environment).
3. Check `https://<service>.onrender.com/api/health`.

**Free-plan limits:** the service sleeps after ~15 minutes idle (first request takes ~30–60 s, the app shows a "waking up" banner), and the disk is **ephemeral**: the SQLite database and uploaded media are wiped on every restart or redeploy. With `SEED_ON_STARTUP=true` the demo data comes back, but accounts, new meetings and uploads do not. For data that persists, use a paid Render disk or Railway below.

## 1b. Backend — Railway

1. New project → deploy from this repo, **root directory `backend`** (it has a `Dockerfile` and `railway.json`).
2. Add a **volume** mounted at `/data`.
3. Set variables:

| Variable | Value |
|---|---|
| `APP_ENV` | `production` (the app refuses to start with the default secret) |
| `SECRET_KEY` | a long random string |
| `DB_PATH` | `/data/app.db` |
| `MEDIA_DIR` | `/data/media` |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://fireflies-clone.vercel.app` |
| `FRONTEND_URL` | the same Vercel URL (used for links in emails) |
| `SEED_ON_STARTUP` | `true` for a demo with sample meetings, `false` for an empty app |
| `DEMO_LOGIN_ENABLED` | `true` keeps the "Try the demo" button; `false` hides it |

Optional: `EMAIL_FROM` plus either `SMTP_*` or `RESEND_API_KEY` (real email), `GOOGLE_CLIENT_ID` (Google sign-in), and `LLM_API_KEY` for AI summaries and written answers (with `LLM_BASE_URL` and `LLM_MODEL` for a non-Anthropic provider such as Groq or Gemini; see `backend/.env.example`).

4. Generate a public domain; `GET /api/health` should return `{"status":"ok"}`.

Railway's free/hobby instances can sleep; the app shows a "server is waking up" banner while it starts.

## 2. Frontend — Vercel

1. Import the repo, **root directory `frontend`**, framework Next.js.
2. Set `NEXT_PUBLIC_API_URL` to the Railway URL (no trailing slash).
3. Deploy, then put the Vercel URL into the backend's `CORS_ORIGINS` and `FRONTEND_URL` and redeploy the backend.

## 3. Google sign-in (optional)

Create an OAuth **Web** client in Google Cloud, add your frontend URL as an authorised JavaScript origin, and set `GOOGLE_CLIENT_ID` on the backend. The button appears automatically.

## 4. Real email (optional)

Without credentials, every email (meeting recap, welcome, password reset) is rendered and stored in **Settings → Recording & Privacy → Email outbox** but not sent. Set SMTP or Resend variables to deliver them.
