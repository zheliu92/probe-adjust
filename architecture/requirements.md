# Probe-Adjust: Requirements Document

## 1. Project Overview

Probe-Adjust is a research tool prototype that supports researchers conducting **experience-focused mixed-methods studies**. It helps researchers integrate multi-channel experience data collected during a study session (system logs, think-aloud transcripts, survey responses, observation notes) and surfaces AI-assisted findings and suggestions to inform the customization of a post-experience interview protocol for each individual study participant.

The prototype is designed to be used in a **user study** where the researcher's participants (system users) are themselves researchers simulating a study workflow. This creates a two-layer participant model that must be kept architecturally distinct.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **System User / Researcher** | The person using this prototype. They are a participant in the system designer's user study. |
| **Study Participant** | The person in the simulated HCI study whose experience data was collected. They never interact with this system directly. Their data is uploaded as files. |
| **Study** | The simulated HCI study context, containing a study plan design and multiple study participant profiles. |
| **Mode** | The AI assistance level the system user experiences: `findings`, `suggestions`, or `baseline` (no AI). Mode is selected during the Stage 1 → Stage 2 transition. |
| **Stage 1 — Study Plan** | The first phase of the workflow: the system user designs the study canvas, uploads templates and protocols, and defines data slots. |
| **Stage 2 — Study Conduct** | The second phase: the system user selects a mode and a simulated study participant, uploads collected data, triggers analysis, and adjusts the interview protocol. |
| **Session** | One Stage 2 work period — a system user selects their Participant ID, mode, and simulated participant, then works until they close or end the session. |
| **Analysis Request** | A named, independent LLM call submitted by the researcher with a specific data selection and optional custom prompt. Multiple requests can be submitted and results accumulate in the panel. |

---

## 3. Functional Requirements

### 3.1 Session Entry (Login / Stage Entry)

- **FR-01**: The system shall present an initial entry screen requiring no credentials.
- **FR-02**: The system user shall enter a **Participant ID** (free text) identifying themselves for interaction logging purposes.
- **FR-03**: The system shall log a `session_start` event on entry, capturing participant ID and timestamp.
- **FR-04**: After entering their Participant ID, the system user shall be directed to the **Study Plan stage** (Stage 1).

### 3.1b Stage Transition (Study Plan → Study Conduct)

- **FR-05**: The Study Design page shall include a **"Begin Study Conduct"** button that transitions the system user to Stage 2.
- **FR-06**: On clicking "Begin Study Conduct", the system user shall be presented with a **transition screen** where they:
  - Select a **Mode**: `Findings`, `Suggestions`, or `Baseline (No AI)`
  - Select a **Simulated Study Participant** from the list of study participant profiles
- **FR-07**: Each mode option shall display a brief description of what the researcher will see in that mode.
- **FR-08**: The selected mode shall persist for the entire Stage 2 session and govern which UI features are visible.
- **FR-09**: The system shall log a `stage2_start` event capturing the mode and selected simulated participant ID.

### 3.2 Study Design Canvas (Stage 1)

- **FR-10**: The system shall present Stage 1 as a **linear canvas** displaying the study plan as an ordered sequence of blocks.
- **FR-11**: On first use, the canvas shall be **pre-populated with the mock study plan** so system users have a concrete starting point to edit.
- **FR-12**: The system user shall be able to **add** new blocks to the canvas.
- **FR-13**: The system user shall be able to **delete** blocks from the canvas.
- **FR-14**: The system user shall be able to **reorder** blocks by drag-and-drop.
- **FR-15**: Each block shall have an editable **label** (e.g., "Condition A", "Demographic Survey").
- **FR-16**: Three block types shall be available: `Plain`, `Experience`, `Feedback`.
- **FR-17**: Each block shall display its type visually (icon or shape).
- **FR-18**: Each block shall support **open-ended data source / material slots** — the researcher can add any data source or template to any block, regardless of type.
- **FR-19**: Data sources and templates shall be visually encoded by:
  - **Shape**: indicating qualitative vs. quantitative data
  - **Color**: indicating subjective vs. objective data
- **FR-20**: The canvas shall be used by the researcher to understand **what data is collected where** in the study, to inform later data selection for analysis.
- **FR-21**: The study plan (block order, labels, data source configurations) shall be saved to the database.

### 3.3 Block Types

| Type | Description | Typical Use |
|---|---|---|
| `Plain` | A procedural step with no data collection. | Introduction, Break, Tutorial (when no data is collected) |
| `Experience` | A task or condition the study participant goes through, generating experience data. | Condition A, Condition B, Practice Task |
| `Feedback` | A step where the study participant provides information or feedback verbally or via form. | Demographic Survey, Post-Condition Survey, Post-Experience Interview |

### 3.4 Data Source Visual Encoding

| Dimension | Symbol |
|---|---|
| **Qualitative** | Circle shape badge |
| **Quantitative** | Square shape badge |
| **Subjective** | Warm color (amber/orange) |
| **Objective** | Cool color (blue/teal) |

A system log (quantitative, objective) = square + blue. A think-aloud transcript (qualitative, subjective) = circle + amber. A survey with Likert scales (quantitative, subjective) = square + amber.

### 3.5 Template and Data Source Management

- **FR-28**: Researchers shall be able to upload **template files** (text-based: `.txt`, `.md`) to a block during study design. Templates contain no participant data — they are study-level artifacts (e.g., interview protocol template, survey question list).
- **FR-29**: Researchers shall be able to define **data placeholders** on a block, representing data that will be uploaded later per study participant (e.g., system log, transcript).
- **FR-30**: Researchers shall be able to annotate any template or placeholder with a **text annotation**, e.g., "Questions 4–7 measure trust in the system."
- **FR-31**: Annotations shall be visible to the AI during analysis as contextual instructions.
- **FR-32**: Annotations shall be stored per-study (not globally shared).

### 3.6 Study Participant Profiles

- **FR-33**: Within a study, researchers shall be able to **create a study participant profile** identified by a name or ID.
- **FR-34**: Each study participant profile shall contain **data upload slots** corresponding to the placeholders defined in the study plan.
- **FR-35**: Researchers shall upload participant-specific data files (`.txt`, `.json`) to the appropriate slots.
- **FR-36**: Each study participant profile shall maintain its own **copy of the interview protocol**, initialized from the study-level template when the profile is created.
- **FR-37**: The study participant profile shall store: uploaded data files, the editable interview protocol copy, AI analysis requests and results, and interaction log entries.

### 3.7 Participant Workspace Layout (Stage 2)

- **FR-38**: The Participant Workspace page shall display a **compact read-only view of the study plan canvas** in the left panel, mirroring the Stage 1 design with all blocks and slot badges visible.
- **FR-39**: Each slot in the compact canvas view shall show its upload state: empty placeholder, template uploaded (study-level), or data file uploaded (participant-level).
- **FR-40**: Clicking a slot in the compact canvas shall open the data upload interface or the file viewer for that slot.
- **FR-41**: The workspace shall have a three-panel layout: left (compact canvas + data management), center (analysis panel, hidden in baseline), right (protocol editor).

### 3.8 Data Analysis

- **FR-42**: The researcher shall be able to create **named analysis requests**, each with an independent data selection, optional custom prompt, and a user-defined label (e.g., "Trust alignment check").
- **FR-43**: The researcher shall be able to **select which data sources** to include per analysis request.
- **FR-44**: The researcher shall be able to attach a **custom prompt** to the entire analysis request or to a specific data source within it.
- **FR-45**: The system shall maintain an **analysis request queue**. Requests are processed sequentially (one LLM call at a time).
- **FR-46**: Each analysis request shall have a visible **status**: `queued`, `analyzing`, `complete`, `error`.
- **FR-47**: As each request completes, its findings/suggestions block shall **appear immediately** in the analysis panel without requiring a page refresh.
- **FR-48**: The system shall send selected data, researcher annotations, custom prompts, and a system-level tension-detection prompt to the LLM for each request.
- **FR-49**: The system shall define an interviewable tension as any of:
  - **Contradiction**: conflicting signals across data sources
  - **Convergence**: strong agreement across multiple data sources on a notable theme
  - **Anomaly**: a data point that stands out from the rest
- **FR-50**: Analysis requests shall only be submittable in `Findings` and `Suggestions` modes.
- **FR-51**: The system shall log an `analysis_triggered` event per request capturing label, sources selected, and custom prompts.

### 3.9 Findings Mode

- **FR-52**: In `Findings` mode, each completed analysis request shall produce a **named findings block** in the analysis panel.
- **FR-53**: Each finding shall include a short title, a 1–2 sentence explanation, and a tension type.
- **FR-54**: Provenance citations shall be **clickable**, opening the source file in an in-app viewer at the relevant location.
- **FR-55**: Findings shall be **static** — the researcher cannot edit them.

### 3.10 Suggestions Mode

- **FR-56**: In `Suggestions` mode, each completed analysis request shall include findings **plus** protocol adjustment suggestions.
- **FR-57**: Suggestions shall be **static** reference items alongside the findings block.

### 3.11 Baseline Mode

- **FR-58**: In `Baseline` mode, the compact canvas and data files are visible but no analysis panel is shown.
- **FR-59**: Data files shall be openable in the in-app viewer with no highlights.

### 3.12 Interview Protocol Editor

- **FR-60**: Each study participant profile shall have an **editable interview protocol** panel (right panel in workspace).
- **FR-61**: The protocol shall be a **free-form text editor** initialized from the study-level template.
- **FR-62**: The protocol shall **autosave** with a debounce of approximately 2 seconds after the last keystroke.
- **FR-63**: Each autosave that results in a changed state shall be logged as a `protocol_edit` event with a line-level diff.
- **FR-64**: The protocol editor shall be accessible in all three modes.

### 3.13 In-App File Viewer

- **FR-65**: The system shall provide an in-app file viewer rendering `.txt` and `.json` files with line numbers.
- **FR-66**: When opened via a provenance citation, the viewer shall scroll to and highlight the relevant line.
- **FR-67**: When opened directly, the viewer opens with no highlights.

### 3.14 Interaction Logging

All interaction log events shall be written to **per-session JSONL files**, separate from the application database.

- **FR-68**: The following events shall be logged:

| Event Type | Trigger | Key Payload Fields |
|---|---|---|
| `session_start` | Participant ID entry | `participant_id`, `timestamp` |
| `stage2_start` | Mode + participant selection | `participant_id`, `mode`, `study_participant_id`, `timestamp` |
| `file_opened` | Researcher opens a data file | `file_id`, `file_name`, `context` (direct/citation) |
| `finding_viewed` | Researcher expands a finding | `finding_id`, `finding_title`, `request_label` |
| `citation_clicked` | Researcher clicks a provenance link | `finding_id`, `citation_ref` |
| `suggestion_viewed` | Researcher expands a suggestion | `suggestion_id`, `request_label` |
| `analysis_triggered` | Researcher submits an analysis request | `request_label`, `sources_included`, `custom_prompts` |
| `source_toggled` | Researcher includes/excludes a source | `source_id`, `action` |
| `protocol_edit` | Autosave detects a change | `before_diff`, `after_diff`, `timestamp` |
| `session_end` | Browser close or explicit end | `timestamp`, `duration_seconds` |

- **FR-69**: JSONL log files shall be named `session_{participantId}_{timestamp}.jsonl` and saved to `/logs`.
- **FR-70**: Log files shall be kept separate from application data for easy export and external analysis.

---

## 4. Non-Functional Requirements

- **NFR-01**: The system shall run entirely **locally** with no external services required except the LLM API.
- **NFR-02**: The LLM API key shall be stored in a `.env` file and never hardcoded.
- **NFR-03**: The system shall be **cloud-deployment ready**: all platform-specific dependencies (file paths, DB connections) shall be behind abstraction layers configurable via environment variables.
- **NFR-04**: The frontend shall build to **static files** deployable to any static hosting service.
- **NFR-05**: The database ORM shall support swapping SQLite for PostgreSQL with a config change only.
- **NFR-06**: File storage shall be abstracted so local filesystem can be swapped for S3-compatible storage.
- **NFR-07**: The system shall support **concurrent sessions** for at least 5 simultaneous system users (for user study deployment).
- **NFR-08**: Analysis responses from the LLM shall return within **30 seconds** for typical payloads (a few files under 50KB total).
- **NFR-09**: The UI shall be responsive to at least 1280×800 viewport minimum.

---

## 5. Out of Scope (Prototype)

- Cross-participant pattern analysis or aggregated findings
- Real authentication / credential validation
- Plan locking / unlock workflow
- Export to PDF or Word
- Audio file upload or transcription
- Non-text, non-JSON file formats
- Collaborative multi-user editing
- Version history of the study plan canvas
