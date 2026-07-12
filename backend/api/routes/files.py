import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import StudyParticipant, ParticipantDataFile, DataSlot
from models.schemas import (
    ParticipantDataFileOut, ParticipantDataFileUpdate, FileContent
)
from storage.factory import get_storage
from services.file_service import parse_file_to_lines

router = APIRouter(tags=["files"])

ALLOWED_EXTENSIONS = {".txt", ".md", ".json"}


def _ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@router.post(
    "/participants/{participant_id}/files",
    response_model=ParticipantDataFileOut,
    status_code=201,
)
async def upload_file(
    participant_id: str,
    file: UploadFile = File(...),
    slot_id: str = Form(...),
    db: Session = Depends(get_db),
):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    if not _ext_ok(file.filename):
        raise HTTPException(400, "Only .txt, .md, .json files are allowed")

    # Validate slot belongs to participant's study
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if slot:
        from models.orm import Block
        block = db.query(Block).filter_by(id=slot.block_id).first()
        if block and block.study_id != p.study_id:
            raise HTTPException(400, "Slot does not belong to this participant's study")

    content = await file.read()
    file_id = str(uuid.uuid4())
    rel_path = f"participants/{participant_id}/{file_id}_{file.filename}"
    get_storage().save_file(rel_path, content)

    pf = ParticipantDataFile(
        id=file_id,
        participant_id=participant_id,
        slot_id=slot_id,
        file_name=file.filename,
        file_path=rel_path,
    )
    db.add(pf)
    db.commit()
    db.refresh(pf)
    return pf


@router.get("/files/{file_id}", response_model=ParticipantDataFileOut)
def get_file_meta(file_id: str, db: Session = Depends(get_db)):
    pf = db.query(ParticipantDataFile).filter_by(id=file_id).first()
    if not pf:
        raise HTTPException(404, "File not found")
    return pf


@router.get("/files/{file_id}/content", response_model=FileContent)
def get_file_content(file_id: str, db: Session = Depends(get_db)):
    pf = db.query(ParticipantDataFile).filter_by(id=file_id).first()
    if not pf:
        raise HTTPException(404, "File not found")
    raw = get_storage().read_file(pf.file_path)
    lines = parse_file_to_lines(raw, pf.file_name)
    return FileContent(file_id=file_id, file_name=pf.file_name, lines=lines)


@router.put("/files/{file_id}", response_model=ParticipantDataFileOut)
def update_file(
    file_id: str,
    body: ParticipantDataFileUpdate,
    db: Session = Depends(get_db),
):
    pf = db.query(ParticipantDataFile).filter_by(id=file_id).first()
    if not pf:
        raise HTTPException(404, "File not found")
    if body.custom_prompt is not None:
        pf.custom_prompt = body.custom_prompt
    if body.included_in_analysis is not None:
        pf.included_in_analysis = body.included_in_analysis
    db.commit()
    db.refresh(pf)
    return pf


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db)):
    pf = db.query(ParticipantDataFile).filter_by(id=file_id).first()
    if not pf:
        raise HTTPException(404, "File not found")
    try:
        get_storage().delete_file(pf.file_path)
    except Exception:
        pass
    db.delete(pf)
    db.commit()
