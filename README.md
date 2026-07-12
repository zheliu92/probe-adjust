# Probe-Adjust

A research prototype supporting experience-focused mixed-methods studies. Researchers design a study plan, upload participant data, run AI-assisted analysis to surface interviewable tensions, and adjust their post-experience interview protocol — all in one tool.

Built for a user study comparing three modes of AI support: **Findings**, **Suggestions**, and **No AI Baseline**.

---

## Quick start (local)

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # leave OPENAI_API_KEY=placeholder for mock mode
python seed.py                   # populate DB with the simulated study
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Workflow

### Stage 1 — Study Design
1. Enter your **Participant ID** on the entry screen
2. You land on the **Study Plan canvas** — pre-populated with a simulated smart home UX study
3. Drag blocks to reorder, double-click labels to rename, click slot badges to edit data slots
4. Each slot has an optional **template file** upload and an **AI analysis instruction** field

### Stage 2 — Study Conduct
1. Click **"Begin Study Conduct"** from the canvas
2. **Upload a participant data zip** (e.g. `P1_experience_data.zip`) — the system unpacks it and routes each file to the correct slot automatically
3. Select your **AI assistance mode**:
   - **Findings** — surfaces interviewable tensions with source citations
   - **Suggestions** — findings plus protocol adjustment suggestions
   - **No AI Baseline** — raw data access only
4. Click **Start Session**

### Stage 2 Workspace
- **Left panel** — study plan with uploaded files per slot; click any file to open it in the viewer
- **Centre panel** *(Findings/Suggestions only)* — submit named analysis requests; results appear block by block as they complete. Citations are clickable and jump to the exact source line.
- **Right panel** — editable interview protocol, auto-saved every 2 seconds

### Interview Ready
Click **"Ready to Interview →"** in the header to open a clean read-only view of the adjusted protocol. Export as `.txt` for a paper copy.

---

## Mock AI mode (no API key needed)

With `OPENAI_API_KEY=placeholder` (the default), the system returns realistic mock findings after a 5-second delay — long enough to see the queue and "analysing…" state. Citations reference real line numbers in the seeded data, so the file viewer highlighting works end-to-end.

To use the real LLM, replace `placeholder` with your OpenAI API key in `backend/.env`.

---

## Data collection for your user study

All researcher interactions are logged automatically:

| What | Where |
|---|---|
| Interaction logs (JSONL, one file per session) | `backend/logs/session_{PID}_{timestamp}.jsonl` |
| Protocol edits (line-level diffs) | Inside the JSONL log as `protocol_edit` events |
| Per-session protocol snapshots | SQLite DB, `protocol_snapshot` table |
| Final protocol state per participant | SQLite DB, `study_participant.protocol_content` |

### Download all data in one zip

```
GET http://localhost:8000/api/admin/export
```

This returns a zip containing:
- All JSONL interaction logs (`logs/`)
- `protocol_snapshots.json` — full protocol state at the end of every session, keyed by participant ID, session ID, and mode
- `participants.json` — participant labels and IDs for cross-referencing

You can also download individual log files:
```
GET /api/admin/logs                         # all logs as a zip
GET /api/admin/logs/{session_id}            # single session JSONL
```

### Log event types

| Event | Captures |
|---|---|
| `session_start` | Researcher PID + timestamp |
| `stage2_start` | Mode + study participant ID selected |
| `analysis_triggered` | Label, files included, custom prompt |
| `finding_viewed` | Which finding was expanded |
| `citation_clicked` | Which citation link was clicked |
| `suggestion_viewed` | Which suggestion was expanded |
| `source_toggled` | File included/excluded from analysis |
| `protocol_edit` | Unified diff of what changed |
| `session_end` | Timestamp + duration |

---

## Re-seeding

To reset all data and start fresh:

```bash
cd backend
rm -f probe_adjust.db
rm -rf uploads/templates uploads/participants
python seed.py
```

---

## Configuration (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./probe_adjust.db` | Swap to `postgresql://...` for cloud |
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `UPLOAD_DIR` | `./uploads` | Where files are stored |
| `LOG_DIR` | `./logs` | Where JSONL logs are written |
| `OPENAI_API_KEY` | `placeholder` | Set to real key for live LLM |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `EXTRA_ORIGINS` | *(empty)* | Comma-separated additional CORS origins |

---

## Deploying to the cloud (GitHub Pages + Render)

The frontend deploys to **GitHub Pages** (free static hosting).
The backend deploys to **Render** (free web service tier).

### Step 1 — Push to GitHub

```bash
cd /path/to/probe-adjust
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/probe-adjust.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages

1. Go to your repo on GitHub → **Settings → Pages**
2. Under "Source", select **GitHub Actions**
3. Add a repository secret: **Settings → Secrets → Actions → New repository secret**
   - Name: `VITE_API_BASE_URL`
   - Value: `https://probe-adjust-api.onrender.com/api` *(fill in after Step 3)*
4. Push any change to `main` (or trigger the workflow manually) — the frontend will build and deploy automatically

Your app will be live at: `https://YOUR_USERNAME.github.io/probe-adjust/`

> **Note:** The first deployment triggers when you push to `main`. After that, every push to `frontend/` triggers a redeploy automatically.

### Step 3 — Deploy backend to Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml` and configure the service
4. In the Render dashboard, set these environment variables:
   - `OPENAI_API_KEY` — your OpenAI key (or leave blank for mock mode)
   - `FRONTEND_ORIGIN` — `https://YOUR_USERNAME.github.io`
   - `EXTRA_ORIGINS` — `https://YOUR_USERNAME.github.io/probe-adjust`
5. Click **Deploy**

Once deployed, copy the Render URL (e.g. `https://probe-adjust-api.onrender.com`) and update the `VITE_API_BASE_URL` secret in step 2 with `/api` appended.

> **Important:** Render's free tier **spins down after 15 minutes of inactivity** and takes ~30 seconds to wake up on the first request. For a user study, open the app URL before your participant arrives to pre-warm the server.

> **Data persistence:** Render's free tier uses ephemeral storage — the SQLite database and uploaded files are wiped on each redeploy. For a real study, either upgrade to a paid Render plan with a persistent disk, or switch to PostgreSQL + S3 (see the architecture docs).

### Workaround for persistent study data on Render free tier

Before each study session, re-run the seed by including it in the build command (already in `render.yaml`). Between sessions, use `GET /api/admin/export` to download all logs and snapshots before redeploying.

---

## Architecture

See the `architecture/` folder for full documentation:
- `requirements.md` — functional and non-functional requirements
- `design.md` — DB schema, API routes, component tree, LLM prompt design
- `aws-architecture.md` — AWS reference architecture with service rationale
- `tasks.md` — implementation task breakdown
