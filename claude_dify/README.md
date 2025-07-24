# Playwright Analyzer API

A TypeScript Node.js API for web analysis using Playwright, designed for Cloud Run deployment.

## Features

- 🎭 **Playwright Integration**: Automated web analysis with Chromium
- 🔍 **Web Analysis**: Page metrics, accessibility checks, screenshots
- 🚀 **Cloud Run Ready**: Optimized Docker container with `--no-sandbox`
- 🛡️ **Security**: Input validation, private IP blocking, security headers
- 📊 **Monitoring**: Health checks, readiness probes, debug endpoints
- 🔧 **TypeScript**: Full type safety and modern development experience

## API Endpoints

### POST /analyze
Analyze a website URL and return comprehensive data.

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "timeout": 30000,
    "waitFor": ".main-content",
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "screenshot": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "data": {
    "title": "Example Domain",
    "loadTime": 1250,
    "screenshot": "base64-encoded-image...",
    "metrics": {
      "domElements": 156,
      "networkRequests": 12,
      "pageSize": 4526
    },
    "accessibility": {
      "score": 85,
      "issues": [
        {
          "type": "missing-alt-text",
          "message": "2 images missing alt text",
          "severity": "error"
        }
      ]
    }
  },
  "processingTime": 2340
}
```

### GET /health
Basic health check endpoint.

### GET /ready
Readiness probe that checks if Playwright is operational.

### GET /debug
Detailed system information for debugging.

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

### Testing
```bash
# Test the API locally
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Health check
curl http://localhost:8080/health

# Debug info
curl http://localhost:8080/debug
```

## Docker Deployment

### Build and Run Locally
```bash
# Build image
docker build -t playwright-analyzer .

# Run container
docker run -p 8080:8080 playwright-analyzer

# Test
curl http://localhost:8080/health
```

### Cloud Run Deployment
```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT/playwright-analyzer

# Deploy to Cloud Run
gcloud run deploy playwright-analyzer \
  --image gcr.io/YOUR_PROJECT/playwright-analyzer \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300
```

## Configuration

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 8080)
- `ALLOWED_ORIGINS`: CORS allowed origins (production only)

### Chromium Flags
The Dockerfile includes optimized Chromium flags for Cloud Run:
- `--no-sandbox`: Required for Cloud Run
- `--disable-setuid-sandbox`: Security flag
- `--disable-dev-shm-usage`: Memory optimization
- `--disable-gpu`: Disable GPU for headless mode

## Error Handling

The API includes comprehensive error handling:
- Input validation errors (400)
- Network/timeout errors (502/504)
- Private IP blocking (400)
- Internal errors (500)

All errors return structured JSON responses:
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT_ERROR",
    "message": "Request timeout"
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Security Features

- **Input Validation**: URL format and parameter validation
- **Private IP Blocking**: Prevents SSRF attacks in production
- **Security Headers**: Helmet.js for security headers
- **Rate Limiting**: Configure as needed for your use case
- **Non-root User**: Docker container runs as non-root user

## Performance Optimization

- **Chromium Only**: Only installs Chromium to reduce image size
- **Multi-stage Build**: Removes dev dependencies from final image
- **Memory Limits**: Optimized for Cloud Run constraints
- **Graceful Shutdown**: Proper cleanup on termination signals

## Monitoring

- **Health Endpoint**: `/health` for basic availability
- **Readiness Endpoint**: `/ready` for Kubernetes readiness probes
- **Debug Endpoint**: `/debug` for troubleshooting
- **Structured Logging**: JSON logs for Cloud Logging integration

## License

MIT License