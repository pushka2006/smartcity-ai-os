# =====================================================================
# SmartCity AI OS — Automated Google Cloud Run Deployment Script (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"

$SERVICE_NAME = "smartcity-ai-os"
$REGION = if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
$IMAGE_NAME = "smartcity-ai-os"
$REPO_NAME = "cloud-run-source-deploy"

Write-Host "=== Starting Cloud Run Deployment for $SERVICE_NAME ===" -ForegroundColor Cyan

# Check gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: gcloud CLI is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Get current project ID
$PROJECT_ID = (gcloud config get-value project 2>$null).Trim()

if (-not $PROJECT_ID -or $PROJECT_ID -eq "(unset)") {
    Write-Host "No active GCP project set." -ForegroundColor Yellow
    $PROJECT_ID = Read-Host "Enter your Google Cloud Project ID"
    gcloud config set project $PROJECT_ID
}

Write-Host "Deploying to GCP Project: $PROJECT_ID" -ForegroundColor Green
Write-Host "Region: $REGION" -ForegroundColor Green

# Enable required Google Cloud APIs
Write-Host "Enabling required GCP APIs (Cloud Run, Cloud Build, Artifact Registry)..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create Artifact Registry Repository if not exists
Write-Host "Ensuring Artifact Registry repository exists..." -ForegroundColor Cyan
gcloud artifacts repositories create $REPO_NAME `
    --repository-format=docker `
    --location=$REGION `
    --description="Docker repository for Cloud Run deployments" 2>$null

$IMAGE_URI = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest"

# Build and Push Image using Google Cloud Build
Write-Host "Building container image via Cloud Build..." -ForegroundColor Cyan
gcloud builds submit --tag $IMAGE_URI .

# Deploy to Cloud Run
Write-Host "Deploying service to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image=$IMAGE_URI `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --memory=1Gi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=10

$SERVICE_URL = (gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)').Trim()

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host " Deployment Successful!" -ForegroundColor Green
Write-Host " Service URL: $SERVICE_URL" -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Green
