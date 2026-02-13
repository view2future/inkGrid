#!/usr/bin/env python3
"""
Command-line tool for stele image analysis using KIMI VLM.

Usage:
    # Analyze single image
    export KIMI_API_KEY="your-api-key"
    python run_analysis.py --image /path/to/stele.jpg --name "峄山刻石" --script "小篆"
    
    # Batch process directory
    python run_analysis.py --batch /path/to/steles/ --output results.json
    
    # Analyze specific region
    python run_analysis.py --image stele.jpg --region 100,200,300,400 --name "碑帖"
"""

import os
import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.inference import run_vlm_analysis, run_vlm_region_analysis, batch_analyze_steles
from core.knowledge import text_vault


def analyze_single(args):
    """Analyze a single stele image."""
    print(f"Analyzing: {args.image}")
    print(f"  Stele: {args.name}")
    print(f"  Script: {args.script}")
    print(f"  Ground Truth: {'Yes' if args.use_gt else 'No'}")
    print("-" * 60)
    
    try:
        result = run_vlm_analysis(
            image_path=args.image,
            stele_name=args.name,
            script_type=args.script,
            use_ground_truth=args.use_gt,
            max_chars=args.max_chars
        )
        
        print(f"\n✓ Analysis Complete")
        print(f"  Characters detected: {result['total_detected']}")
        print(f"  Expected: {result['info']['total_characters']}")
        
        # Show sample characters
        if result['characters']:
            print(f"\n  First 5 characters:")
            for char in result['characters'][:5]:
                print(f"    {char['index']:3d}. {char['original']} ({char['char']}) [{char['pinyin']}]")
        
        # Save result
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n✓ Result saved to: {args.output}")
        
        return result
        
    except Exception as e:
        print(f"\n✗ Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def analyze_region(args):
    """Analyze a specific region of an image."""
    print(f"Analyzing region: {args.region}")
    
    try:
        bbox = [int(x) for x in args.region.split(',')]
        if len(bbox) != 4:
            raise ValueError("Region must be x,y,width,height")
        
        result = run_vlm_region_analysis(
            image_path=args.image,
            region_bbox=bbox,
            stele_name=args.name,
            script_type=args.script
        )
        
        print(f"\n✓ Region Analysis Complete")
        print(f"  Detected {result['total_detected']} characters")
        
        for char in result['characters']:
            print(f"    {char['index']}. {char['original']} ({char['char']})")
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n✓ Result saved to: {args.output}")
        
        return result
        
    except Exception as e:
        print(f"\n✗ Region analysis failed: {e}")
        return None


def analyze_batch(args):
    """Batch process multiple images."""
    directory = Path(args.batch)
    
    if not directory.is_dir():
        print(f"Error: Not a directory: {directory}")
        return
    
    # Find all images
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
        image_files.extend(directory.glob(ext))
    
    if not image_files:
        print(f"No images found in {directory}")
        return
    
    print(f"Found {len(image_files)} images to process")
    print("-" * 60)
    
    # Prepare batch data
    image_paths = []
    names = []
    scripts = []
    
    for img_path in sorted(image_files):
        image_paths.append(str(img_path))
        # Use filename as default name
        default_name = img_path.stem
        names.append(default_name)
        scripts.append(args.script)
        print(f"  {img_path.name}")
    
    print("-" * 60)
    
    # Process batch
    def progress_callback(current, total, result):
        print(f"  Progress: {current}/{total}", end='\r' if current < total else '\n')
    
    try:
        results = batch_analyze_steles(image_paths, names, scripts, progress_callback)
        
        # Summary
        successful = sum(1 for r in results if r['status'] == 'success')
        print(f"\n✓ Batch Complete: {successful}/{len(results)} successful")
        
        # Save results
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"✓ Results saved to: {args.output}")
        
        return results
        
    except Exception as e:
        print(f"\n✗ Batch processing failed: {e}")
        return None


def list_steles(args):
    """List available steles in knowledge base."""
    print("Available Steles in Knowledge Base:")
    print("-" * 60)
    
    steles = text_vault.list_available_steles()
    for stele in steles:
        print(f"  {stele['name']}")
        print(f"    Key: {stele['key']}")
        print(f"    Script: {stele['script_type']}")
        print(f"    Dynasty: {stele['dynasty']}")
        print(f"    Characters: {stele['total_chars']}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description='Analyze Chinese Calligraphy Stele images using KIMI VLM'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Single image analysis
    single_parser = subparsers.add_parser('analyze', help='Analyze a single image')
    single_parser.add_argument('--image', '-i', required=True, help='Path to image file')
    single_parser.add_argument('--name', '-n', default='未知碑帖', help='Stele name')
    single_parser.add_argument('--script', '-s', default='篆书', help='Script type (篆书/隶书/楷书)')
    single_parser.add_argument('--output', '-o', help='Output JSON file')
    single_parser.add_argument('--no-gt', action='store_true', help='Do not use ground truth')
    single_parser.add_argument('--max-chars', type=int, default=200, help='Max ground truth chars')
    
    # Region analysis
    region_parser = subparsers.add_parser('region', help='Analyze a region of an image')
    region_parser.add_argument('--image', '-i', required=True, help='Path to image file')
    region_parser.add_argument('--region', '-r', required=True, help='Region bbox: x,y,width,height')
    region_parser.add_argument('--name', '-n', default='未知碑帖', help='Stele name')
    region_parser.add_argument('--script', '-s', default='篆书', help='Script type')
    region_parser.add_argument('--output', '-o', help='Output JSON file')
    
    # Batch processing
    batch_parser = subparsers.add_parser('batch', help='Batch process images in directory')
    batch_parser.add_argument('--batch', '-b', required=True, help='Directory containing images')
    batch_parser.add_argument('--script', '-s', default='篆书', help='Script type')
    batch_parser.add_argument('--output', '-o', default='batch_results.json', help='Output JSON file')
    
    # List steles
    list_parser = subparsers.add_parser('list', help='List available steles in knowledge base')
    
    args = parser.parse_args()
    
    # Check API key
    if args.command and args.command != 'list':
        if not os.getenv('KIMI_API_KEY'):
            print("Error: KIMI_API_KEY environment variable not set")
            print("Get your API key from: https://platform.moonshot.cn/")
            sys.exit(1)
    
    # Route commands
    if args.command == 'analyze':
        args.use_gt = not args.no_gt
        analyze_single(args)
    elif args.command == 'region':
        analyze_region(args)
    elif args.command == 'batch':
        analyze_batch(args)
    elif args.command == 'list':
        list_steles(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
