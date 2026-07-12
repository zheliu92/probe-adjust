# Probe-Adjust: Implementation Task Breakdown

## Implementation Phases

```
Phase 0: Project Scaffolding
Phase 1: Backend Foundation (DB + API)
Phase 2: Study Design Canvas
Phase 3: Participant Workspace + File Management
Phase 4: LLM Analysis Engine
Phase 5: Protocol Editor + Interaction Logging
Phase 6: Mock Data + End-to-End Polish
```

Each task is sized as S (< 2h), M (2–4h), L (4–8h).

---

## Phase 0: Project Scaffolding

### Task 0.1 — Backend project setup `[S]`
- Create `backend/` directory structure per design doc section 10
- Initialize Python virtual environment (`python -m venv .venv`)
- Create `requirements.txt` with pinned versions:
  - `fastapi==0.111.0`, `uvicorn[standard]==0.30.1`
  - `sqlalchemy==2.0.30`, `alembic==1.13.1`
  - `pydantic==2.7.1`, `python-dotenv==1.0.1`
  - `openai==1.35.3`, `python-multipart==0.0.9`, `aiofiles==23.2.1`
- Create `.env.example` with all required variables: `DATABASE_URL`, `UPLOAD_DIR`, `LOG_DIR`, `OPENAI_API_KEY`, `STORAGE_BACKEND`
- Create `main.py` with FastAPI app, CORS middleware, router mounts
- Verify `uvicorn main:app --reload` starts without error

### Task 0.2 — Frontend project setup `[S]`
- Scaffold with `npm create vite@latest frontend -- --template react-ts`
- Install pinned dependencies:
  - `@dnd-kit/core@6.1.0`, `@dnd-kit/sortable@8.0.0`, `@dnd-kit/utilities@3.2.2`
  - `zustand@4.5.2`, `axios@1.7.2`
  - `@tiptap/react@2.4.0`, `@tiptap/starter-kit@2.4.0`, `@tiptap/pm@2.4.0`
  - `react-router-dom@6.23.1`
  - `tailwindcss@3.4.4`, `postcss@8.4.38`, `autoprefixer@10.4.19`
- Configure Tailwind (`tailwind.config.js`, `postcss.config.js`)
- Configure Vite proxy: `'/api' → 'http://localhost:8000'`
- Verify `npm run dev` starts and loads a blank page

### Task 0.3 — Database setup `[S]`
- Create `models/database.py`: SQLAlchemy engine from `DATABASE_URL` env var (defaults to `sqlite:///./probe_adjust.db`), session factory, `Base`
- Create `models/orm.py`: all 9 ORM classes matching design doc schema (Study, Block, DataSlot, Annotation, StudyParticipant, ParticipantDataFile, AnalysisRequest, Finding, Citation, Suggestion)
- Create `models/schemas.py`: Pydantic v2 models for all request/response shapes
- Call `Base.metadata.create_all(engine)` on startup (skip Alembic for prototype simplicity)
- Verify tables created by inspecting the SQLite file

### Task 0.4 — Storage abstraction `[S]`
- Implement `storage/base.py` abstract `StorageBackend`
- Implement `storage/local.py`: `LocalStorageBackend` with `save_file`, `read_file`, `delete_file`, `file_exists`
- Implement `storage/s3.py`: stub raising `NotImplementedError("Set STORAGE_BACKEND=local for prototype")`
- Wire `get_storage()` factory function to `STORAGE_BACKEND` env var
- Create `uploads/.gitkeep` and `logs/.gitkeep`

---

## Phase 1: Backend Foundation

### Task 1.1 — Studies API `[S]`
- Implement `api/routes/studies.py`
- Endpoints: `GET /studies`, `POST /studies`, `GET /studies/{id}`, `PUT /studies/{id}`, `DELETE /studies/{id}`
- `GET /studies/{id}` returns study with all blocks, slots, and annotations nested
- Write basic smoke tests with `httpx` test client

### Task 1.2 — Blocks API `[S]`
- Implement `api/routes/blocks.py`
- Endpoints: `GET /studies/{id}/blocks`, `POST /studies/{id}/blocks`, `PUT /blocks/{id}`, `DELETE /blocks/{id}`
- Implement `POST /studies/{id}/blocks/reorder` — accepts ordered list of block IDs, updates all positions in a single transaction

### Task 1.3 — Data Slots API `[M]`
- Implement `api/routes/slots.py`
- Endpoints: `POST /blocks/{id}/slots`, `PUT /slots/{id}`, `DELETE /slots/{id}`
- `POST /slots/{id}/template` — accepts file upload, saves via storage backend, stores path in DB
- `GET /slots/{id}/template` — returns file content via storage backend
- `POST /slots/{id}/annotation` — upsert annotation on slot
- `DELETE /slots/{id}/annotation`

### Task 1.4 — Participants API `[S]`
- Implement `api/routes/participants.py`
- `POST /studies/{id}/participants` — creates profile; finds the study's interview-protocol template slot (Feedback block, template slot_kind, name contains "interview" or "protocol"); copies template file content into `protocol_content`; if none found, sets `protocol_content` to empty string
- `GET /studies/{id}/participants`, `GET /participants/{id}` (with nested files), `DELETE /participants/{id}`

### Task 1.5 — Files API `[M]`
- Implement `api/routes/files.py`
- `POST /participants/{id}/files` — multipart upload; saves file via storage backend; requires `slot_id` in form data
- `GET /files/{id}/content` — reads file, line-numbers it, returns as JSON: `{lines: [{n: 1, text: "..."}, ...]}`
- `PUT /files/{id}` — update `custom_prompt` or `included_in_analysis`
- `DELETE /files/{id}` — remove from DB and storage

### Task 1.6 — Protocol API `[S]`
- Implement `api/routes/protocol.py`
- `GET /participants/{id}/protocol` — returns `{content: string, updated_at: datetime}`
- `PUT /participants/{id}/protocol` — save new content; compute line-level diff and emit to log service; update timestamp

---

## Phase 2: Study Design Canvas (Stage 1)

### Task 2.1 — Session Entry page `[S]`
- `SessionEntryPage.tsx` at route `/`
- Clean centered layout; Participant ID text input
- "Enter" button: saves participant ID to session store, logs `session_start`, navigates to `/studies/default/design`
- The app uses a single pre-seeded study (no study list needed for prototype)

### Task 2.2 — Canvas block rendering `[M]`
- `StudyDesignPage.tsx` at route `/studies/:studyId/design`
- `StudyCanvas.tsx` — `@dnd-kit/sortable` list of `BlockCard` components
- `BlockCard.tsx` — type icon (Plain = minus circle, Experience = bolt, Feedback = chat bubble), inline-editable label
- Drag handle on left edge; drop target highlight on hover
- On drag end: POST reorder to API; optimistic local update

### Task 2.3 — Block add / delete `[S]`
- Toolbar above canvas: three "Add" buttons, one per block type with icon + label
- New block appended at end via POST; immediately editable label
- Delete button on each card (confirm dialog before DELETE call)
- **"Begin Study Conduct" button** at top-right of page → navigates to `/studies/:studyId/conduct`

### Task 2.4 — Slot badge visual encoding `[S]`
- `SlotBadge.tsx`: pill with shape (circle = qualitative, rounded-none = quantitative) and color (amber = subjective, blue = objective)
- Rendered in a wrapped row inside each BlockCard
- Tooltip on hover: slot name, data type, data nature, slot kind (template/data)

### Task 2.5 — Slot detail panel `[M]`
- `SlotDetailPanel.tsx` — slides in from right when a slot badge is clicked
- Fields: name input, data type radio, data nature radio, slot kind toggle
- Template upload section (shown when slot kind = template): file picker, upload to `POST /slots/{id}/template`, shows filename + "Preview" link
- Annotation textarea, saves on blur via `POST /slots/{id}/annotation`
- "Add slot" button in each BlockCard footer; "Remove slot" button in panel

### Task 2.6 — Participant sidebar `[S]`
- Right sidebar on StudyDesignPage listing study participants
- "Add participant" → label input → POST → participant appears in list
- Click participant → navigates to `/studies/:studyId/conduct` with that participant pre-selected
- Study store: `fetchStudy`, `reorderBlocks`, `addBlock`, `deleteBlock`, `updateBlockLabel`

## Phase 3: Participant Workspace (Stage 2)

### Task 3.1 — Transition screen `[S]`
- `TransitionPage.tsx` at route `/studies/:studyId/conduct`
- Three mode cards (Findings / Suggestions / Baseline) with description text
- Participant selector dropdown (fetches `GET /studies/{id}/participants`)
- "Start" button: saves mode + study participant ID to session store, logs `stage2_start`, navigates to workspace

### Task 3.2 — Workspace layout `[M]`
- `ParticipantWorkspacePage.tsx` at route `/studies/:studyId/participants/:pid`
- Three-column layout (left 30% / center 40% / right 30%)
- Mode badge in header; "← Back to Design" link (goes to Stage 1 canvas)
- Workspace store: `fetchWorkspace` loads participant + files + analysis requests on mount

### Task 3.3 — Compact canvas panel (left) `[M]`
- `CompactCanvasPanel.tsx` — read-only version of the study canvas
- Each block rendered as a compact card with label + type icon
- Each slot rendered as a row showing: slot badge, slot name, upload status (empty / template / uploaded)
- Clicking a data-placeholder slot row opens the upload interface (file picker inline)
- Clicking a template slot row opens the FileViewerModal for the template file
- Clicking an uploaded data file opens FileViewerModal

### Task 3.4 — File upload from compact canvas `[M]`
- Inline file picker per slot row in compact canvas
- Accepts `.txt`, `.json`; client-side type validation with inline error
- On upload success: slot row shows filename + timestamp, upload button becomes "Replace"
- `POST /participants/{id}/files` with `slot_id` in form data

### Task 3.5 — In-app file viewer `[M]`
- `FileViewerModal.tsx` — full-screen modal overlay with close button
- `TextViewer.tsx` — renders `.txt` with line numbers; `highlightLine` prop scrolls to + highlights that line
- `JsonViewer.tsx` — pretty-prints JSON with line numbers; same highlight behavior
- Opened from: slot rows (no highlight), citation links (with highlight)
- `file_opened` event logged (context: `'direct'` or `'citation'`)

---

## Phase 4: LLM Analysis Engine

### Task 4.1 — Analysis service with async queue `[L]`
- `services/analysis_service.py`
- In-memory queue (asyncio `Queue`) processed by a background worker started on app startup
- `enqueue_analysis_request(request_id)` — adds to queue, returns immediately
- Worker loop: dequeues request ID, fetches from DB, sets status to `analyzing`, runs LLM call, saves results, sets status to `complete` (or `error`)
- `run_llm_call(request)` — fetches files, parses + line-numbers content, fetches annotations, assembles prompt per design doc section 6.1, calls OpenAI with `response_format={"type": "json_object"}`, parses `FindingsResponse`, persists findings/citations/suggestions
- Mock fallback: if `OPENAI_API_KEY` is unset or `"placeholder"`, return realistic mock response (3 findings, 2 suggestions)

### Task 4.2 — Analysis API endpoints `[S]`
- `POST /participants/{id}/analysis/requests` — creates `AnalysisRequest` row (status=`queued`), enqueues it, returns `{id, status: "queued"}`
- `GET /participants/{id}/analysis/requests` — returns all requests ordered by position, each with nested findings, citations, suggestions
- `GET /analysis/requests/{request_id}` — single request with full nested data; used for polling
- `DELETE /analysis/requests/{request_id}` — removes request and all nested data

### Task 4.3 — Analysis request form (frontend) `[M]`
- `AnalysisRequestForm.tsx` in the analysis panel (top of center panel)
- Label text input; collapsible file selector (checkboxes for each uploaded file, showing slot badge); optional top-level custom prompt textarea
- "Analyze" button: submits `POST`, appends a new `AnalysisResultBlock` with status "queued"
- Hidden in baseline mode

### Task 4.4 — Analysis result blocks with polling `[M]`
- `AnalysisResultBlock.tsx` — one block per submitted request
- Header: label, status badge (queued=gray, analyzing=blue pulsing, complete=green, error=red), timestamp
- When status is `queued` or `analyzing`: polls `GET /analysis/requests/{id}` every 3 seconds
- When `complete`: renders `FindingCard[]` and (in suggestions mode) `SuggestionCard[]`
- `FindingCard`: title, explanation, tension type badge, `CitationLink[]`
- `CitationLink`: clickable pill → opens `FileViewerModal` with highlight; logs `citation_clicked`
- `SuggestionCard`: description, optional protocol reference hint; logs `suggestion_viewed` on expand
- When `error`: shows error message with "Retry" button

### Task 4.5 — Mock analysis data `[S]`
- Hard-coded mock `FindingsResponse` in `analysis_service.py` for when API key is placeholder
- 3 findings: one contradiction (log struggle + high rating), one convergence (transcript + survey agree on feature preference), one anomaly (unexpected rating spike)
- 2 suggestions (only returned in suggestions mode): add follow-up about trust, note to probe feature preference further
- Citations reference actual line numbers in the mock data files so highlighting works end-to-end

---

## Phase 5: Protocol Editor + Interaction Logging

### Task 5.1 — Protocol editor `[M]`
- `ProtocolEditorPanel.tsx` — TipTap editor configured with `StarterKit`
- Initialize with participant's `protocol_content` on mount
- Debounced autosave (2s after last keystroke) calls `PUT /participants/{id}/protocol`
- Visual autosave indicator ("Saving…" → "Saved" with timestamp)
- Editor accessible in all three modes

### Task 5.2 — Protocol diff logging `[M]`
- In `api/routes/protocol.py` PUT handler: compare new content against previous content
- Compute line-level diff using Python `difflib.unified_diff`
- If content changed, append `protocol_edit` event to JSONL log with before/after diff strings
- Diff should be compact: only changed lines plus 1 line of context

### Task 5.3 — Frontend interaction logging `[M]`
- `api/log.ts` — `logEvent(type, payload)` function; POST to `/api/log`
- Axios request interceptor: attach `X-Session-ID` header (participant ID + session timestamp) to every request so backend can route to correct JSONL file
- Instrument all logging callsites:
  - Session entry: `session_start`
  - File open: `file_opened`
  - Finding expand: `finding_viewed`
  - Citation click: `citation_clicked`
  - Suggestion expand: `suggestion_viewed`
  - Analysis button click: `analysis_triggered`
  - Source toggle: `source_toggled`
  - Browser `beforeunload`: `session_end` (best-effort via `navigator.sendBeacon`)

### Task 5.4 — Log API endpoint `[S]`
- `POST /api/log` — receives event, extracts session file path from `X-Session-ID` header
- Appends JSON line to `logs/session_{pid}_{ts}.jsonl`
- Creates log file on first event if not exists
- Returns `{"ok": true}` always (no error should block the researcher's workflow)

---

## Phase 6: Mock Data + Polish

### Task 6.1 — Mock data package `[M]`
- Create `mock-data/simulated-study/` directory
- Design a plausible 2-condition HCI study scenario (e.g., comparing two UI designs for a smart home controller)
- Create study plan JSON: 7 blocks (Introduction, Demographic Survey, Baseline Survey, Condition A, Post-Condition Survey A, Condition B, Post-Condition Survey B, Post-Experience Interview)
- For 2 participants (P1, P2), create:
  - `system_log.json` — structured JSON with timestamped events, task completion flags, error events
  - `think_aloud.txt` — line-numbered transcript with natural language observations
  - `survey_responses.txt` — formatted survey responses with question numbers
  - `observation_notes.txt` — researcher field notes
- Ensure P1 data contains a clear contradiction (struggled in log but rated highly in survey) to validate analysis
- Ensure P2 data contains a clear convergence (multiple sources agree on a preference)
- Create interview protocol template `interview_protocol.txt` with 8–10 questions

### Task 6.2 — Seed script `[S]`
- `backend/seed.py` — reads mock data package and populates DB + storage with the full simulated study
- Idempotent: running twice does not duplicate data
- Documents in README how to run: `python seed.py`

### Task 6.3 — Session Entry page polish `[S]`
- Clean, centered layout on `/`
- Participant ID text input with label
- Three mode selection cards (Findings / Suggestions / Baseline), each with a short description of what the researcher will see
- Baseline card clearly labeled "No AI Assistance"
- Enter button navigates to study list, logs `session_start`

### Task 6.4 — Error states and loading `[S]`
- Loading spinners for all async operations (fetch study, fetch participant, trigger analysis)
- Empty states for: no studies, no participants, no data files uploaded, analysis not yet run
- Error toast notifications for failed API calls
- File upload error messages for unsupported formats or oversized files

### Task 6.5 — README and setup instructions `[S]`
- Update root `README.md` with:
  - Project description
  - Prerequisites (Python 3.11+, Node 18+)
  - Setup instructions (backend + frontend)
  - How to configure `.env`
  - How to run the seed script
  - How to start the dev servers
  - Where to find the interaction logs after a session

---

## Dependency Order

```
Phase 0 (all tasks) 
  → Phase 1.1–1.6 (backend APIs, sequential)
  → Phase 2.1–2.6 (canvas, can overlap with Phase 1)
  → Phase 3.1–3.5 (workspace, needs Phase 1 complete)
  → Phase 4.1–4.5 (analysis, needs Phase 3 complete)
  → Phase 5.1–5.4 (protocol + logging, can overlap with Phase 4)
  → Phase 6.1–6.5 (polish, after all core features complete)
```

## Estimated Total Effort

| Phase | Tasks | Estimated Hours |
|---|---|---|
| Phase 0: Scaffolding | 4 | 4–5h |
| Phase 1: Backend Foundation | 6 | 8–10h |
| Phase 2: Study Design Canvas | 6 | 10–12h |
| Phase 3: Participant Workspace | 5 | 10–12h |
| Phase 4: LLM Analysis Engine | 5 | 10–14h |
| Phase 5: Protocol Editor + Logging | 4 | 6–8h |
| Phase 6: Mock Data + Polish | 5 | 6–8h |
| **Total** | **35** | **54–69h** |
