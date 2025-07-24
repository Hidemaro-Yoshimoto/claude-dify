#!/bin/bash

# Claude Dify Checker Setup Script
# This script helps set up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛠️  Claude Dify Checker Setup Script${NC}"
echo "========================================"

# Check Node.js version
echo -e "${BLUE}📦 Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old${NC}"
    echo "Please upgrade to Node.js 18.0.0 or higher"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Check Docker
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed${NC}"
    echo "Docker is required for deployment. Install from: https://docs.docker.com/get-docker/"
else
    echo -e "${GREEN}✅ Docker is available${NC}"
fi

# Install API dependencies
echo -e "${BLUE}📦 Installing API dependencies...${NC}"
npm install

# Install Playwright browsers
echo -e "${BLUE}🎭 Installing Playwright browsers...${NC}"
npx playwright install chromium

# Install frontend dependencies (if frontend directory exists)
if [ -d "frontend" ]; then
    echo -e "${BLUE}🎨 Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p logs temp

# Create .env.example file
echo -e "${BLUE}⚙️  Creating environment template...${NC}"
cat > .env.example << EOF
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_CLOUD_REGION=asia-northeast1

# API Keys (set these in Google Secret Manager in production)
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key

# Application Configuration
NODE_ENV=development
DEBUG=true
PORT=8080

# Frontend Configuration (for development)
NEXT_PUBLIC_API_URL=http://localhost:8080
EOF

# Check if .env exists, if not copy from example
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file with your actual configuration${NC}"
fi

# Run linter to check code quality
echo -e "${BLUE}🔍 Running code quality checks...${NC}"
npm run lint || echo -e "${YELLOW}⚠️  Linting issues found - please fix them${NC}"

# Run tests
echo -e "${BLUE}🧪 Running tests...${NC}"
npm test || echo -e "${YELLOW}⚠️  Some tests failed - please review${NC}"

# Build Docker image for testing
if command -v docker &> /dev/null; then
    echo -e "${BLUE}🏗️  Testing Docker build...${NC}"
    docker build -t claude-dify-checker:test . || echo -e "${YELLOW}⚠️  Docker build issues - please review${NC}"
fi

echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo "========================================"
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Edit .env file with your configuration"
echo "2. Set up Google Cloud project and enable APIs"
echo "3. Create GCS bucket for screenshots and reports"
echo "4. Set up API keys in Google Secret Manager"
echo "5. Test locally: npm run dev"
echo "6. Deploy: ./scripts/deploy.sh"
echo ""
echo -e "${BLUE}🔗 Useful Commands:${NC}"
echo "- Start development server: npm run dev"
echo "- Run tests: npm test"
echo "- Run linter: npm run lint"
echo "- Build Docker image: npm run docker:build"
echo "- Deploy to Cloud Run: ./scripts/deploy.sh"
echo ""
echo -e "${GREEN}🎉 Happy coding!${NC}"