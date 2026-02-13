#!/bin/bash
# Setup script for InkGrid Processor environment

echo "Setting up InkGrid Processor environment..."

# Check if .env file exists
if [ -f ".env" ]; then
    echo "Loading configuration from .env file..."
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: .env file not found"
fi

# Verify API key
if [ -z "$KIMI_API_KEY" ]; then
    echo "Error: KIMI_API_KEY is not set"
    echo "Please set it with: export KIMI_API_KEY='your-api-key'"
    echo "Get your API key from: https://platform.moonshot.cn/"
    exit 1
else
    echo "✓ KIMI_API_KEY is configured"
    echo "  Key: ${KIMI_API_KEY:0:20}...${KIMI_API_KEY: -4}"
fi

# Check Python environment
echo ""
echo "Checking Python environment..."
if python -c "import openai, fastapi, celery" 2>/dev/null; then
    echo "✓ Required packages are installed"
else
    echo "⚠ Some packages may be missing. Run: pip install -r requirements.txt"
fi

echo ""
echo "Environment setup complete!"
echo ""
echo "You can now run:"
echo "  python run_analysis.py analyze --image <path> --name <name>"
echo "  python test_vlm.py"
echo "  uvicorn main:app --reload"
