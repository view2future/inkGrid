FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV if needed (though headless should be fine)
RUN apt-get update && apt-get install -y libglib2.0-0 libsm6 libxext6 libxrender-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port for FastAPI
EXPOSE 8000

# Command to run the application (will be overridden by docker-compose for worker)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
