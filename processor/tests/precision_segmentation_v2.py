import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis
from processor.core.knowledge import TextVault

def precision_segmentation_v2():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "峄山刻石"
    output_dir = "exported_characters"
    os.makedirs(output_dir, exist_ok=True)
    
    with PIL.Image.open(image_path) as full_img:
        width, height = full_img.size

    # 我们这次只跑第一行（右侧第一列），先验证效果
    # 3行 x 5列。c=0 是最右侧。
    rows = 3
    cols = 5
    tile_w = width // cols
    tile_h = height // rows
    
    print("Starting precision export...")
    
    with PIL.Image.open(image_path) as img:
        count = 0
        # 遍历所有网格
        for c in range(cols):
            for r in range(rows):
                left = width - (c + 1) * tile_w
                if c == cols - 1: left = 0
                top = r * tile_h
                region_bbox = [left, top, tile_w if left > 0 else width // cols, tile_h]
                
                try:
                    print("Processing Grid C{} R{}...".format(c, r))
                    result = run_vlm_region_analysis(
                        image_path=image_path,
                        region_bbox=region_bbox,
                        stele_name="yishan",
                        script_type="小篆",
                        provider="gemini"
                    )
                    
                    # 识别完立即保存
                    for char in result['characters']:
                        count += 1
                        simplified = char['char']
                        original = char['original']
                        bbox = char['bbox'] 
                        
                        x, y, w, h = bbox
                        char_img = img.crop((max(0, x), max(0, y), min(width, x+w), min(height, y+h)))
                        
                        # 临时命名，稍后统一排序
                        filename = "tmp_c{}_r{}_{}_{:04d}.jpg".format(c, r, simplified, count)
                        char_img.save(os.path.join(output_dir, filename))
                    
                    print("Grid C{} R{}: Exported {} chars.".format(c, r, len(result['characters'])))
                except Exception as e:
                    print("Error: {}".format(e))
    
    print("Total exported: {}".format(count))

if __name__ == "__main__":
    precision_segmentation_v2()
