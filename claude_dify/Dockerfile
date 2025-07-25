# Use official Playwright Node.js image
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 -r nodejs && \
    useradd -r -g nodejs -u 1001 nodejs

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Essential fonts and libraries
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libu2f-udev \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# Install Playwright browsers (only Chromium for Cloud Run)
RUN npx playwright install chromium && \
    # Clean up unnecessary browsers
    rm -rf /ms-playwright/webkit* /ms-playwright/firefox*

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production && \
    rm -rf src/ tsconfig.json

# Create necessary directories and set permissions
RUN mkdir -p logs tmp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Chromium flags for Cloud Run
ENV CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-zygote --single-process --disable-extensions --disable-background-timer-throttling --disable-renderer-backgrounding --disable-features=TranslateUI --disable-ipc-flooding-protection"

# Memory optimization
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Playwright settings
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Expose port
EXPOSE 8080

# Graceful shutdown
STOPSIGNAL SIGTERM

# Start the application
CMD ["node", "dist/server.js"]