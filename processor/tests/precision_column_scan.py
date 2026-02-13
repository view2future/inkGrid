import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis
from processor.core.knowledge import TextVault

def perform_precision_scan():
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

    num_cols = 5
    col_w = width // num_cols
    all_final_chars = []
    
    print("Starting precision column scan...")
    
    for i in range(num_cols):
        left = width - (i + 1) * col_w
        if i == num_cols - 1: left = 0
        
        region_bbox = [left, 0, col_w if left > 0 else width // num_cols, height]
        print("Scanning Column {}...".format(i+1))
        
        try:
            result = run_vlm_region_analysis(
                image_path=image_path,
                region_bbox=region_bbox,
                stele_name=stele_name,
                script_type="小篆",
                provider="gemini"
            )
            chars = result['characters']
            chars.sort(key=lambda x: x['bbox'][1])
            all_final_chars.extend(chars)
            print("Detected {} chars.".format(len(chars)))
        except Exception as e:
            print("Error: {}".format(e))

    print("Exporting...")
    exported_count = 0
    with PIL.Image.open(image_path) as img:
        for i, char_data in enumerate(all_final_chars):
            gt_char = gt_text[i] if i < len(gt_text) else char_data['char']
            original = char_data['original']
            x, y, w, h = char_data['bbox']
            l, t, r, b = max(0, x), max(0, y), min(width, x+w), min(height, y+h)
            try:
                char_img = img.crop((l, t, r, b))
                filename = "{:03d}_{}_{}.jpg".format(i+1, gt_char, original)
                save_path = os.path.join(output_dir, filename)
                char_img.save(save_path, quality=95)
                exported_count += 1
            except Exception:
                pass
                
    print("DONE: Exported {} chars.".format(exported_count))

if __name__ == "__main__":
    perform_precision_scan()