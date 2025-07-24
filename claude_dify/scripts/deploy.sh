#!/bin/bash

# Claude Dify Checker Deployment Script
# This script helps deploy the application to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"asia-northeast1"}
SERVICE_NAME="checker-api"
REPOSITORY_NAME="checker-api"

echo -e "${BLUE}🚀 Claude Dify Checker Deployment Script${NC}"
echo "============================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  Project ID not set${NC}"
    echo "Please set GOOGLE_CLOUD_PROJECT environment variable or use:"
    echo "gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✅ Project ID: $PROJECT_ID${NC}"
echo -e "${GREEN}✅ Region: $REGION${NC}"

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null; then
    echo -e "${RED}❌ Not authenticated with Google Cloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

echo -e "${BLUE}📋 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

echo -e "${BLUE}🏗️  Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for Claude Dify Checker" \
    --quiet || echo "Repository already exists"

echo -e "${BLUE}🔨 Building Docker image...${NC}"
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker $REGION-docker.pkg.dev

# Build and tag the image
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$SERVICE_NAME:latest"
docker build -t $IMAGE_URI .

echo -e "${BLUE}📤 Pushing image to Artifact Registry...${NC}"
docker push $IMAGE_URI

echo -e "${BLUE}🚢 Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE_URI \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --memory=4Gi \
    --cpu=2 \
    --timeout=300 \
    --max-instances=10 \
    --min-instances=1 \
    --concurrency=5 \
    --set-env-vars="NODE_ENV=production,DEBUG=false" \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo "============================================="
echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Test the health endpoint: curl $SERVICE_URL/health"
echo "2. Test the debug endpoint: curl $SERVICE_URL/debug"
echo "3. Update the Dify workflow JSON with the service URL"
echo "4. Set up API keys in Secret Manager:"
echo "   - OPENAI_API_KEY"
echo "   - GEMINI_API_KEY" 
echo "5. Create and configure GCS bucket"
echo ""
echo -e "${BLUE}💰 Estimated Costs:${NC}"
echo "- Cloud Run: ~\$0.011/analysis"
echo "- LLM APIs: ~\$0.031/analysis"
echo "- Total: ~\$0.042/analysis"
echo ""
echo -e "${GREEN}🎉 Ready to analyze websites!${NC}"