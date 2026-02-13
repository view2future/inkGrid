import os
import sys
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_analysis

def run_comprehensive_test():
    test_cases = [
        {
            "image_path": "steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
            "name": "峄山刻石",
            "script": "小篆"
        },
        {
            "image_path": "steles/1-zhuanshu/1-yishankeshi/yishan2.jpg",
            "name": "峄山刻石-续",
            "script": "小篆"
        },
        {
            "image_path": "steles/2-lishu/1-caoquanbei/caoquanbei-006.jpg",
            "name": "曹全碑",
            "script": "隶书"
        }
    ]

    print("=== InkGrid VLM Refactor Comprehensive Test ===")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Provider: Gemini\n")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("CRITICAL: GOOGLE_API_KEY not found in environment.")
    
    results = []
    
    for case in test_cases:
        print(f"--- Testing Case: {case['name']} ({case['script']}) ---")
        print(f"Image: {case['image_path']}")
        
        try:
            result = run_vlm_analysis(
                image_path=case['image_path'],
                stele_name=case['name'],
                script_type=case['script'],
                provider="gemini"
            )
            print(f"SUCCESS: Detected {result['total_detected']} characters.")
            results.append(result)
            
            out_path = f"test_output/test_{case['name']}.json"
            os.makedirs("test_output", exist_ok=True)
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"Result saved to: {out_path}")
            
        except Exception as e:
            print(f"FAILED: {str(e)}")
            # Detailed error check to help debugging
            if "GOOGLE_API_KEY" in str(e) or "GOOGLE_API_KEY not found" in str(e):
                print("Stopping test: Missing GOOGLE_API_KEY.")
                break
        print("\n")

if __name__ == "__main__":
    run_comprehensive_test()