# Probe-Adjust: Design Document

## 1. System Architecture Overview

Probe-Adjust is a single-user-at-a-time local web application with a clear client-server separation designed for future cloud portability.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Session     │  │  Study       │  │  Participant          │  │
│  │  Entry       │  │  Design      │  │  Workspace            │  │
│  │  (Mode +     │  │  Canvas      │  │  (Data / Analysis /   │  │
│  │   PID)       │  │              │  │   Protocol Editor)    │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / JSON  (HTTP over localhost)
┌────────────────────────────▼────────────────────────────────────┐
│                     FastAPI Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Study &     │  │  File        │  │  Analysis             │  │
│  │  Participant │  │  Storage     │  │  Engine               │  │
│  │  Router      │  │  Layer       │  │  (LLM Orchestrator)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                 │                      │               │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────────▼────────────┐  │
│  │  SQLAlchemy  │  │  Storage     │  │  OpenAI SDK           │  │
│  │  ORM         │  │  Abstraction │  │  (GPT-4o)             │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘  │
│         │                 │                                      │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────────────────────┐  │
│  │  SQLite DB   │  │  /uploads    │  │  /logs  (JSONL)       │  │
│  │  (local)     │  │  (local fs)  │  │  (interaction logs)   │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript | Component model fits the block-based canvas; TypeScript prevents data model mismatches across complex state |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Lightweight, accessible, no jQuery dependency; well-maintained |
| Frontend state | Zustand | Lighter than Redux for this scale; straightforward async actions for API calls |
| Styling | Tailwind CSS | Utility-first, easy to customize the visual encoding (colors, shapes) without a full design system |
| Rich text editor | TipTap | Headless, extensible ProseMirror-based editor; supports paragraph-level diffing for interaction logging |
| HTTP client | Axios | Standard, interceptor support for logging |
| Backend | Python 3.11 + FastAPI | Async-ready, automatic OpenAPI docs, easy LLM SDK integration, cloud-portable |
| ORM | SQLAlchemy 2.0 | Supports SQLite locally and PostgreSQL on cloud with only a connection string change |
| Database | SQLite | Zero setup for local; file-based, easy to back up |
| File storage | Local filesystem via abstraction layer | Abstracted behind a `StorageBackend` interface; swap to S3 by changing the env var |
| LLM | OpenAI GPT-4o via `openai` Python SDK | 128k context window fits direct-send approach; structured output mode for reliable JSON responses |
| Interaction logs | JSONL files on local filesystem | Easy to export and analyze externally; no query overhead for append-only data |
| Environment config | `python-dotenv` | Standard `.env` file management |

---

## 3. Database Schema

### 3.1 Entity Relationship Overview

```
Study ──< Block ──< DataSlot ──< Annotation
  │
  └──< StudyParticipant ──< ParticipantDataFile
            │
            ├── protocol_content (TEXT, copy of interview protocol template)
            └──< AnalysisResult ──< Finding ──< Citation
                                 └──< Suggestion
```

### 3.2 Table Definitions

```sql
-- The top-level study container
CREATE TABLE study (
    id          TEXT PRIMARY KEY,  -- UUID
    title       TEXT NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blocks on the study design canvas
CREATE TABLE block (
    id          TEXT PRIMARY KEY,
    study_id    TEXT NOT NULL REFERENCES study(id),
    type        TEXT NOT NULL CHECK(type IN ('plain', 'experience', 'feedback')),
    label       TEXT NOT NULL,
    position    INTEGER NOT NULL,  -- order on the canvas, 0-indexed
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Data source / template slots defined on a block (study-level, no participant data)
CREATE TABLE data_slot (
    id              TEXT PRIMARY KEY,
    block_id        TEXT NOT NULL REFERENCES block(id),
    name            TEXT NOT NULL,          -- e.g., "System Log", "Post-Task Survey"
    data_type       TEXT NOT NULL CHECK(data_type IN ('qualitative', 'quantitative')),
    data_nature     TEXT NOT NULL CHECK(data_nature IN ('subjective', 'objective')),
    slot_kind       TEXT NOT NULL CHECK(slot_kind IN ('template', 'data')),
    -- 'template': uploaded at study-design time, same for all participants
    -- 'data': placeholder for per-participant uploads
    template_file_path  TEXT,   -- populated if slot_kind = 'template'
    template_file_name  TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Researcher annotations on a data slot (used as AI context)
CREATE TABLE annotation (
    id          TEXT PRIMARY KEY,
    slot_id     TEXT NOT NULL REFERENCES data_slot(id),
    content     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- A study participant whose data will be analyzed
CREATE TABLE study_participant (
    id                  TEXT PRIMARY KEY,
    study_id            TEXT NOT NULL REFERENCES study(id),
    label               TEXT NOT NULL,   -- e.g., "P1", "Participant 1"
    protocol_content    TEXT,            -- copy of interview protocol, editable per participant
    protocol_updated_at DATETIME,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-participant uploaded data files, mapped to a data_slot placeholder
CREATE TABLE participant_data_file (
    id                  TEXT PRIMARY KEY,
    participant_id      TEXT NOT NULL REFERENCES study_participant(id),
    slot_id             TEXT NOT NULL REFERENCES data_slot(id),
    file_name           TEXT NOT NULL,
    file_path           TEXT NOT NULL,   -- relative path within storage backend
    custom_prompt       TEXT,            -- optional per-file analysis focus prompt
    included_in_analysis BOOLEAN DEFAULT TRUE,
    uploaded_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One analysis run per participant (most recent is shown; history kept)
CREATE TABLE analysis_request (
    id              TEXT PRIMARY KEY,
    participant_id  TEXT NOT NULL REFERENCES study_participant(id),
    label           TEXT NOT NULL,   -- researcher-defined name, e.g., "Trust alignment check"
    mode            TEXT NOT NULL CHECK(mode IN ('findings', 'suggestions')),
    status          TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'analyzing', 'complete', 'error')),
    sources_used    TEXT NOT NULL,   -- JSON array of participant_data_file IDs
    custom_prompt   TEXT,            -- optional top-level prompt for this request
    raw_llm_response TEXT,
    error_message   TEXT,
    position        INTEGER NOT NULL, -- display order in panel
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME
);

-- Individual findings from an analysis request
CREATE TABLE finding (
    id                   TEXT PRIMARY KEY,
    analysis_request_id  TEXT NOT NULL REFERENCES analysis_request(id),
    position             INTEGER NOT NULL,
    title                TEXT NOT NULL,
    explanation          TEXT NOT NULL,
    tension_type         TEXT CHECK(tension_type IN ('contradiction', 'convergence', 'anomaly'))
);

-- Citations linking a finding to source locations
CREATE TABLE citation (
    id          TEXT PRIMARY KEY,
    finding_id  TEXT NOT NULL REFERENCES finding(id),
    file_id     TEXT NOT NULL REFERENCES participant_data_file(id),
    display_ref TEXT NOT NULL,
    location    TEXT NOT NULL    -- JSON: {"type": "line", "value": 42}
);

-- Suggestions (only in suggestions mode analysis requests)
CREATE TABLE suggestion (
    id                   TEXT PRIMARY KEY,
    analysis_request_id  TEXT NOT NULL REFERENCES analysis_request(id),
    finding_id           TEXT REFERENCES finding(id),
    position             INTEGER NOT NULL,
    description          TEXT NOT NULL,
    protocol_ref         TEXT
);
```

---

## 4. API Design

Base URL (local): `http://localhost:8000/api`

### 4.1 Studies

| Method | Path | Description |
|---|---|---|
| `GET` | `/studies` | List all studies |
| `POST` | `/studies` | Create a new study |
| `GET` | `/studies/{id}` | Get study with all blocks and slots |
| `PUT` | `/studies/{id}` | Update study metadata |
| `DELETE` | `/studies/{id}` | Delete study |

### 4.2 Blocks

| Method | Path | Description |
|---|---|---|
| `GET` | `/studies/{id}/blocks` | List blocks ordered by position |
| `POST` | `/studies/{id}/blocks` | Add a new block |
| `PUT` | `/blocks/{id}` | Update block label or type |
| `DELETE` | `/blocks/{id}` | Delete block |
| `POST` | `/studies/{id}/blocks/reorder` | Update positions of all blocks (bulk reorder) |

### 4.3 Data Slots

| Method | Path | Description |
|---|---|---|
| `POST` | `/blocks/{id}/slots` | Add a data slot to a block |
| `PUT` | `/slots/{id}` | Update slot metadata |
| `DELETE` | `/slots/{id}` | Delete slot |
| `POST` | `/slots/{id}/template` | Upload a template file to a slot |
| `GET` | `/slots/{id}/template` | Download/view template file |

### 4.4 Annotations

| Method | Path | Description |
|---|---|---|
| `POST` | `/slots/{id}/annotation` | Create or update annotation on a slot |
| `DELETE` | `/slots/{id}/annotation` | Remove annotation |

### 4.5 Study Participants

| Method | Path | Description |
|---|---|---|
| `GET` | `/studies/{id}/participants` | List study participants |
| `POST` | `/studies/{id}/participants` | Create a new study participant profile |
| `GET` | `/participants/{id}` | Get participant profile with files |
| `DELETE` | `/participants/{id}` | Delete participant profile |

### 4.6 Participant Data Files

| Method | Path | Description |
|---|---|---|
| `POST` | `/participants/{id}/files` | Upload a data file to a slot |
| `GET` | `/files/{id}` | Get file metadata |
| `GET` | `/files/{id}/content` | Get file content (for viewer) |
| `PUT` | `/files/{id}` | Update custom prompt or inclusion flag |
| `DELETE` | `/files/{id}` | Delete file |

### 4.7 Protocol

| Method | Path | Description |
|---|---|---|
| `GET` | `/participants/{id}/protocol` | Get current protocol content |
| `PUT` | `/participants/{id}/protocol` | Autosave protocol content (with diff logging) |

### 4.8 Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/participants/{id}/analysis/requests` | Submit a new analysis request; body: `{label, mode, file_ids, custom_prompt}`; returns request ID with status `queued` |
| `GET` | `/participants/{id}/analysis/requests` | List all analysis requests for participant, ordered by position |
| `GET` | `/analysis/requests/{request_id}` | Get single request with status, findings, citations, suggestions |
| `DELETE` | `/analysis/requests/{request_id}` | Remove a request and its results |

### 4.9 Interaction Logging

| Method | Path | Description |
|---|---|---|
| `POST` | `/log` | Append a log event; body: `{event_type, payload}` — writes to JSONL file |

---

## 5. Frontend Architecture

### 5.1 Page Structure

```
App
├── SessionEntryPage          (route: /)
│     └── ParticipantIdInput
│
├── StudyDesignPage           (route: /studies/:studyId/design)   ← Stage 1
│     ├── CanvasToolbar       (add block controls)
│     ├── StudyCanvas         (dnd-kit sortable list)
│     │     └── BlockCard[]
│     │           ├── BlockHeader  (type icon, label editor)
│     │           └── SlotList
│     │                 └── SlotBadge[]  (shape + color visual encoding)
│     ├── SlotDetailPanel     (right panel: annotation editor, template upload)
│     ├── ParticipantSidebar  (list of study participants, add/select)
│     └── BeginStudyConductButton → TransitionScreen
│
├── TransitionScreen          (route: /studies/:studyId/conduct)  ← Stage transition
│     ├── ModeSelector        (three cards: Findings / Suggestions / Baseline)
│     └── ParticipantSelector (list of study participant profiles)
│
└── ParticipantWorkspacePage  (route: /studies/:studyId/participants/:pid)  ← Stage 2
      ├── WorkspaceHeader     (participant label, mode badge, "Back to Design" link)
      ├── CompactCanvasPanel  (left panel — read-only canvas with upload slots)
      │     └── CompactBlockCard[]
      │           └── SlotUploadRow[]  (badge + upload state + open/upload button)
      ├── AnalysisPanel       (center panel; hidden in baseline)
      │     ├── AnalysisRequestForm   (label input, source selector, prompt, submit)
      │     └── AnalysisResultBlock[] (one per completed request, newest at bottom)
      │           ├── RequestHeader   (label, status badge, timestamp)
      │           ├── FindingCard[]
      │           │     └── CitationLink[]
      │           └── SuggestionCard[] (suggestions mode only)
      └── ProtocolEditorPanel (right panel)
            └── TipTap editor (autosave, all modes)

FileViewerModal               (overlay, opened from citation links or slot rows)
      └── TextViewer / JsonViewer  (with highlight support)
```

### 5.2 State Management (Zustand Stores)

```typescript
// Session store — persisted in sessionStorage
interface SessionStore {
  participantId: string;        // system user's ID for logging
  mode: 'findings' | 'suggestions' | 'baseline' | null;  // set at stage transition
  studyParticipantId: string | null;  // selected simulated participant
  sessionStartTs: string;       // ISO timestamp, used as log file key
  setParticipantId: (id: string) => void;
  setStage2: (mode: Mode, studyParticipantId: string) => void;
}

// Study store
interface StudyStore {
  currentStudy: Study | null;
  blocks: Block[];
  fetchStudy: (id: string) => Promise<void>;
  reorderBlocks: (newOrder: string[]) => Promise<void>;
  addBlock: (type: BlockType, label: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  updateBlockLabel: (id: string, label: string) => Promise<void>;
}

// Participant workspace store
interface WorkspaceStore {
  participant: StudyParticipant | null;
  files: ParticipantDataFile[];
  analysisRequests: AnalysisRequest[];   // all requests for this participant
  protocolContent: string;
  fetchWorkspace: (participantId: string) => Promise<void>;
  submitAnalysisRequest: (label: string, fileIds: string[], customPrompt?: string) => Promise<void>;
  pollAnalysisStatus: () => void;        // polls /analysis/requests until all complete
  saveProtocol: (content: string) => Promise<void>;
}

// Analysis request state (frontend model)
interface AnalysisRequest {
  id: string;
  label: string;
  status: 'queued' | 'analyzing' | 'complete' | 'error';
  findings: Finding[];
  suggestions: Suggestion[];
  createdAt: string;
}
```

### 5.3 Visual Encoding Implementation

```typescript
// Data type shapes (CSS classes / SVG icons)
const SHAPE_MAP = {
  qualitative:  'rounded-full',   // circle badge
  quantitative: 'rounded-sm',     // square badge
};

// Data nature colors (Tailwind)
const COLOR_MAP = {
  subjective: 'bg-amber-400 text-amber-900',   // warm
  objective:  'bg-blue-400 text-blue-900',      // cool
};

// Combined badge component
<SlotBadge
  dataType="qualitative"      // → circle
  dataNature="subjective"     // → amber
  label="Think-aloud"
/>
```

---

## 6. LLM Integration Design

### 6.1 Prompt Structure

The analysis engine constructs a structured prompt payload before each LLM call:

```
SYSTEM PROMPT
─────────────
You are an expert qualitative research assistant helping researchers 
analyze experience data from mixed-methods studies.

Your task is to analyze the provided data sources and identify 
"interviewable tensions" — observations that would be valuable to 
probe in a follow-up interview.

An interviewable tension is one of:
- Contradiction: conflicting signals across data sources
- Convergence: strong agreement across multiple sources on a notable theme  
- Anomaly: a data point that stands out unexpectedly

For each tension found, you must provide:
- title: short descriptive title
- explanation: 1-2 sentences explaining why this is notable
- tension_type: "contradiction" | "convergence" | "anomaly"
- citations: list of {source_name, display_ref, location} objects

[IF SUGGESTIONS MODE]:
Additionally, for each finding, suggest a protocol adjustment:
- description: what to change or add in the interview protocol
- protocol_ref: hint at where in the protocol this applies (optional)

Return ONLY valid JSON matching the provided schema. No prose outside JSON.

USER PROMPT
───────────
## Study Context
{study_title}
{study_description}

## Researcher Annotations
{all annotations from included data slots, labeled by slot name}

## Data Sources
[For each included file:]
### {slot_name} ({data_type}, {data_nature})
{custom_prompt if provided}
---
{file_content}

## Output Schema
{json_schema for FindingsResponse}
```

### 6.2 Response Schema

```typescript
interface FindingsResponse {
  findings: Finding[];
  suggestions?: Suggestion[];  // only present in suggestions mode
}

interface Finding {
  title: string;
  explanation: string;
  tension_type: 'contradiction' | 'convergence' | 'anomaly';
  citations: Citation[];
}

interface Citation {
  source_name: string;    // matches slot name
  display_ref: string;    // e.g., "Survey Q3", "Log T=2:34"
  location: {
    type: 'line' | 'key' | 'paragraph';
    value: string | number;
  };
}

interface Suggestion {
  description: string;
  related_finding_index?: number;  // 0-indexed reference to findings[]
  protocol_ref?: string;
}
```

### 6.3 File Parsing Before Sending

Before injecting into the prompt, files are parsed and normalized:

```python
def prepare_file_content(file_path: str, file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    if ext == '.json':
        with open(file_path) as f:
            data = json.load(f)
        # Re-serialize with line numbers for citation support
        lines = json.dumps(data, indent=2).splitlines()
        return '\n'.join(f'L{i+1}: {line}' for i, line in enumerate(lines))
    elif ext in ('.txt', '.md'):
        with open(file_path) as f:
            lines = f.readlines()
        return '\n'.join(f'L{i+1}: {line.rstrip()}' for i, line in enumerate(lines))
    else:
        raise ValueError(f'Unsupported file type: {ext}')
```

Line-numbering the content is critical: it allows the LLM to cite `L42` and the viewer to scroll to that line.

---

## 7. Storage Abstraction Layer

```python
# storage/base.py
from abc import ABC, abstractmethod

class StorageBackend(ABC):
    @abstractmethod
    def save_file(self, relative_path: str, content: bytes) -> str: ...
    
    @abstractmethod
    def read_file(self, relative_path: str) -> bytes: ...
    
    @abstractmethod
    def delete_file(self, relative_path: str) -> None: ...
    
    @abstractmethod
    def get_url(self, relative_path: str) -> str: ...

# storage/local.py
class LocalStorageBackend(StorageBackend):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
    
    def save_file(self, relative_path: str, content: bytes) -> str:
        full_path = self.base_path / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        return relative_path

# storage/s3.py  (future)
class S3StorageBackend(StorageBackend):
    # Swap-in for cloud deployment
    ...

# Instantiated via config
def get_storage() -> StorageBackend:
    if os.getenv('STORAGE_BACKEND') == 's3':
        return S3StorageBackend(bucket=os.getenv('S3_BUCKET'))
    return LocalStorageBackend(base_path=os.getenv('UPLOAD_DIR', './uploads'))
```

---

## 8. Interaction Log Design

### 8.1 Log File Structure

```
/logs/
  session_P1_20240901T143022.jsonl
  session_P2_20240901T160045.jsonl
```

Each line in a JSONL file is one event:

```json
{"event": "session_start", "participant_id": "P1", "mode": "findings", "ts": "2024-09-01T14:30:22Z"}
{"event": "file_opened", "file_id": "abc123", "file_name": "system_log.json", "context": "direct", "ts": "2024-09-01T14:31:05Z"}
{"event": "analysis_triggered", "sources_included": ["abc123", "def456"], "sources_excluded": [], "custom_prompts": {"abc123": "focus on error moments"}, "ts": "2024-09-01T14:32:10Z"}
{"event": "finding_viewed", "finding_id": "f001", "finding_title": "High rating despite task failure", "ts": "2024-09-01T14:33:01Z"}
{"event": "citation_clicked", "finding_id": "f001", "citation_ref": "Log L42", "ts": "2024-09-01T14:33:08Z"}
{"event": "protocol_edit", "before": "- Ask about trust\n", "after": "- Ask about trust\n- Follow up: did the error affect trust?\n", "ts": "2024-09-01T14:35:20Z"}
{"event": "session_end", "duration_seconds": 1820, "ts": "2024-09-01T15:00:42Z"}
```

### 8.2 Log API Backend

The `/api/log` endpoint is a simple append-only writer:

```python
@router.post('/log')
async def append_log_event(event: LogEvent, session_file: str = Depends(get_session_log_file)):
    with open(session_file, 'a') as f:
        f.write(json.dumps({**event.dict(), 'ts': datetime.utcnow().isoformat() + 'Z'}) + '\n')
    return {'ok': True}
```

The session log file path is derived from the participant ID and session start timestamp, passed as a header or query param from the frontend.

---

## 9. Key UX Flows

### 9.1 Stage 1 — Study Plan Flow
1. System user opens app → enters Participant ID → lands on Study Design Canvas (Stage 1)
2. Canvas is pre-populated with the mock study plan blocks and slots
3. System user edits blocks (drag to reorder, rename, add/delete), adds/edits slots
4. Uploads template files to template slots; adds annotations
5. Creates study participant profiles in the sidebar; each auto-copies the interview protocol template
6. When ready, clicks **"Begin Study Conduct"** → transition screen

### 9.2 Stage Transition
1. Transition screen presents: mode selector (three cards with descriptions) + simulated participant selector
2. System user selects mode and simulated participant → clicks "Start"
3. `stage2_start` event logged; system user enters Stage 2 workspace

### 9.3 Stage 2 — Participant Analysis Flow
1. Workspace loads: left = compact canvas with slot upload states, center = analysis panel (or hidden), right = protocol editor
2. System user uploads data files by clicking slots on the compact canvas
3. System user creates an **analysis request**: gives it a label, selects data sources, optionally adds a custom prompt, submits
4. Request enters queue; status shows "queued" → "analyzing"
5. When complete, findings block appears in analysis panel; system user reads findings, clicks citations
6. System user submits additional analysis requests as needed; each appears as a new block below
7. System user edits protocol in right panel using findings/suggestions as reference
8. All actions logged to JSONL

---

## 10. Directory Structure

```
probe-adjust/
├── .env.example                  # Environment variable template
├── .gitignore
├── README.md
│
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env                      # Local secrets (gitignored)
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── studies.py
│   │   │   ├── blocks.py
│   │   │   ├── slots.py
│   │   │   ├── participants.py
│   │   │   ├── files.py
│   │   │   ├── protocol.py
│   │   │   ├── analysis.py
│   │   │   └── log.py
│   │   └── dependencies.py       # Shared FastAPI dependencies
│   │
│   ├── models/
│   │   ├── database.py           # SQLAlchemy engine + session
│   │   ├── orm.py                # ORM table definitions
│   │   └── schemas.py            # Pydantic request/response models
│   │
│   ├── services/
│   │   ├── analysis_service.py   # LLM orchestration
│   │   ├── file_service.py       # File parsing + preparation
│   │   └── log_service.py        # JSONL log writer
│   │
│   ├── storage/
│   │   ├── base.py               # Abstract StorageBackend
│   │   ├── local.py              # LocalStorageBackend
│   │   └── s3.py                 # S3StorageBackend (future)
│   │
│   ├── uploads/                  # Local file storage (gitignored)
│   └── logs/                     # JSONL interaction logs (gitignored)
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   │
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # Router setup
│   │   │
│   │   ├── pages/
│   │   │   ├── SessionEntryPage.tsx
│   │   │   ├── StudyListPage.tsx
│   │   │   ├── StudyDesignPage.tsx
│   │   │   └── ParticipantWorkspacePage.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── StudyCanvas.tsx
│   │   │   │   ├── BlockCard.tsx
│   │   │   │   ├── SlotBadge.tsx
│   │   │   │   └── SlotDetailPanel.tsx
│   │   │   ├── workspace/
│   │   │   │   ├── DataSourcePanel.tsx
│   │   │   │   ├── AnalysisPanel.tsx
│   │   │   │   ├── FindingCard.tsx
│   │   │   │   ├── SuggestionCard.tsx
│   │   │   │   └── ProtocolEditorPanel.tsx
│   │   │   └── shared/
│   │   │       ├── FileViewerModal.tsx
│   │   │       ├── JsonViewer.tsx
│   │   │       └── TextViewer.tsx
│   │   │
│   │   ├── stores/
│   │   │   ├── sessionStore.ts
│   │   │   ├── studyStore.ts
│   │   │   └── workspaceStore.ts
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts         # Axios instance + log interceptor
│   │   │   ├── studies.ts
│   │   │   ├── participants.ts
│   │   │   ├── analysis.ts
│   │   │   └── log.ts
│   │   │
│   │   └── types/
│   │       └── index.ts          # Shared TypeScript types
│
├── architecture/
│   ├── requirements.md
│   ├── design.md                 # This file
│   ├── aws-architecture.md
│   └── tasks.md
│
└── mock-data/                    # Sample study data packages
    └── simulated-study/
        ├── study-plan.json
        ├── templates/
        └── participants/
            ├── P1/
            └── P2/
```
