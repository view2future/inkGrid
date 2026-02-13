import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis

def segment_by_columns():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "yishan"
    output_dir = "exported_characters"
    os.makedirs(output_dir, exist_ok=True)
    
    with PIL.Image.open(image_path) as full_img:
        width, height = full_img.size
        print("Processing {} ({}x{})".format(image_path, width, height))

    num_cols = 5
    col_width = width // num_cols
    
    all_characters = []
    
    print("Step 1: Segmenting {} columns with Gemini...".format(num_cols))
    for i in range(num_cols):
        left = width - (i + 1) * col_width
        if i == num_cols - 1: left = 0
        
        region_bbox = [left, 0, col_width if left > 0 else width // num_cols, height]
        
        print("Analyzing Column {} (Right-to-Left)...".format(i+1))
        try:
            result = run_vlm_region_analysis(
                image_path=image_path,
                region_bbox=region_bbox,
                stele_name="yishan_col{}".format(i+1),
                script_type="小篆",
                provider="gemini"
            )
            for char in result['characters']:
                char['actual_col'] = i + 1
            
            all_characters.extend(result['characters'])
            print("Column {}: Detected {} characters.".format(i+1, len(result['characters'])))
        except Exception as e:
            print("Error in Column {}: {}".format(i+1, e))

    all_characters.sort(key=lambda x: (x['actual_col'], x['bbox'][1]))
    
    print("\nStep 2: Exporting {} character images...".format(len(all_characters)))
    mapping_data = []
    
    with PIL.Image.open(image_path) as img:
        for i, char_data in enumerate(all_characters, 1):
            char_id = "{:04d}".format(i)
            simplified = char_data['char']
            original = char_data['original']
            bbox = char_data['bbox'] 
            
            try:
                x, y, w, h = bbox
                padding = 5
                l = max(0, x - padding)
                t = max(0, y - padding)
                r = min(width, x + w + padding)
                b = min(height, y + h + padding)
                
                char_img = img.crop((l, t, r, b))
                
                filename = "{}_{}_{}.jpg".format(stele_name, char_id, simplified)
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
                print("Failed to export char {}: {}".format(i, e))

    with open("yishan_segmentation_result.json", "w", encoding="utf-8") as f:
        json.dump(mapping_data, f, ensure_ascii=False, indent=2)
    
    print("DONE! Exported {} characters to {}/".format(len(mapping_data), output_dir))

if __name__ == "__main__":
    segment_by_columns()