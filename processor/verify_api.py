#!/usr/bin/env python3
"""
Verify KIMI API configuration and test connection.
"""

import os
import sys

# Load from .env file if exists
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ.setdefault(key, value)

def test_api_key(api_key, base_url="https://api.moonshot.cn/v1"):
    """Test if API key is valid."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url=base_url)
        
        # Try a simple request
        response = client.chat.completions.create(
            model="moonshot-v1-8k",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5
        )
        return True, response.choices[0].message.content
    except Exception as e:
        return False, str(e)


def main():
    print("=" * 70)
    print("InkGrid Processor - API Verification")
    print("=" * 70)
    print()
    
    # Check API key
    api_key = os.getenv('KIMI_API_KEY')
    
    if not api_key:
        print("✗ KIMI_API_KEY not set")
        print()
        print("Please set your API key:")
        print("  export KIMI_API_KEY='your-api-key'")
        print()
        print("Or create a .env file with:")
        print("  KIMI_API_KEY=your-api-key")
        print()
        print("Get your API key from: https://platform.moonshot.cn/")
        return 1
    
    print(f"✓ KIMI_API_KEY found")
    print(f"  Length: {len(api_key)} characters")
    print(f"  Prefix: {api_key[:20]}...")
    print(f"  Suffix: ...{api_key[-4:]}")
    print()
    
    # Check other config
    base_url = os.getenv('KIMI_BASE_URL', 'https://api.moonshot.cn/v1')
    model = os.getenv('KIMI_MODEL', 'moonshot-v1-8k-vision-preview')
    
    print(f"Configuration:")
    print(f"  Base URL: {base_url}")
    print(f"  Model: {model}")
    print()
    
    # Test connection
    print("Testing API connection...")
    print("-" * 70)
    
    success, result = test_api_key(api_key, base_url)
    
    if success:
        print(f"✓ API connection successful!")
        print(f"  Response: {result}")
        print()
        print("You can now use the InkGrid Processor.")
        return 0
    else:
        print(f"✗ API connection failed")
        print(f"  Error: {result}")
        print()
        print("Troubleshooting:")
        print("  1. Check if your API key is correct")
        print("  2. Verify your API key has not expired")
        print("  3. Check your network connection")
        print("  4. Visit https://platform.moonshot.cn/ to verify your account")
        print()
        print("If the problem persists, you may need to:")
        print("  - Generate a new API key")
        print("  - Contact KIMI support")
        return 1


if __name__ == '__main__':
    sys.exit(main())
