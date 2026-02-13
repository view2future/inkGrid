#!/usr/bin/env python3
"""
完整的碑帖处理脚本 - VLM识别 + 精确切分

Usage:
    export KIMI_API_KEY="your-api-key"
    python process_stele.py --input ../steles/1-zhuanshu/1-yishankeshi/yishan.jpg --name "峄山刻石" --script "小篆"
"""

import os
import sys
import argparse
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.slicer import process_stele_image
from core.inference import run_vlm_analysis
from core.vlm_client import VLMClient


def main():
    parser = argparse.ArgumentParser(description='Process stele image with VLM and slice characters')
    parser.add_argument('--input', '-i', required=True, help='Input stele image path')
    parser.add_argument('--name', '-n', required=True, help='Stele name (e.g., 峄山刻石)')
    parser.add_argument('--script', '-s', default='篆书', help='Script type (篆书/隶书/楷书)')
    parser.add_argument('--output', '-o', default='./output', help='Output directory')
    parser.add_argument('--no-viz', action='store_true', help='Skip visualization')
    parser.add_argument('--save-json', action='store_true', default=True, help='Save JSON result')
    
    args = parser.parse_args()
    
    # Check API key
    api_key = os.getenv('KIMI_API_KEY')
    if not api_key:
        print("Error: KIMI_API_KEY environment variable not set")
        print("Get your API key from: https://platform.moonshot.cn/")
        sys.exit(1)
    
    # Check input file
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
    
    # Create output directory
    output_dir = Path(args.output) / args.name.replace('《', '').replace('》', '')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*70}")
    print(f"InkGrid Stele Processor")
    print(f"{'='*70}")
    print(f"Input: {args.input}")
    print(f"Stele: {args.name}")
    print(f"Script: {args.script}")
    print(f"Output: {output_dir}")
    print(f"{'='*70}\n")
    
    try:
        # Process the stele
        result = process_stele_image(
            image_path=args.input,
            stele_name=args.name,
            script_type=args.script,
            output_dir=str(output_dir),
            create_viz=not args.no_viz
        )
        
        print(f"\n{'='*70}")
        print(f"Processing Complete!")
        print(f"{'='*70}")
        print(f"Total characters: {result['total_chars']}")
        print(f"Output directory: {result['output_dir']}")
        print(f"Sliced images: {len(result['sliced_images'])}")
        if result['visualization']:
            print(f"Visualization: {result['visualization']}")
        print(f"Analysis file: {result['analysis_file']}")
        
        # Show first 5 characters
        print(f"\nFirst 5 characters:")
        with open(result['analysis_file'], 'r', encoding='utf-8') as f:
            data = json.load(f)
            for char in data['characters'][:5]:
                print(f"  {char['index']:3d}. {char['original']} ({char['char']}) - {char['sliced_image']}")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ Processing failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
