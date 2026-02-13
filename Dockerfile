# Full-Stack Dockerfile for inkGrid - Zeabur Optimized (Simplified)

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
COPY frontend/package-lock.json ./frontend/

RUN cd frontend && npm install --legacy-peer-deps

COPY frontend ./frontend/
RUN cd frontend && npm run build

# Stage 2: Final image
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY public /app/public
COPY backend /app/backend
RUN cp -r /app/public/steles /app/frontend/dist/ 2>/dev/null || true

EXPOSE 8080

ENV PORT=8080
ENV PYTHONPATH=/app/backend:$PYTHONPATH

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT}/ || exit 1

CMD ["sh", "-c", "python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
