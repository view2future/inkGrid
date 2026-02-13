import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis
from processor.core.knowledge import TextVault

def precision_segmentation():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "峄山刻石"
    output_dir = "exported_characters"
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    vault = TextVault()
    gt_text = vault.fetch_text(stele_name)

    with PIL.Image.open(image_path) as full_img:
        width, height = full_img.size

    rows = 3
    cols = 5
    tile_w = width // cols
    tile_h = height // rows
    
    all_raw_chars = []
    
    for r in range(rows):
        for c in range(cols):
            left = width - (c + 1) * tile_w
            if c == cols - 1: left = 0
            top = r * tile_h
            region_bbox = [left, top, tile_w if left > 0 else width // cols, tile_h]
            
            try:
                result = run_vlm_region_analysis(
                    image_path=image_path,
                    region_bbox=region_bbox,
                    stele_name="yishan_r{}c{}".format(r, c),
                    script_type="小篆",
                    provider="gemini"
                )
                for char in result['characters']:
                    char['grid_r'] = r
                    char['grid_c'] = c
                    all_raw_chars.append(char)
            except Exception:
                pass

    # 排序逻辑：先按列从右到左，再按行从上到下
    all_raw_chars.sort(key=lambda x: (x['grid_c'], x['bbox'][1]))
    
    final_data = []
    with PIL.Image.open(image_path) as img:
        for i, char_data in enumerate(all_raw_chars):
            simplified = char_data['char']
            original = char_data['original']
            gt_char = gt_text[i] if i < len(gt_text) else simplified
            bbox = char_data['bbox'] 
            
            try:
                x, y, w, h = bbox
                char_img = img.crop((max(0, x-1), max(0, y-1), min(width, x+w+1), min(height, y+h+1)))
                filename = "{:03d}_{}_{}.jpg".format(i+1, gt_char, original)
                save_path = os.path.join(output_dir, filename)
                char_img.save(save_path)
                final_data.append({"id": i+1, "gt": gt_char, "file": filename})
            except Exception:
                pass

    with open("yishan_final_report.json", "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    
    print("DONE: Detected {} chars. Files in '{}'".format(len(final_data), output_dir))

if __name__ == "__main__":
    precision_segmentation()