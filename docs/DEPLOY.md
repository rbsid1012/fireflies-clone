# Deploying

Recommended: **backend on Railway (with a volume), frontend on Vercel.** Render is the alternative.

## Which host?

| | Render free | Render paid | Railway | Vercel (frontend) |
|---|---|---|---|---|
| Sleeps when idle | Yes, after 15 min; waking takes about a minute | No | No, unless you turn on its sleep option | No |
| SQLite survives restarts | **No**, the disk is wiped | Yes, with a persistent disk | Yes, with a volume | n/a |
| Cost | $0 | Starter instance about $7/month plus disk about $0.25/GB/month (check render.com/pricing) | $5 trial credit once, then Hobby at $5/month with $5 of usage included | Free Hobby plan (personal, non-commercial use) |

Why not Render free: a reviewer's first click would wait about a minute for the server to wake, and every wake or redeploy deletes uploads and new accounts (the seed data comes back, nothing else).

**Railway cost for a 5 to 6 day trial.** Railway bills only what you use: about $10 per GB of RAM per month, $20 per vCPU per month, $0.15 per GB of volume per month, $0.05 per GB of traffic (Railway's published rates). This backend is light, roughly 0.25 GB RAM, 0.1 vCPU and a 1 GB volume while idle, which is about $4 to $5 per month, so **6 days is about $1**. Adding the frontend on Railway as well would add about $1 more. The $5 trial credit covers all of that. Real usage runs higher while a recording is being transcribed, so set a usage limit in Railway's billing settings.

**If it goes in your business Railway workspace:** create it as its own project (not inside an existing one), so its usage shows up separately, and delete the project when the trial ends. On Hobby or Pro the usage counts against the plan's included credit.

**SQLite on Railway:** works well on one instance with the volume mounted at `/data` (`DB_PATH=/data/app.db`, `MEDIA_DIR=/data/media`). Do not run more than one replica. Redeploys restart the single instance, so expect a few seconds of downtime. To back up, run `sqlite3 /data/app.db ".backup /data/backup.db"` from a Railway shell and download the copy.

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

Optional: `EMAIL_FROM` plus either `SMTP_*` or `RESEND_API_KEY` (real email), `GOOGLE_CLIENT_ID` (Google sign-in), and `LLM_API_KEY` for AI summaries and written answers (Groq by default; `LLM_BASE_URL` and `LLM_MODEL` switch to Gemini or another provider; see `backend/.env.example`).

4. Generate a public domain; `GET /api/health` should return `{"status":"ok"}`.

Railway keeps services running unless you enable its sleep option; if the server is ever starting up, the app shows a "server is waking up" banner.

## 2. Frontend — Vercel

1. Import the repo, **root directory `frontend`**, framework Next.js.
2. Set `NEXT_PUBLIC_API_URL` to the Railway URL (no trailing slash).
3. Deploy, then put the Vercel URL into the backend's `CORS_ORIGINS` and `FRONTEND_URL` and redeploy the backend.

## 3. Google sign-in (optional)

Create an OAuth **Web** client in Google Cloud, add your frontend URL as an authorised JavaScript origin, and set `GOOGLE_CLIENT_ID` on the backend. The button appears automatically.

## 4. Real email (optional)

Without credentials, every email (meeting recap, welcome, password reset) is rendered and stored in **Settings → Recording & Privacy → Email outbox** but not sent. Set SMTP or Resend variables to deliver them.
