"""
seed.py — Populate the database and local file storage with the simulated study data.

Usage (from the backend/ directory):
    python seed.py

Idempotent: running twice will not duplicate data. If a study with id='default'
already exists, the script exits cleanly with a message.

Mock data location: ../mock-data/simulated-study/
"""

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── resolve paths ──────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.resolve()
MOCK_DIR = BACKEND_DIR.parent / "mock-data" / "simulated-study"
TEMPLATES_DIR = MOCK_DIR / "templates"

sys.path.insert(0, str(BACKEND_DIR))

from models.database import engine, SessionLocal
from models.orm import Base, Study, Block, DataSlot, Annotation, StudyParticipant, ParticipantDataFile
from storage.factory import get_storage

# ── participant data file manifest ─────────────────────────────────────────────
# Maps (participant_label, slot_search_term) -> filename in mock-data/participants/<label>/
# slot_search_term is matched against slot name (case-insensitive, substring)
PARTICIPANT_FILES = {
    "P1": [
        ("demographic",                 "demographic_responses.txt"),
        ("baseline survey responses",   "baseline_survey_responses.txt"),
        ("system log",                  "condition_a_system_log.json"),       # Condition A
        ("think-aloud transcript",      "condition_a_think_aloud.txt"),
        ("observation notes",           "condition_a_observation_notes.txt"),
        ("post-condition a responses",  "condition_a_post_survey.txt"),
        ("system log",                  "condition_b_system_log.json"),       # Condition B
        ("think-aloud transcript",      "condition_b_think_aloud.txt"),
        ("observation notes",           "condition_b_observation_notes.txt"),
        ("post-condition b responses",  "condition_b_post_survey.txt"),
    ],
    "P2": [
        ("demographic",                 "demographic_responses.txt"),
        ("baseline survey responses",   "baseline_survey_responses.txt"),
        ("system log",                  "condition_a_system_log.json"),
        ("think-aloud transcript",      "condition_a_think_aloud.txt"),
        ("observation notes",           "condition_a_observation_notes.txt"),
        ("post-condition a responses",  "condition_a_post_survey.txt"),
        ("system log",                  "condition_b_system_log.json"),
        ("think-aloud transcript",      "condition_b_think_aloud.txt"),
        ("observation notes",           "condition_b_observation_notes.txt"),
        ("post-condition b responses",  "condition_b_post_survey.txt"),
    ],
}


def find_slot(db, study_id: str, name_hint: str, block_position: int | None = None) -> DataSlot | None:
    """Find a DataSlot by fuzzy name match, optionally within a specific block position."""
    blocks = db.query(Block).filter_by(study_id=study_id).order_by(Block.position).all()
    candidates = []
    for block in blocks:
        if block_position is not None and block.position != block_position:
            continue
        for slot in block.slots:
            if name_hint.lower() in slot.name.lower():
                candidates.append((block.position, slot))
    # Return first match by block position
    if candidates:
        return sorted(candidates, key=lambda x: x[0])[0][1]
    return None


def seed():
    print("── Probe-Adjust Seed Script ──────────────────────────────")

    # Ensure DB tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    storage = get_storage()

    try:
        # ── Idempotency check ──────────────────────────────────────────────────
        existing = db.query(Study).filter_by(id="default").first()
        if existing:
            print("✓ Study 'default' already exists — skipping seed.")
            print("  To re-seed, delete probe_adjust.db and the uploads/ directory, then run again.")
            return

        # ── Load study plan ────────────────────────────────────────────────────
        plan_path = MOCK_DIR / "study-plan.json"
        plan = json.loads(plan_path.read_text())
        study_data = plan["study"]
        blocks_data = plan["blocks"]

        print(f"\n1. Creating study: {study_data['title']}")
        study = Study(
            id=study_data["id"],
            title=study_data["title"],
            description=study_data.get("description", ""),
        )
        db.add(study)
        db.flush()

        # ── Create blocks and slots ────────────────────────────────────────────
        print("2. Creating blocks and slots…")
        # Track slot objects by (block_position, slot_index) for later use
        slot_registry: dict[tuple[int, int], DataSlot] = {}

        for block_data in blocks_data:
            block = Block(
                id=str(uuid.uuid4()),
                study_id=study.id,
                type=block_data["type"],
                label=block_data["label"],
                position=block_data["position"],
            )
            db.add(block)
            db.flush()
            print(f"   [{block_data['type']:10s}] {block_data['label']}")

            for s_idx, slot_data in enumerate(block_data.get("slots", [])):
                slot = DataSlot(
                    id=str(uuid.uuid4()),
                    block_id=block.id,
                    name=slot_data["name"],
                    data_type=slot_data["data_type"],
                    data_nature=slot_data["data_nature"],
                )

                # Upload template file if specified
                if slot_data.get("template_file"):
                    tmpl_path = TEMPLATES_DIR / slot_data["template_file"]
                    if tmpl_path.exists():
                        content = tmpl_path.read_bytes()
                        rel_path = f"templates/{slot.id}/{slot_data['template_file']}"
                        storage.save_file(rel_path, content)
                        slot.template_file_path = rel_path
                        slot.template_file_name = slot_data["template_file"]
                        print(f"              📄 template: {slot_data['template_file']}")

                db.add(slot)
                db.flush()
                slot_registry[(block_data["position"], s_idx)] = slot

                # Add annotation if specified
                if slot_data.get("annotation"):
                    ann = Annotation(
                        id=str(uuid.uuid4()),
                        slot_id=slot.id,
                        content=slot_data["annotation"],
                    )
                    db.add(ann)

                kind_label = "template" if slot_data.get("template_file") else "data"
                print(f"              ↳ [{kind_label:8s}] {slot_data['name']}")

        db.flush()

        # ── Build a flat name→slot lookup for participant file assignment ───────
        # We need to map each (participant_label, slot_name_hint) to a slot ID.
        # For slots with the same name across multiple blocks (e.g. "System Log"
        # appears in block 3 AND block 5) we assign files in order of occurrence.
        all_slots_ordered: list[DataSlot] = (
            db.query(DataSlot)
            .join(Block)
            .filter(Block.study_id == study.id)
            .order_by(Block.position, DataSlot.id)
            .all()
        )

        def find_data_slot(name_hint: str, used_ids: set) -> DataSlot | None:
            """Return the first slot without a template matching name_hint not yet used."""
            hint = name_hint.lower()
            for slot in all_slots_ordered:
                # Skip template slots (those that already have a template file)
                if slot.template_file_path:
                    continue
                if hint in slot.name.lower() and slot.id not in used_ids:
                    return slot
            return None

        # ── Create study participants and upload their data ────────────────────
        print("\n3. Creating study participants and uploading data files…")
        for label, file_manifest in PARTICIPANT_FILES.items():
            print(f"\n   Participant: {label}")
            participant_dir = MOCK_DIR / "participants" / label

            # Find the interview protocol template content
            protocol_content = ""
            for slot in all_slots_ordered:
                if (
                    slot.template_file_path
                    and any(kw in slot.name.lower() for kw in ("interview", "protocol", "guide"))
                ):
                    try:
                        raw = storage.read_file(slot.template_file_path)
                        protocol_content = raw.decode("utf-8", errors="replace")
                    except Exception:
                        pass
                    break

            participant = StudyParticipant(
                id=str(uuid.uuid4()),
                study_id=study.id,
                label=label,
                protocol_content=protocol_content,
                protocol_updated_at=datetime.utcnow(),
            )
            db.add(participant)
            db.flush()

            used_slot_ids: set[str] = set()
            for slot_hint, filename in file_manifest:
                filepath = participant_dir / filename
                if not filepath.exists():
                    print(f"   ⚠  File not found, skipping: {filepath.name}")
                    continue

                slot = find_data_slot(slot_hint, used_slot_ids)
                if slot is None:
                    print(f"   ⚠  No matching slot for hint '{slot_hint}', skipping {filename}")
                    continue

                used_slot_ids.add(slot.id)
                content = filepath.read_bytes()
                file_id = str(uuid.uuid4())
                rel_path = f"participants/{participant.id}/{file_id}_{filename}"
                storage.save_file(rel_path, content)

                pf = ParticipantDataFile(
                    id=file_id,
                    participant_id=participant.id,
                    slot_id=slot.id,
                    file_name=filename,
                    file_path=rel_path,
                )
                db.add(pf)
                print(f"      ✓ {filename} → slot '{slot.name}'")

        db.commit()
        print("\n── Seed complete ─────────────────────────────────────────")
        print("   Study ID : default")
        print("   Participants : P1, P2")
        print(f"   Upload dir   : {os.getenv('UPLOAD_DIR', './uploads')}")
        print("\nStart the backend with:")
        print("   uvicorn main:app --reload")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Seed failed: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
