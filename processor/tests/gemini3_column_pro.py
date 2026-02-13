import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from processor.core.inference import run_vlm_region_analysis

def run_gemini3_column_pro():
    image_paths = [
        "steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
        "steles/1-zhuanshu/1-yishankeshi/yishan2.jpg"
    ]
    output_dir = "gemini3_final_export"
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    for path in image_paths:
        name = os.path.basename(path)
        print("Deep Scan: {}".format(name))
        with PIL.Image.open(path) as img:
            width, height = img.size
        
        num_cols = 5
        col_w = width // num_cols
        all_chars = []
        for i in range(num_cols):
            left = width - (i + 1) * col_w
            if i == num_cols - 1: left = 0
            region_bbox = [left, 0, col_w if left > 0 else width // num_cols, height]
            try:
                result = run_vlm_region_analysis(
                    image_path=path,
                    region_bbox=region_bbox,
                    stele_name="yishan",
                    script_type="小篆",
                    provider="gemini"
                )
                chars = result['characters']
                chars.sort(key=lambda x: x['bbox'][1])
                all_chars.extend(chars)
                print("Column {}: Found {} chars.".format(i+1, len(chars)))
            except Exception as e:
                print("Error: {}".format(e))

        with PIL.Image.open(path) as img:
            for idx, char_data in enumerate(all_chars, 1):
                s, o = char_data['char'], char_data['original']
                filename = "{}_{:03d}_{}_{}.jpg".format(name.replace(".jpg",""), idx, s, o)
                x, y, w, h = char_data['bbox']
                try:
                    img.crop((max(0, x), max(0, y), min(img.width, x+w), min(img.height, y+h))).save(
                        os.path.join(output_dir, filename), quality=95
                    )
                except: pass
        print("Total: {} chars for {}.".format(len(all_chars), name))

if __name__ == "__main__":
    run_gemini3_column_pro()