#!/usr/bin/env bash
# =====================================================================
# SmartCity AI OS — Automated Google Cloud Run Deployment Script
# =====================================================================

set -e

# Configuration
SERVICE_NAME="smartcity-ai-os"
REGION="${GCP_REGION:-us-central1}"
IMAGE_NAME="smartcity-ai-os"
REPO_NAME="cloud-run-source-deploy"

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Starting Cloud Run Deployment for ${SERVICE_NAME} ===${NC}"

# Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed.${NC}"
    echo -e "Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get current project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "(unset)" ]; then
    echo -e "${YELLOW}No active GCP project set.${NC}"
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

echo -e "${GREEN}Deploying to GCP Project:${NC} ${PROJECT_ID}"
echo -e "${GREEN}Region:${NC} ${REGION}"

# Enable required Google Cloud APIs
echo -e "${CYAN}Enabling required GCP APIs (Cloud Run, Cloud Build, Artifact Registry)...${NC}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create Artifact Registry Repository if not exists
echo -e "${CYAN}Ensuring Artifact Registry repository exists...${NC}"
gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Cloud Run deployments" 2>/dev/null || true

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest"

# Build and Push Image using Google Cloud Build
echo -e "${CYAN}Building container image via Cloud Build...${NC}"
gcloud builds submit --tag "$IMAGE_URI" .

# Optional: Prompt to bind secrets from Google Secret Manager if configured
SECRET_ENV_FLAGS=""
if gcloud secrets describe EMERGENT_LLM_KEY &>/dev/null; then
    echo -e "${GREEN}Found secret EMERGENT_LLM_KEY in Secret Manager! Attaching to Cloud Run...${NC}"
    SECRET_ENV_FLAGS="--set-secrets=EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest"
fi

# Deploy to Cloud Run
echo -e "${CYAN}Deploying service to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_URI" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    $SECRET_ENV_FLAGS

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')

echo -e "\n${GREEN}=======================================================${NC}"
echo -e "${GREEN} Deployment Successful!${NC}"
echo -e "${GREEN} Service URL:${NC} ${SERVICE_URL}"
echo -e "${GREEN}=======================================================${NC}\n"
