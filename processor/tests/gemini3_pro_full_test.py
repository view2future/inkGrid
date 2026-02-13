import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_analysis

def run_gemini3_pro_task():
    image_paths = [
        "steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
        "steles/1-zhuanshu/1-yishankeshi/yishan2.jpg"
    ]
    
    output_dir = "gemini3_pro_results"
    os.makedirs(output_dir, exist_ok=True)
    
    for path in image_paths:
        name = os.path.basename(path)
        print("Starting Gemini 3 Pro Analysis for {}".format(name))
        
        try:
            # 端到端全图分析
            result = run_vlm_analysis(
                image_path=path,
                stele_name="峄山刻石",
                script_type="小篆",
                use_ground_truth=False, # 盲测模式
                provider="gemini"
            )
            
            # 保存结构化结果
            json_save_path = os.path.join(output_dir, "{}.json".format(name))
            with open(json_save_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            
            # 导出图片
            with PIL.Image.open(path) as img:
                width, height = img.size
                for i, char in enumerate(result['characters']):
                    # 命名：序号_简体_原文.jpg
                    char_name = "{:03d}_{}_{}.jpg".format(i+1, char['char'], char['original'])
                    save_path = os.path.join(output_dir, "{}_{}".format(name, char_name))
                    
                    x, y, w, h = char['bbox']
                    # 确保坐标在图像范围内
                    l, t, r, b = max(0, x), max(0, y), min(width, x+w), min(height, y+h)
                    
                    try:
                        crop = img.crop((l, t, r, b))
                        crop.save(save_path, quality=95)
                    except:
                        pass
            
            print("Successfully processed {}. Found {} characters.".format(name, len(result['characters'])))
            
        except Exception as e:
            print("Failed for {}: {}".format(name, e))

if __name__ == "__main__":
    # 确保 API 密钥已设置
    run_gemini3_pro_task()
