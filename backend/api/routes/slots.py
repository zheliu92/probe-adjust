import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import Block, DataSlot, Annotation
from models.schemas import (
    DataSlotCreate, DataSlotUpdate, DataSlotOut,
    AnnotationUpsert, AnnotationOut, FileContent
)
from storage.factory import get_storage
from services.file_service import parse_file_to_lines

router = APIRouter(tags=["slots"])

ALLOWED_EXTENSIONS = {".txt", ".md", ".json"}


def _ext_ok(filename: str) -> bool:
    from pathlib import Path
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


# ── Slot CRUD ─────────────────────────────────────────────────────────────────

@router.post("/blocks/{block_id}/slots", response_model=DataSlotOut, status_code=201)
def add_slot(block_id: str, body: DataSlotCreate, db: Session = Depends(get_db)):
    block = db.query(Block).filter_by(id=block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    slot = DataSlot(
        id=str(uuid.uuid4()),
        block_id=block_id,
        name=body.name,
        data_type=body.data_type,
        data_nature=body.data_nature,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.put("/slots/{slot_id}", response_model=DataSlotOut)
def update_slot(slot_id: str, body: DataSlotUpdate, db: Session = Depends(get_db)):
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(slot, field, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/slots/{slot_id}", status_code=204)
def delete_slot(slot_id: str, db: Session = Depends(get_db)):
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    # Clean up template file if present
    if slot.template_file_path:
        try:
            get_storage().delete_file(slot.template_file_path)
        except Exception:
            pass
    db.delete(slot)
    db.commit()


# ── Template file upload / view ───────────────────────────────────────────────

@router.post("/slots/{slot_id}/template", response_model=DataSlotOut)
async def upload_template(
    slot_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    if not _ext_ok(file.filename):
        raise HTTPException(400, f"Only .txt, .md, .json files are allowed")

    storage = get_storage()
    # Delete old template if replacing
    if slot.template_file_path:
        try:
            storage.delete_file(slot.template_file_path)
        except Exception:
            pass

    content = await file.read()
    rel_path = f"templates/{slot_id}/{file.filename}"
    storage.save_file(rel_path, content)

    slot.template_file_path = rel_path
    slot.template_file_name = file.filename
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/slots/{slot_id}/template", response_model=FileContent)
def view_template(slot_id: str, db: Session = Depends(get_db)):
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    if not slot.template_file_path:
        raise HTTPException(404, "No template uploaded for this slot")
    storage = get_storage()
    raw = storage.read_file(slot.template_file_path)
    lines = parse_file_to_lines(raw, slot.template_file_name)
    return FileContent(file_id=slot_id, file_name=slot.template_file_name, lines=lines)


# ── Annotation ────────────────────────────────────────────────────────────────

@router.post("/slots/{slot_id}/annotation", response_model=AnnotationOut)
def upsert_annotation(slot_id: str, body: AnnotationUpsert, db: Session = Depends(get_db)):
    slot = db.query(DataSlot).filter_by(id=slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    ann = db.query(Annotation).filter_by(slot_id=slot_id).first()
    if ann:
        ann.content = body.content
    else:
        ann = Annotation(id=str(uuid.uuid4()), slot_id=slot_id, content=body.content)
        db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/slots/{slot_id}/annotation", status_code=204)
def delete_annotation(slot_id: str, db: Session = Depends(get_db)):
    ann = db.query(Annotation).filter_by(slot_id=slot_id).first()
    if ann:
        db.delete(ann)
        db.commit()
