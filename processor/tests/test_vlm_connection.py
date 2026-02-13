import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.vlm_client import get_vlm_client
from processor.core.prompts import get_analysis_prompt

def test_gemini_connection():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment.")
        return

    print(f"Testing Gemini connection with model: gemini-2.0-flash-exp")
    client = get_vlm_client(provider="gemini", api_key=api_key)
    
    test_image = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    if not os.path.exists(test_image):
        # Fallback to check if images/yishan.jpg exists
        test_image = "images/yishan.jpg"
        
    if not os.path.exists(test_image):
        print(f"Warning: Test image not found. Skipping image test.")
        return

    prompt = get_analysis_prompt("峄山刻石", "小篆", ground_truth_text="皇帝立国")
    
    try:
        print(f"Sending request to Gemini with image: {test_image}...")
        result = client.analyze_stele(test_image, prompt)
        print("Success! Response received:")
        print("-" * 20)
        print(result)
        print("-" * 20)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_gemini_connection()