import sys
sys.path.insert(0, '.')
from models.database import engine
from models.orm import Base
Base.metadata.create_all(bind=engine)
from sqlalchemy import inspect
tables = sorted(inspect(engine).get_table_names())
expected = ['study','block','data_slot','annotation','study_participant',
            'protocol_snapshot','participant_data_file','analysis_request',
            'finding','citation','suggestion']
missing = [t for t in expected if t not in tables]
print('Tables:', tables)
print('Missing:', missing if missing else 'none')
print('Backend schema OK' if not missing else 'SCHEMA ERROR')
