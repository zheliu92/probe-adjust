"""Quick end-to-end smoke test: submit a mock analysis request and wait for results."""
import json
import time
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:8000/api"

def get(path):
    r = urllib.request.urlopen(f"{BASE}{path}", timeout=10)
    return json.loads(r.read())

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data,
        headers={"Content-Type": "application/json", "X-Session-ID": "smoke_test"},
        method="POST"
    )
    r = urllib.request.urlopen(req, timeout=10)
    return json.loads(r.read())

# 1. Fetch study
study = get("/studies/default")
print(f"✓ Study: {study['title']}  blocks={len(study['blocks'])}")

# 2. Fetch participants
participants = get("/studies/default/participants")
print(f"✓ Participants: {[p['label'] for p in participants]}")
assert len(participants) == 2

p = participants[0]
pid = p['id']
files = p['data_files']
print(f"✓ {p['label']} has {len(files)} data files")
assert len(files) == 10

# 3. Submit analysis request (mock mode — no real API key needed)
file_ids = [f['id'] for f in files[:3]]
result = post(f"/participants/{pid}/analysis/requests", {
    "label": "Smoke test — contradiction check",
    "mode": "suggestions",
    "file_ids": file_ids
})
req_id = result['id']
print(f"✓ Analysis queued: {req_id[:8]}…")

# 4. Poll until complete (mock should finish in <5s)
for i in range(20):
    time.sleep(1)
    data = get(f"/analysis/requests/{req_id}")
    status = data['status']
    if status in ('complete', 'error'):
        break
    print(f"  polling… [{i+1}] status={status}")

if status == 'complete':
    findings = data['findings']
    suggestions = data['suggestions']
    print(f"✓ Analysis complete: {len(findings)} findings, {len(suggestions)} suggestions")
    for f in findings:
        print(f"  [{f['tension_type']:14}] {f['title']}")
        for c in f['citations']:
            print(f"    cite: {c['display_ref']}  location={c['location']}")
    if suggestions:
        print("  Suggestions:")
        for s in suggestions:
            print(f"    - {s['description'][:80]}…")
    assert len(findings) == 3, f"Expected 3 mock findings, got {len(findings)}"
    assert len(suggestions) == 2, f"Expected 2 mock suggestions, got {len(suggestions)}"
    print("\n✓ All assertions passed — backend is working correctly.")
elif status == 'error':
    print(f"✗ Analysis errored: {data.get('error_message')}")
    sys.exit(1)
else:
    print(f"✗ Timed out waiting for analysis (status={status})")
    sys.exit(1)

# 5. Verify protocol endpoint
proto = get(f"/participants/{pid}/protocol")
print(f"✓ Protocol loaded: {len(proto['content'])} chars")
assert len(proto['content']) > 100

# 6. Verify file content endpoint
file_id = files[0]['id']
content = get(f"/files/{file_id}/content")
print(f"✓ File content: {content['file_name']}  lines={len(content['lines'])}")
assert len(content['lines']) > 0

print("\n✓✓ End-to-end smoke test passed.")
