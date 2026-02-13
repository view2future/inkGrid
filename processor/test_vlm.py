#!/usr/bin/env python3
"""
Test script for VLM-based stele analysis using KIMI API.

Usage:
    export KIMI_API_KEY="your-api-key"
    python test_vlm.py
    
    # Or with custom API endpoint
    export KIMI_BASE_URL="https://api.moonshot.cn/v1"
    export KIMI_MODEL="moonshot-v1-8k-vision-preview"
"""

import os
import sys
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.inference import run_vlm_analysis, run_vlm_region_analysis
from core.vlm_client import VLMClient


def test_vlm_yishan():
    """Test VLM analysis on Yi Shan Ke Shi (峄山刻石)."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg")
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return False

    print(f"=" * 60)
    print(f"Testing VLM Analysis: 峄山刻石")
    print(f"Image: {image_path}")
    print(f"=" * 60)
    
    try:
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name="峄山刻石",
            script_type="小篆",
            use_ground_truth=True,
            max_chars=135  # Full text has 135 characters
        )
        
        print(f"\n✓ Analysis successful!")
        print(f"  Detected {result['total_detected']} characters")
        print(f"  Expected: {result['info']['total_characters']}")
        print(f"  Image dimensions: {result['image_dimensions']}")
        
        # Show first few characters
        if result['characters']:
            print(f"\n  First 3 characters:")
            for char in result['characters'][:3]:
                print(f"    {char['index']}. {char['original']} ({char['char']}) - {char['pinyin']}")
                print(f"       bbox: {char['bbox']}, row={char['row']}, col={char['col']}")
        
        # Show last few characters
        if len(result['characters']) > 3:
            print(f"\n  Last 3 characters:")
            for char in result['characters'][-3:]:
                print(f"    {char['index']}. {char['original']} ({char['char']}) - {char['pinyin']}")
        
        # Save result
        out_file = os.path.join(base_dir, "vlm_yishan_result.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Full result saved to: {out_file}")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_vlm_caoquan():
    """Test VLM analysis on Cao Quan Bei (曹全碑)."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Find first caoquan image
    caoquan_dir = os.path.join(base_dir, "steles/2-lishu/1-caoquanbei")
    image_path = None
    
    if os.path.exists(caoquan_dir):
        for f in sorted(os.listdir(caoquan_dir)):
            if f.endswith('.jpg') and not f.endswith('_segmented.jpg') and not f.endswith('_paddle.jpg'):
                image_path = os.path.join(caoquan_dir, f)
                break
    
    if not image_path:
        print(f"Error: No Cao Quan Bei image found")
        return False

    print(f"\n" + "=" * 60)
    print(f"Testing VLM Analysis: 曹全碑")
    print(f"Image: {image_path}")
    print(f"=" * 60)
    
    try:
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name="曹全碑",
            script_type="隶书",
            use_ground_truth=True,
            max_chars=100
        )
        
        print(f"\n✓ Analysis successful!")
        print(f"  Detected {result['total_detected']} characters")
        
        # Save result
        out_file = os.path.join(base_dir, "vlm_caoquan_result.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"✓ Result saved to: {out_file}")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_region_analysis():
    """Test region-specific analysis."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg")
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return False
    
    print(f"\n" + "=" * 60)
    print(f"Testing Region Analysis")
    print(f"=" * 60)
    
    # Analyze top-right region (first column)
    region = [400, 50, 100, 400]  # x, y, w, h
    
    try:
        result = run_vlm_region_analysis(
            image_path=image_path,
            region_bbox=region,
            stele_name="峄山刻石",
            script_type="小篆"
        )
        
        print(f"\n✓ Region analysis successful!")
        print(f"  Region: {region}")
        print(f"  Detected {result['total_detected']} characters")
        
        for char in result['characters'][:5]:
            print(f"    {char['index']}. {char['original']} ({char['char']})")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Region analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_connection():
    """Test basic API connectivity."""
    print(f"\n" + "=" * 60)
    print(f"Testing KIMI API Connection")
    print(f"=" * 60)
    
    try:
        client = VLMClient()
        print(f"✓ VLMClient initialized successfully")
        print(f"  Model: {client.model}")
        print(f"  Base URL: {client.base_url}")
        return True
    except Exception as e:
        print(f"✗ Failed to initialize VLMClient: {e}")
        return False


def main():
    """Run all tests."""
    # Check environment
    if not os.getenv("KIMI_API_KEY"):
        print("Error: KIMI_API_KEY environment variable is not set.")
        print("Please set it with: export KIMI_API_KEY='your-api-key'")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("VLM Stele Analysis Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1: API Connection
    results.append(("API Connection", test_api_connection()))
    
    # Test 2: Yi Shan Analysis
    results.append(("Yi Shan Analysis", test_vlm_yishan()))
    
    # Test 3: Cao Quan Analysis (optional)
    # results.append(("Cao Quan Analysis", test_vlm_caoquan()))
    
    # Test 4: Region Analysis (optional)
    # results.append(("Region Analysis", test_region_analysis()))
    
    # Summary
    print(f"\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
