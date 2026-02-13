#!/bin/bash

# Start inkGrid application for Zeabur deployment
# Frontend is served by Nginx on port 8080
# Backend API runs on port 8000 and is proxied by Nginx

echo "Starting inkGrid..."

# Start backend API in background
cd /app
export PYTHONPATH=/app/backend:$PYTHONPATH
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

# Wait for backend to start
sleep 2

# Start Nginx in foreground
nginx -g 'daemon off;'
