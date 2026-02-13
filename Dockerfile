# Multi-stage Dockerfile for inkGrid project

# Stage 1: Build frontend (React/Vite)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./frontend/
COPY frontend/package-lock.json ./frontend/

# Install frontend dependencies
RUN cd frontend && npm install --legacy-peer-deps

# Copy frontend source code
COPY frontend ./frontend/

# Build frontend
RUN cd frontend && npm run build

# Stage 2: Build backend dependencies
FROM python:3.12-slim AS backend-deps

WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt ./backend/
COPY processor/requirements.txt ./processor/

# Install Python dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libegl1-mesa \
    libxrandr2 \
    libxinerama1 \
    libxcursor1 \
    libxi6 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install -r backend/requirements.txt
RUN pip install -r processor/requirements.txt

# Stage 3: Final image
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    libgl1-mesa-glx \
    libegl1-mesa \
    libxrandr2 \
    libxinerama1 \
    libxcursor1 \
    libxi6 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies from stage 2
COPY --from=backend-deps /app/backend/requirements.txt ./backend/
COPY --from=backend-deps /app/processor/requirements.txt ./processor/
COPY --from=backend-deps /app/.local/lib/python3.12/site-packages/ ./.local/lib/python3.12/site-packages/

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy application code
COPY backend ./backend/
COPY processor ./processor/
COPY conductor ./conductor/
COPY doc ./doc/
COPY public ./public/
COPY scripts ./scripts/
COPY start.sh .
COPY stop.sh .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# Expose port (Zeabur will use $PORT environment variable)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Copy container-friendly start script
COPY docker-start.sh .

# Make executable
RUN chmod +x docker-start.sh

# Start script (Zeabur compatible)
CMD ["./docker-start.sh"]