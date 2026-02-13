import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_analysis
from processor.core.knowledge import TextVault

def perform_full_segmentation():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "峄山刻石"
    output_dir = "exported_characters"
    
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    vault = TextVault()
    gt_text = vault.fetch_text(stele_name)

    try:
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name=stele_name,
            script_type="小篆",
            use_ground_truth=True,
            max_chars=135,
            provider="gemini"
        )
        
        detected_chars = result['characters']
        
        with PIL.Image.open(image_path) as img:
            width, height = img.size
            exported_count = 0
            for i, char_data in enumerate(detected_chars):
                simplified = char_data['char']
                original = char_data['original']
                gt_char = gt_text[i] if i < len(gt_text) else simplified
                
                bbox = char_data['bbox'] 
                x, y, w, h = bbox
                
                l, t, r, b = max(0, x), max(0, y), min(width, x+w), min(height, y+h)
                
                try:
                    char_img = img.crop((l, t, r, b))
                    filename = "{:03d}_{}_{}.jpg".format(i+1, gt_char, original)
                    save_path = os.path.join(output_dir, filename)
                    char_img.save(save_path, quality=95)
                    exported_count += 1
                except Exception:
                    pass
        
        print("Success: Exported {} characters.".format(exported_count))
        
    except Exception as e:
        print("Error: {}".format(e))

if __name__ == "__main__":
    perform_full_segmentation()