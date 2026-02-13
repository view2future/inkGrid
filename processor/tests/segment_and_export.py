import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_analysis, run_vlm_region_analysis

def segment_and_export_yishan():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "yishan"
    output_dir = "exported_characters"
    os.makedirs(output_dir, exist_ok=True)
    
    with PIL.Image.open(image_path) as full_img:
        width, height = full_img.size
        print(f"Processing {image_path} ({width}x{height})")

    regions = [
        [0, 0, width, height // 2],
        [0, height // 2, width, height // 2]
    ]
    
    all_characters = []
    
    print("Step 1: Segmenting regions with Gemini...")
    for i, bbox in enumerate(regions):
        print(f"Analyzing Region {i+1}...")
        try:
            result = run_vlm_region_analysis(
                image_path=image_path,
                region_bbox=bbox,
                stele_name=f"yishan_p{i+1}",
                script_type="小篆",
                provider="gemini"
            )
            all_characters.extend(result['characters'])
            print(f"Region {i+1}: Detected {len(result['characters'])} characters.")
        except Exception as e:
            print(f"Error in Region {i+1}: {e}")

    # Sorting
    all_characters.sort(key=lambda x: (-x['row'], x['bbox'][1]))
    
    print(f"\nStep 2: Exporting {len(all_characters)} character images...")
    mapping_data = []
    
    with PIL.Image.open(image_path) as img:
        for i, char_data in enumerate(all_characters, 1):
            char_id = f"{i:04d}"
            simplified = char_data['char']
            original = char_data['original']
            bbox = char_data['bbox'] 
            
            try:
                x, y, w, h = bbox
                left = max(0, x)
                top = max(0, y)
                right = min(width, x + w)
                bottom = min(height, y + h)
                
                char_img = img.crop((left, top, right, bottom))
                
                filename = f"{stele_name}_{char_id}_{simplified}.jpg"
                save_path = os.path.join(output_dir, filename)
                char_img.save(save_path, quality=95)
                
                mapping_data.append({
                    "index": i,
                    "original": str(original),
                    "simplified": str(simplified),
                    "pinyin": char_data.get('pinyin', ''),
                    "file_path": save_path
                })
            except Exception as e:
                print(f"Failed to export char {i}: {e}")

    with open("yishan_segmentation_result.json", "w", encoding="utf-8") as f:
        json.dump(mapping_data, f, ensure_ascii=False, indent=2)
    
    print(f"DONE! Exported characters to {output_dir}/")

if __name__ == "__main__":
    if not os.getenv("GOOGLE_API_KEY"):
        print("Error: GOOGLE_API_KEY not found.")
    else:
        segment_and_export_yishan()