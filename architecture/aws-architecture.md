# Probe-Adjust: AWS Architecture

This document describes how Probe-Adjust would be deployed on AWS when moving from local prototype to cloud hosting. No deployment is performed here — this is a reference architecture for future planning.

---

## Architecture Diagram

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                      AWS Cloud                           │
                          │                                                          │
   ┌──────────┐           │  ┌─────────────────────────────────────────────────┐    │
   │          │  HTTPS    │  │              AWS CloudFront (CDN)                │    │
   │ Browser  ├───────────┼──►  Edge caching + HTTPS termination               │    │
   │          │           │  │  Custom domain via Route 53                      │    │
   └──────────┘           │  └───────────────────┬─────────────────────────────┘    │
                          │                      │                                  │
                          │          ┌───────────▼───────────┐                      │
                          │          │    Amazon S3 (Static)  │                      │
                          │          │  React build artefacts │                      │
                          │          │  (HTML / JS / CSS)     │                      │
                          │          └───────────────────────┘                      │
                          │                      │                                  │
                          │             API calls (REST/JSON)                       │
                          │                      │                                  │
                          │  ┌───────────────────▼─────────────────────────────┐    │
                          │  │          Amazon API Gateway (HTTP API)           │    │
                          │  │  Rate limiting · CORS · request routing          │    │
                          │  └───────────────────┬─────────────────────────────┘    │
                          │                      │                                  │
                          │  ┌───────────────────▼─────────────────────────────┐    │
                          │  │        AWS App Runner / ECS Fargate              │    │
                          │  │        (FastAPI container)                       │    │
                          │  │  ┌──────────────┐  ┌──────────────────────────┐ │    │
                          │  │  │  Study &     │  │  Analysis Engine          │ │    │
                          │  │  │  Participant │  │  (LLM orchestrator)       │ │    │
                          │  │  │  Routers     │  │  OpenAI API calls         │ │    │
                          │  │  └──────┬───────┘  └──────────────────────────┘ │    │
                          │  └─────────┼────────────────────────────────────────┘    │
                          │            │                                             │
                          │     ┌──────┴────────────────────────────────┐           │
                          │     │                                        │           │
                          │  ┌──▼─────────────────┐  ┌─────────────────▼────────┐  │
                          │  │  Amazon RDS         │  │  Amazon S3 (Data)        │  │
                          │  │  PostgreSQL         │  │  Uploaded data files     │  │
                          │  │  (study, blocks,    │  │  Template files          │  │
                          │  │   participants,     │  │  JSONL interaction logs  │  │
                          │  │   findings, etc.)   │  │                          │  │
                          │  └─────────────────────┘  └──────────────────────────┘  │
                          │                                                          │
                          │  ┌──────────────────────────────────────────────────┐   │
                          │  │           AWS Secrets Manager                     │   │
                          │  │   OPENAI_API_KEY · DB connection string           │   │
                          │  └──────────────────────────────────────────────────┘   │
                          │                                                          │
                          └─────────────────────────────────────────────────────────┘

                          External: OpenAI API (GPT-4o)
                          ─────────────────────────────
                          FastAPI container calls OpenAI API directly over HTTPS.
                          The key is injected from Secrets Manager at startup.
```

---

## Service Selection Rationale

### Frontend Hosting: S3 + CloudFront

**What it does:** S3 stores the compiled React static files (HTML, JS, CSS). CloudFront serves them globally from edge locations with HTTPS.

**Why chosen:**
- React builds to static files with no server-side rendering required. S3 + CloudFront is the canonical AWS pattern for this.
- Near-zero cost for a small user study (static file serving is essentially free at this scale).
- CloudFront provides automatic HTTPS with ACM certificates at no extra cost.
- Globally available with low latency regardless of where study participants connect from.

**Local equivalent:** `vite build` + serving the `dist/` folder from any static file server.

---

### API Layer: Amazon API Gateway (HTTP API)

**What it does:** Sits in front of the backend container, handling HTTPS termination, CORS headers, and request routing.

**Why chosen:**
- HTTP API (not REST API) is the newer, cheaper, lower-latency variant — appropriate for a simple REST backend.
- Provides built-in rate limiting to prevent runaway LLM calls (important since each analysis triggers an OpenAI API call).
- CORS configuration is centralized here rather than duplicated in the backend.
- Decouples the public endpoint URL from the backend container, making zero-downtime deployments easier.

**Alternative considered:** Application Load Balancer. Rejected because API Gateway HTTP API is simpler and cheaper for this traffic pattern (low volume, stateless REST).

**Local equivalent:** FastAPI runs directly on `localhost:8000` with CORS middleware.

---

### Backend Compute: AWS App Runner

**What it does:** Runs the FastAPI Docker container as a managed service — no EC2 instances, no cluster management.

**Why chosen:**
- App Runner auto-scales from zero (no cost when not in use between study sessions) to handle concurrent users.
- Simpler than ECS Fargate for a containerized web service with no complex orchestration needs.
- Handles TLS, load balancing, and health checks automatically.
- FastAPI containerizes cleanly with a standard `Dockerfile` + `requirements.txt`.

**Alternative considered:** AWS Lambda (serverless). Rejected because FastAPI has startup overhead (DB connection, model loading) that would cause cold-start latency. LLM calls can also exceed Lambda's 15-minute timeout if the prompt is large, though unlikely here.

**Alternative considered:** ECS Fargate. Would be the upgrade path if App Runner's scaling controls become insufficient, but adds operational complexity not needed for a prototype.

**Local equivalent:** `uvicorn main:app --reload` run directly.

---

### Database: Amazon RDS (PostgreSQL)

**What it does:** Managed relational database replacing SQLite.

**Why chosen:**
- SQLAlchemy ORM used locally supports PostgreSQL with only a connection string change — zero code modifications needed.
- RDS handles automated backups, multi-AZ failover, and patching.
- PostgreSQL is the natural upgrade from SQLite for a web-accessible deployment; it handles concurrent writes correctly (SQLite does not).
- RDS Serverless v2 would allow the database to scale to zero cost between study sessions, matching the App Runner approach.

**Local equivalent:** SQLite file at `./backend/probe_adjust.db`.

---

### File Storage: Amazon S3 (Data Bucket)

**What it does:** Stores uploaded data files (system logs, transcripts, templates) and JSONL interaction log files.

**Why chosen:**
- The local `StorageBackend` abstraction was designed specifically for this swap — `LocalStorageBackend` → `S3StorageBackend` is a config change.
- S3 provides durability (11 nines) appropriate for study data that cannot be re-collected.
- S3 lifecycle policies can automatically archive logs after the study completes.
- Pre-signed URLs allow the frontend to download files securely without routing large files through the FastAPI container.
- JSONL log files stored in S3 are trivially importable into Athena or pandas for post-study analysis.

**Local equivalent:** `./backend/uploads/` and `./backend/logs/` directories.

---

### Secrets Management: AWS Secrets Manager

**What it does:** Stores the OpenAI API key, database connection string, and any other secrets.

**Why chosen:**
- Prevents secrets from being baked into container images or environment variables visible in ECS task definitions.
- Secrets are injected at container startup via the App Runner environment variable integration.
- Rotation support for API keys without redeployment.
- Directly replaces the local `.env` file pattern — same environment variable names, different injection mechanism.

**Local equivalent:** `.env` file loaded by `python-dotenv`.

---

### DNS: Amazon Route 53

**What it does:** Manages the custom domain name pointing to the CloudFront distribution.

**Why chosen:** Tight integration with CloudFront and ACM for automatic certificate provisioning. Only relevant if a custom domain is desired.

**Local equivalent:** `localhost`.

---

## Cost Estimate (User Study Scale)

Assuming ~20 system users, ~3 sessions each, each session ~30 minutes:

| Service | Estimated Cost |
|---|---|
| S3 (static frontend + data files) | < $0.10/month |
| CloudFront | < $0.05/month |
| API Gateway | < $0.01/month |
| App Runner | ~$5–10/month (0.25 vCPU, 0.5GB RAM, ~30h active) |
| RDS Serverless v2 | ~$3–8/month (minimal ACU usage) |
| Secrets Manager | $0.40/month per secret |
| **Total** | **~$10–20/month** |

OpenAI API costs are separate and depend on prompt sizes and number of analysis calls. At ~5K tokens per analysis call × ~60 analyses, GPT-4o costs approximately $3–6 for the full study.

---

## Migration Path from Local to AWS

The architecture was designed so migration requires no code changes — only configuration:

| Local | AWS | Change Required |
|---|---|---|
| SQLite file | RDS PostgreSQL | `DATABASE_URL` env var only |
| `./uploads/` directory | S3 bucket | `STORAGE_BACKEND=s3` + `S3_BUCKET` env var |
| `./logs/` directory | S3 bucket (separate prefix) | `LOG_BACKEND=s3` env var |
| `.env` file | Secrets Manager | Injected as env vars by App Runner |
| `uvicorn` direct | Dockerfile → App Runner | Add `Dockerfile`, push to ECR |
| `vite preview` | S3 + CloudFront | `vite build` → upload to S3 |
