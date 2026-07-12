"""
Participant management routes.

POST /studies/{id}/participants/upload-zip  — Upload a zip of participant data,
    auto-creates participant profile with label derived from filename.
"""
import io
import re
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import Study, StudyParticipant, DataSlot, Block, ParticipantDataFile
from models.schemas import StudyParticipantCreate, StudyParticipantOut
from storage.factory import get_storage

router = APIRouter(tags=["participants"])

ALLOWED_DATA_EXTENSIONS = {".txt", ".md", ".json"}


def _find_protocol_template(study_id: str, db: Session) -> str:
    """Return the text content of the interview-protocol template slot, or empty string."""
    blocks = db.query(Block).filter_by(study_id=study_id, type="feedback").all()
    for block in blocks:
        for slot in block.slots:
            if (
                slot.template_file_path
                and any(kw in slot.name.lower() for kw in ("interview", "protocol", "guide"))
            ):
                try:
                    raw = get_storage().read_file(slot.template_file_path)
                    return raw.decode("utf-8", errors="replace")
                except Exception:
                    pass
    return ""


def _extract_participant_label(zip_filename: str) -> str:
    """Derive participant label from zip filename.

    Examples:
        P1_experience_data.zip  → P1
        P2_data.zip             → P2
        participant_3.zip       → participant_3  (fallback: full stem)
    """
    stem = Path(zip_filename).stem          # strip .zip
    # Match leading word/number token before first underscore or hyphen
    m = re.match(r'^([A-Za-z0-9]+)', stem)
    return m.group(1) if m else stem


def _match_file_to_slot(filename: str, slots: list[DataSlot], used_ids: set) -> DataSlot | None:
    """Match a zip member filename to a study slot by name similarity.

    Filename format: {PID}_{slot_name_fragment}.{ext}
    e.g. P1_condition_a_system_log.json  →  matches slot named 'System Log'
    """
    stem = Path(filename).stem.lower()
    # Strip leading PID token (everything before first underscore)
    parts = stem.split("_", 1)
    name_fragment = parts[1] if len(parts) > 1 else stem

    best: DataSlot | None = None
    best_score = 0
    for slot in slots:
        if slot.id in used_ids:
            continue
        slot_words = set(slot.name.lower().replace("-", " ").replace("_", " ").split())
        frag_words = set(name_fragment.replace("_", " ").split())
        overlap = len(slot_words & frag_words)
        if overlap > best_score:
            best_score = overlap
            best = slot
    return best if best_score > 0 else None


# ── Standard participant CRUD ──────────────────────────────────────────────────

@router.get("/studies/{study_id}/participants", response_model=list[StudyParticipantOut])
def list_participants(study_id: str, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    return (
        db.query(StudyParticipant)
        .filter_by(study_id=study_id)
        .order_by(StudyParticipant.created_at)
        .all()
    )


@router.post(
    "/studies/{study_id}/participants",
    response_model=StudyParticipantOut,
    status_code=201,
)
def create_participant(study_id: str, body: StudyParticipantCreate, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    protocol_content = _find_protocol_template(study_id, db)
    participant = StudyParticipant(
        id=str(uuid.uuid4()),
        study_id=study_id,
        label=body.label,
        protocol_content=protocol_content,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.get("/participants/{participant_id}", response_model=StudyParticipantOut)
def get_participant(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    return p


@router.delete("/participants/{participant_id}", status_code=204)
def delete_participant(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    db.delete(p)
    db.commit()


# ── Zip upload ─────────────────────────────────────────────────────────────────

@router.post(
    "/studies/{study_id}/participants/upload-zip",
    response_model=StudyParticipantOut,
    status_code=201,
)
async def upload_participant_zip(
    study_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a zip of participant data files.

    The zip filename must start with the participant ID, e.g. P1_experience_data.zip.
    Each file inside is matched to a study data slot by name similarity.
    Creates the participant profile automatically.
    """
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "File must be a .zip archive")

    # Derive participant label from filename
    label = _extract_participant_label(file.filename)
    if not label:
        raise HTTPException(400, "Could not derive participant ID from filename")

    # Read zip contents
    raw_bytes = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Invalid zip file")

    # Gather all data-kind slots across the study (ordered by block position)
    all_slots: list[DataSlot] = (
        db.query(DataSlot)
        .join(Block)
        .filter(Block.study_id == study_id)
        .order_by(Block.position)
        .all()
    )

    # Create participant
    protocol_content = _find_protocol_template(study_id, db)
    participant = StudyParticipant(
        id=str(uuid.uuid4()),
        study_id=study_id,
        label=label,
        protocol_content=protocol_content,
    )
    db.add(participant)
    db.flush()

    storage = get_storage()
    used_slot_ids: set[str] = set()
    matched: list[str] = []
    skipped: list[str] = []

    for member_name in zf.namelist():
        # Skip directories and hidden/system files
        if member_name.endswith("/") or Path(member_name).name.startswith("."):
            continue
        ext = Path(member_name).suffix.lower()
        if ext not in ALLOWED_DATA_EXTENSIONS:
            skipped.append(member_name)
            continue

        base_name = Path(member_name).name
        slot = _match_file_to_slot(base_name, all_slots, used_slot_ids)
        if slot is None:
            skipped.append(member_name)
            continue

        used_slot_ids.add(slot.id)
        content = zf.read(member_name)
        file_id = str(uuid.uuid4())
        rel_path = f"participants/{participant.id}/{file_id}_{base_name}"
        storage.save_file(rel_path, content)

        pf = ParticipantDataFile(
            id=file_id,
            participant_id=participant.id,
            slot_id=slot.id,
            file_name=base_name,
            file_path=rel_path,
        )
        db.add(pf)
        matched.append(f"{base_name} → {slot.name}")

    db.commit()
    db.refresh(participant)
    return participant
