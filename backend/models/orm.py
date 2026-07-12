import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, ForeignKey, CheckConstraint
)
from sqlalchemy.orm import relationship
from .database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Study(Base):
    __tablename__ = "study"

    id = Column(String, primary_key=True, default=new_id)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    blocks = relationship("Block", back_populates="study", cascade="all, delete-orphan",
                          order_by="Block.position")
    participants = relationship("StudyParticipant", back_populates="study",
                                cascade="all, delete-orphan")


class Block(Base):
    __tablename__ = "block"
    __table_args__ = (
        CheckConstraint("type IN ('plain', 'experience', 'feedback')", name="block_type_check"),
    )

    id = Column(String, primary_key=True, default=new_id)
    study_id = Column(String, ForeignKey("study.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    label = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    study = relationship("Study", back_populates="blocks")
    slots = relationship("DataSlot", back_populates="block", cascade="all, delete-orphan")


class DataSlot(Base):
    __tablename__ = "data_slot"
    __table_args__ = (
        CheckConstraint("data_type IN ('qualitative', 'quantitative')", name="slot_type_check"),
        CheckConstraint("data_nature IN ('subjective', 'objective')", name="slot_nature_check"),
    )

    id = Column(String, primary_key=True, default=new_id)
    block_id = Column(String, ForeignKey("block.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    data_type = Column(String, nullable=False)       # qualitative | quantitative
    data_nature = Column(String, nullable=False)     # subjective | objective
    # template_file_path: if populated, a template was uploaded at study-design time
    template_file_path = Column(String, nullable=True)
    template_file_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    block = relationship("Block", back_populates="slots")
    annotation = relationship("Annotation", back_populates="slot",
                              uselist=False, cascade="all, delete-orphan")
    participant_files = relationship("ParticipantDataFile", back_populates="slot")


class Annotation(Base):
    __tablename__ = "annotation"

    id = Column(String, primary_key=True, default=new_id)
    slot_id = Column(String, ForeignKey("data_slot.id", ondelete="CASCADE"), nullable=False,
                     unique=True)
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    slot = relationship("DataSlot", back_populates="annotation")


class StudyParticipant(Base):
    __tablename__ = "study_participant"

    id = Column(String, primary_key=True, default=new_id)
    study_id = Column(String, ForeignKey("study.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False)
    protocol_content = Column(Text, default="")
    protocol_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    study = relationship("Study", back_populates="participants")
    data_files = relationship("ParticipantDataFile", back_populates="participant",
                              cascade="all, delete-orphan")
    analysis_requests = relationship("AnalysisRequest", back_populates="participant",
                                     cascade="all, delete-orphan",
                                     order_by="AnalysisRequest.position")
    protocol_snapshots = relationship("ProtocolSnapshot", back_populates="participant",
                                      cascade="all, delete-orphan",
                                      order_by="ProtocolSnapshot.saved_at")


class ProtocolSnapshot(Base):
    """Captures the full protocol state at the end of each mode session.

    This ensures that even if a researcher tries multiple modes on the same
    participant profile, each session's final protocol is preserved separately.
    """
    __tablename__ = "protocol_snapshot"

    id = Column(String, primary_key=True, default=new_id)
    participant_id = Column(String, ForeignKey("study_participant.id", ondelete="CASCADE"),
                            nullable=False)
    session_id = Column(String, nullable=False)   # "{researcher_pid}_{timestamp}"
    mode = Column(String, nullable=False)         # findings | suggestions | baseline
    content = Column(Text, nullable=False, default="")
    saved_at = Column(DateTime, default=datetime.utcnow)

    participant = relationship("StudyParticipant", back_populates="protocol_snapshots")


class ParticipantDataFile(Base):
    __tablename__ = "participant_data_file"

    id = Column(String, primary_key=True, default=new_id)
    participant_id = Column(String, ForeignKey("study_participant.id", ondelete="CASCADE"),
                            nullable=False)
    slot_id = Column(String, ForeignKey("data_slot.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    custom_prompt = Column(Text, nullable=True)
    included_in_analysis = Column(Boolean, default=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    participant = relationship("StudyParticipant", back_populates="data_files")
    slot = relationship("DataSlot", back_populates="participant_files")
    citations = relationship("Citation", back_populates="file")


class AnalysisRequest(Base):
    __tablename__ = "analysis_request"
    __table_args__ = (
        CheckConstraint("mode IN ('findings', 'suggestions')", name="req_mode_check"),
        CheckConstraint(
            "status IN ('queued', 'analyzing', 'complete', 'error')",
            name="req_status_check"
        ),
    )

    id = Column(String, primary_key=True, default=new_id)
    participant_id = Column(String, ForeignKey("study_participant.id", ondelete="CASCADE"),
                            nullable=False)
    label = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    sources_used = Column(Text, nullable=False, default="[]")  # JSON array of file IDs
    custom_prompt = Column(Text, nullable=True)
    raw_llm_response = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    participant = relationship("StudyParticipant", back_populates="analysis_requests")
    findings = relationship("Finding", back_populates="analysis_request",
                            cascade="all, delete-orphan", order_by="Finding.position")
    suggestions = relationship("Suggestion", back_populates="analysis_request",
                               cascade="all, delete-orphan", order_by="Suggestion.position")


class Finding(Base):
    __tablename__ = "finding"
    __table_args__ = (
        CheckConstraint(
            "tension_type IN ('contradiction', 'convergence', 'anomaly')",
            name="finding_tension_check"
        ),
    )

    id = Column(String, primary_key=True, default=new_id)
    analysis_request_id = Column(String,
                                  ForeignKey("analysis_request.id", ondelete="CASCADE"),
                                  nullable=False)
    position = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    tension_type = Column(String, nullable=True)

    analysis_request = relationship("AnalysisRequest", back_populates="findings")
    citations = relationship("Citation", back_populates="finding",
                             cascade="all, delete-orphan")


class Citation(Base):
    __tablename__ = "citation"

    id = Column(String, primary_key=True, default=new_id)
    finding_id = Column(String, ForeignKey("finding.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String, ForeignKey("participant_data_file.id", ondelete="SET NULL"),
                     nullable=True)
    display_ref = Column(String, nullable=False)   # e.g. "Survey Q3"
    location = Column(Text, nullable=False)        # JSON: {"type": "line", "value": 42}

    finding = relationship("Finding", back_populates="citations")
    file = relationship("ParticipantDataFile", back_populates="citations")


class Suggestion(Base):
    __tablename__ = "suggestion"

    id = Column(String, primary_key=True, default=new_id)
    analysis_request_id = Column(String,
                                  ForeignKey("analysis_request.id", ondelete="CASCADE"),
                                  nullable=False)
    finding_id = Column(String, ForeignKey("finding.id", ondelete="SET NULL"), nullable=True)
    position = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    protocol_ref = Column(Text, nullable=True)

    analysis_request = relationship("AnalysisRequest", back_populates="suggestions")
    finding = relationship("Finding")
