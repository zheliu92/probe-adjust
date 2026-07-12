import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import Study
from models.schemas import StudyCreate, StudyUpdate, StudyOut, StudySummary

router = APIRouter(prefix="/studies", tags=["studies"])


@router.get("", response_model=list[StudySummary])
def list_studies(db: Session = Depends(get_db)):
    return db.query(Study).order_by(Study.created_at.desc()).all()


@router.post("", response_model=StudyOut, status_code=201)
def create_study(body: StudyCreate, db: Session = Depends(get_db)):
    study = Study(id=str(uuid.uuid4()), title=body.title, description=body.description)
    db.add(study)
    db.commit()
    db.refresh(study)
    return study


@router.get("/{study_id}", response_model=StudyOut)
def get_study(study_id: str, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    return study


@router.put("/{study_id}", response_model=StudyOut)
def update_study(study_id: str, body: StudyUpdate, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    if body.title is not None:
        study.title = body.title
    if body.description is not None:
        study.description = body.description
    study.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(study)
    return study


@router.delete("/{study_id}", status_code=204)
def delete_study(study_id: str, db: Session = Depends(get_db)):
    study = db.query(Study).filter_by(id=study_id).first()
    if not study:
        raise HTTPException(404, "Study not found")
    db.delete(study)
    db.commit()
