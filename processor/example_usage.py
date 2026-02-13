#!/usr/bin/env python3
"""
Example usage of InkGrid VLM Processor with KIMI API.

This script demonstrates how to use the VLM-based stele analysis.
Note: Requires KIMI_API_KEY environment variable to be set.
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def example_1_basic_usage():
    """Example 1: Basic stele analysis."""
    print("=" * 60)
    print("Example 1: Basic Stele Analysis")
    print("=" * 60)
    
    from core.inference import run_vlm_analysis
    
    # Path to stele image
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg")
    
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        return
    
    print(f"Analyzing: {image_path}")
    print("This may take 30-60 seconds...")
    print()
    
    try:
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name="峄山刻石",
            script_type="小篆",
            use_ground_truth=True
        )
        
        print(f"✓ Analysis Complete!")
        print(f"  Detected: {result['total_detected']} characters")
        print(f"  Expected: {result['info']['total_characters']}")
        print()
        
        # Show first 3 characters
        print("First 3 characters:")
        for char in result['characters'][:3]:
            print(f"  {char['index']}. {char['original']} ({char['char']}) - {char['pinyin']}")
            print(f"     Definition: {char['definition']}")
            print(f"     Position: row={char['row']}, col={char['col']}, bbox={char['bbox']}")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        print("Make sure KIMI_API_KEY is set correctly")


def example_2_region_analysis():
    """Example 2: Analyze a specific region."""
    print()
    print("=" * 60)
    print("Example 2: Region-specific Analysis")
    print("=" * 60)
    
    from core.inference import run_vlm_region_analysis
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg")
    
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        return
    
    # Analyze top-right region (first column)
    region_bbox = [400, 50, 100, 400]  # x, y, w, h in pixels
    
    print(f"Analyzing region: {region_bbox}")
    print("This is useful for re-analyzing poorly detected areas")
    print()
    
    try:
        result = run_vlm_region_analysis(
            image_path=image_path,
            region_bbox=region_bbox,
            stele_name="峄山刻石",
            script_type="小篆"
        )
        
        print(f"✓ Region Analysis Complete!")
        print(f"  Detected: {result['total_detected']} characters")
        print()
        
        for char in result['characters']:
            print(f"  {char['index']}. {char['original']} ({char['char']})")
        
    except Exception as e:
        print(f"✗ Error: {e}")


def example_3_batch_processing():
    """Example 3: Batch process multiple images."""
    print()
    print("=" * 60)
    print("Example 3: Batch Processing")
    print("=" * 60)
    
    from core.inference import batch_analyze_steles
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Prepare batch data
    image_paths = [
        os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"),
    ]
    
    # Filter existing images
    image_paths = [p for p in image_paths if os.path.exists(p)]
    
    if not image_paths:
        print("No images found for batch processing")
        return
    
    names = ["峄山刻石"]
    scripts = ["小篆"]
    
    print(f"Batch processing {len(image_paths)} images...")
    print()
    
    def progress_callback(current, total, result):
        print(f"  Progress: {current}/{total}", end='\r' if current < total else '\n')
    
    try:
        results = batch_analyze_steles(image_paths, names, scripts, progress_callback)
        
        print(f"✓ Batch Complete!")
        for r in results:
            status = "✓" if r['status'] == 'success' else "✗"
            print(f"  {status} {r['stele_name']}: {r.get('error', 'OK')}")
        
    except Exception as e:
        print(f"✗ Error: {e}")


def example_4_knowledge_base():
    """Example 4: Query knowledge base."""
    print()
    print("=" * 60)
    print("Example 4: Knowledge Base Query")
    print("=" * 60)
    
    from core.knowledge import text_vault
    
    # List available steles
    print("Available steles:")
    steles = text_vault.list_available_steles()
    for s in steles:
        print(f"  - {s['name']} ({s['script_type']}, {s['dynasty']}, {s['total_chars']} chars)")
    
    print()
    
    # Fetch specific stele info
    info = text_vault.fetch_info("峄山刻石")
    if info:
        print(f"Details for 峄山刻石:")
        print(f"  Dynasty: {info['dynasty']}")
        print(f"  Author: {info['author']}")
        print(f"  Description: {info['description']}")
        print(f"  Text preview: {info['text'][:50]}...")


def example_5_api_server():
    """Example 5: Using the API server."""
    print()
    print("=" * 60)
    print("Example 5: API Server Usage")
    print("=" * 60)
    
    print("""
1. Start Redis:
   $ redis-server

2. Start Celery Worker:
   $ cd processor
   $ celery -A celery_app worker --loglevel=info

3. Start API Server:
   $ uvicorn main:app --reload

4. Submit analysis task:
   $ curl -X POST "http://localhost:8000/v1/tasks/segment" \\
       -F "file=@yishan.jpg" \\
       -F "stele_name=峄山刻石" \\
       -F "script_type=小篆"

5. Check task status:
   $ curl "http://localhost:8000/v1/tasks/{task_id}"

6. Get result:
   $ curl "http://localhost:8000/v1/tasks/{task_id}/result"
""")


def main():
    """Run all examples."""
    
    # Check API key
    api_key = os.getenv('KIMI_API_KEY')
    if not api_key:
        print("=" * 60)
        print("WARNING: KIMI_API_KEY environment variable not set")
        print("=" * 60)
        print()
        print("To run these examples, you need a KIMI API key.")
        print("Get one at: https://platform.moonshot.cn/")
        print()
        print("Then set it with:")
        print("  export KIMI_API_KEY='your-api-key'")
        print()
        print("Running in demo mode (showing code structure only)...")
        print()
    else:
        print(f"✓ KIMI_API_KEY is set (length: {len(api_key)})")
        print()
    
    # Run examples
    examples = [
        ("Knowledge Base", example_4_knowledge_base),
        ("Basic Analysis", example_1_basic_usage),
        ("Region Analysis", example_2_region_analysis),
        ("Batch Processing", example_3_batch_processing),
        ("API Server", example_5_api_server),
    ]
    
    if not api_key:
        # Only run knowledge base example without API key
        examples = [examples[0], examples[-1]]
    
    for name, func in examples:
        try:
            func()
        except Exception as e:
            print(f"Error in {name}: {e}")
    
    print()
    print("=" * 60)
    print("Examples completed!")
    print("=" * 60)
    print()
    print("For more information, see README.md")


if __name__ == '__main__':
    main()
