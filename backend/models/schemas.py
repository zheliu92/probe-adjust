from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel


# ── Annotation ────────────────────────────────────────────────────────────────

class AnnotationOut(BaseModel):
    id: str
    slot_id: str
    content: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnnotationUpsert(BaseModel):
    content: str


# ── DataSlot ──────────────────────────────────────────────────────────────────

class DataSlotCreate(BaseModel):
    name: str
    data_type: str        # qualitative | quantitative
    data_nature: str      # subjective | objective


class DataSlotUpdate(BaseModel):
    name: Optional[str] = None
    data_type: Optional[str] = None
    data_nature: Optional[str] = None


class DataSlotOut(BaseModel):
    id: str
    block_id: str
    name: str
    data_type: str
    data_nature: str
    template_file_name: Optional[str] = None
    annotation: Optional[AnnotationOut] = None

    model_config = {"from_attributes": True}


# ── Block ─────────────────────────────────────────────────────────────────────

class BlockCreate(BaseModel):
    type: str     # plain | experience | feedback
    label: str


class BlockUpdate(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None


class BlockOut(BaseModel):
    id: str
    study_id: str
    type: str
    label: str
    position: int
    slots: List[DataSlotOut] = []

    model_config = {"from_attributes": True}


class BlockReorder(BaseModel):
    block_ids: List[str]   # ordered list of all block IDs


# ── Study ─────────────────────────────────────────────────────────────────────

class StudyCreate(BaseModel):
    title: str
    description: Optional[str] = ""


class StudyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class StudyOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    blocks: List[BlockOut] = []

    model_config = {"from_attributes": True}


class StudySummary(BaseModel):
    id: str
    title: str
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Citation ──────────────────────────────────────────────────────────────────

class CitationOut(BaseModel):
    id: str
    finding_id: str
    file_id: Optional[str]
    display_ref: str
    location: Any    # parsed JSON dict on read

    model_config = {"from_attributes": True}


# ── Finding ───────────────────────────────────────────────────────────────────

class FindingOut(BaseModel):
    id: str
    analysis_request_id: str
    position: int
    title: str
    explanation: str
    tension_type: Optional[str]
    citations: List[CitationOut] = []

    model_config = {"from_attributes": True}


# ── Suggestion ────────────────────────────────────────────────────────────────

class SuggestionOut(BaseModel):
    id: str
    analysis_request_id: str
    finding_id: Optional[str]
    position: int
    description: str
    protocol_ref: Optional[str]

    model_config = {"from_attributes": True}


# ── Analysis Request ──────────────────────────────────────────────────────────

class AnalysisRequestCreate(BaseModel):
    label: str
    mode: str           # findings | suggestions
    file_ids: List[str]
    custom_prompt: Optional[str] = None


class AnalysisRequestOut(BaseModel):
    id: str
    participant_id: str
    label: str
    mode: str
    status: str
    custom_prompt: Optional[str]
    position: int
    created_at: datetime
    completed_at: Optional[datetime]
    findings: List[FindingOut] = []
    suggestions: List[SuggestionOut] = []

    model_config = {"from_attributes": True}


# ── Participant Data File ─────────────────────────────────────────────────────

class ParticipantDataFileOut(BaseModel):
    id: str
    participant_id: str
    slot_id: Optional[str]
    file_name: str
    custom_prompt: Optional[str]
    included_in_analysis: bool
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ParticipantDataFileUpdate(BaseModel):
    custom_prompt: Optional[str] = None
    included_in_analysis: Optional[bool] = None


# ── File Content ──────────────────────────────────────────────────────────────

class FileLine(BaseModel):
    n: int
    text: str


class FileContent(BaseModel):
    file_id: str
    file_name: str
    lines: List[FileLine]


# ── Protocol Snapshot ─────────────────────────────────────────────────────────

class ProtocolSnapshotCreate(BaseModel):
    session_id: str
    mode: str
    content: str


class ProtocolSnapshotOut(BaseModel):
    id: str
    participant_id: str
    session_id: str
    mode: str
    content: str
    saved_at: datetime

    model_config = {"from_attributes": True}


# ── Study Participant ─────────────────────────────────────────────────────────

class StudyParticipantCreate(BaseModel):
    label: str


class StudyParticipantOut(BaseModel):
    id: str
    study_id: str
    label: str
    protocol_content: Optional[str]
    protocol_updated_at: Optional[datetime]
    created_at: datetime
    data_files: List[ParticipantDataFileOut] = []

    model_config = {"from_attributes": True}


# ── Protocol ──────────────────────────────────────────────────────────────────

class ProtocolOut(BaseModel):
    content: str
    updated_at: Optional[datetime]


class ProtocolUpdate(BaseModel):
    content: str


# ── Interaction Log ───────────────────────────────────────────────────────────

class LogEvent(BaseModel):
    event: str
    payload: dict = {}
