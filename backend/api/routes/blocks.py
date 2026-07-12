import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import Block, Study
from models.schemas import BlockCreate, BlockUpdate, BlockOut, BlockReorder

router = APIRouter(tags=["blocks"])


@router.get("/studies/{study_id}/blocks", response_model=list[BlockOut])
def list_blocks(study_id: str, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    return db.query(Block).filter_by(study_id=study_id).order_by(Block.position).all()


@router.post("/studies/{study_id}/blocks", response_model=BlockOut, status_code=201)
def add_block(study_id: str, body: BlockCreate, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    # Place at end
    max_pos = db.query(Block).filter_by(study_id=study_id).count()
    block = Block(
        id=str(uuid.uuid4()),
        study_id=study_id,
        type=body.type,
        label=body.label,
        position=max_pos,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.put("/blocks/{block_id}", response_model=BlockOut)
def update_block(block_id: str, body: BlockUpdate, db: Session = Depends(get_db)):
    block = db.query(Block).filter_by(id=block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    if body.label is not None:
        block.label = body.label
    if body.type is not None:
        block.type = body.type
    db.commit()
    db.refresh(block)
    return block


@router.delete("/blocks/{block_id}", status_code=204)
def delete_block(block_id: str, db: Session = Depends(get_db)):
    block = db.query(Block).filter_by(id=block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    study_id = block.study_id
    db.delete(block)
    db.flush()
    # Re-number remaining blocks
    remaining = (
        db.query(Block).filter_by(study_id=study_id).order_by(Block.position).all()
    )
    for i, b in enumerate(remaining):
        b.position = i
    db.commit()


@router.post("/studies/{study_id}/blocks/reorder", status_code=200)
def reorder_blocks(study_id: str, body: BlockReorder, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    for i, block_id in enumerate(body.block_ids):
        block = db.query(Block).filter_by(id=block_id, study_id=study_id).first()
        if block:
            block.position = i
    db.commit()
    return {"ok": True}
