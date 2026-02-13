# Multi-stage Dockerfile for inkGrid - optimized for Zeabur deployment

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/
COPY frontend/package-lock.json ./frontend/

# Install frontend dependencies
RUN cd frontend && npm install --legacy-peer-deps

# Copy frontend source and build
COPY frontend ./frontend/
RUN cd frontend && npm run build

# Stage 2: Final image
FROM python:3.12-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --upgrade pip
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy application code
COPY backend ./backend/
COPY public ./public/
COPY docker-start.sh .
RUN chmod +x docker-start.sh

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["./docker-start.sh"]