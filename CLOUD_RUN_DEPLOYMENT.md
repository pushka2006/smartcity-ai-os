# 🚀 SmartCity AI OS — Google Cloud Run Deployment Guide

This guide provides end-to-end instructions for deploying the **SmartCity AI OS** full-stack application (FastAPI + React) to **Google Cloud Run** with **zero secret leakage**.

---

## 🔒 Secret Protection & Security Standard

> [!IMPORTANT]
> **Zero Secret Leakage Guarantee**:
> - API keys and credentials (`EMERGENT_LLM_KEY`, `MONGO_URL`, `TOMTOM_API_KEY`) are **NEVER** baked into Docker container images or committed to Git.
> - Secrets are excluded via `.dockerignore` and `.gitignore`.
> - Secrets are securely injected at runtime using **Google Secret Manager** or Cloud Run environment variables.

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Google Cloud Project**: A GCP account with billing enabled.
2. **Google Cloud SDK (`gcloud` CLI)**:
   - [Install gcloud CLI](https://cloud.google.com/sdk/docs/install)
   - Initialize and log in:
     ```bash
     gcloud auth login
     gcloud config set project YOUR_PROJECT_ID
     ```
3. **Docker** *(Optional - Cloud Build compiles your container remotely in the cloud if Docker is not installed locally)*.

---

## ⚡ Option 1: Automated 1-Click Deployment (Recommended)

### On Windows (PowerShell):
```powershell
.\deploy-cloud-run.ps1
```

### On Linux / macOS / Git Bash:
```bash
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

The automated script will:
1. Enable all required GCP APIs (`run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `secretmanager.googleapis.com`).
2. Create an Artifact Registry repository.
3. Build the container image securely using **Google Cloud Build**.
4. Deploy the service to Cloud Run and print the live application URL.

---

## 🔑 Managing Production Secrets Safely

### Method A: Google Secret Manager (Best Practice)

1. Create a secret in Google Secret Manager:
   ```bash
   gcloud secrets create EMERGENT_LLM_KEY --data-file=- <<< "your_secret_api_key_here"
   ```
2. Grant the Cloud Run Service Account access to read secrets:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
   gcloud secrets add-iam-policy-binding EMERGENT_LLM_KEY \
       --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   ```
3. Bind secret to Cloud Run:
   ```bash
   gcloud run deploy smartcity-ai-os \
       --region=us-central1 \
       --set-secrets=EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest
   ```

### Method B: Cloud Run Environment Variables

You can also pass environment variables during deployment or set them in the GCP Web Console:

```bash
gcloud run deploy smartcity-ai-os \
    --region=us-central1 \
    --set-env-vars MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/nexus_ai_os",CORS_ORIGINS="*"
```

---

## 🛠️ Option 2: GCP Web Console Deployment (No CLI Needed)

If you prefer using the Google Cloud Web Console interface:

1. Open [Google Cloud Run Console](https://console.cloud.google.com/run).
2. Click **Create Service**.
3. Choose **Continuously deploy new revisions from a source repository** (Cloud Build) OR **Deploy one revision from an existing container image**.
4. Select repository root containing `Dockerfile`.
5. Under **Variables & Secrets**:
   - Add environment variables (`MONGO_URL`, `DB_NAME`, etc.).
   - Add secrets from Google Secret Manager.
6. Under **Ingress**, select **Allow all traffic** and **Allow unauthenticated invocations**.
7. Click **Create**.

---

## 🏗️ Container Architecture Overview

```
                          ┌────────────────────────────────┐
                          │  Google Cloud Run ($PORT 8080) │
                          │                                │
  User Requests  ────────►│  FastAPI (server.py)           │
                          │   ├── /api/*    -> Python API  │
                          │   └── /*        -> React Static│
                          └────────────────────────────────┘
```

- **Unified Single Container**: The React frontend is compiled into static assets in Stage 1 of the multi-stage Docker build and served directly by FastAPI.
- **Microservices Deployment**: Alternative `Dockerfile.backend` and `Dockerfile.frontend` files are provided if separate microservices are desired.

---

## 🔍 Verification & Health Check

After deployment completes:
1. Open the output Cloud Run URL (e.g., `https://smartcity-ai-os-xyz-uc.a.run.app`).
2. Verify API connectivity at `https://smartcity-ai-os-xyz-uc.a.run.app/api/health` or `https://smartcity-ai-os-xyz-uc.a.run.app/api/system/status`.
3. Test dashboard interactions in the live frontend UI.

---

## ❓ Troubleshooting

- **500 Server Error on Startup**: Check Cloud Run logs via `gcloud logging read "resource.type=cloud_run_revision"` to verify environment variables or MongoDB connection strings.
- **Port Binding Warning**: Ensure your container listens on `0.0.0.0:${PORT}` (already configured in `Dockerfile` and `server.py`).
