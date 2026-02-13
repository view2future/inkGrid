import os
import json
import PIL.Image
from typing import List, Dict, Any, Optional
from .vlm_client import get_vlm_client

def run_yishan_extraction(image_path: str, provider: str = "gemini"):
    """
    全图透视：要求 AI 自主发现所有字符，不剪裁，不分列。
    """
    print(f"\n--- Discovering All Characters in {os.path.basename(image_path)} ---")
    client = get_vlm_client(provider=provider)
    
    # 我们将全图分成上下两半部分进行“大图透视”，以防字太小看不清
    with PIL.Image.open(image_path) as img:
        width, height = img.size
    
    parts = [
        [0, 0, width, height // 2], # 上半部
        [0, height // 2, width, height // 2] # 下半部
    ]
    
    all_final_chars = []
    
    for i, part in enumerate(parts):
        print(f"Analyzing Part {i+1}...")
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            with PIL.Image.open(image_path) as full_img:
                full_img.crop((part[0], part[1], part[0]+part[2], part[1]+part[3])).save(tmp.name, quality=100)
                tmp_path = tmp.name

        prompt = """你是金石专家。请识别图中的每一个汉字。
输出格式：序号 | [ymin, xmin, ymax, xmax] | 简体 | 原字
注意：坐标是相对于这张图片的归一化坐标 [0-1000]。
务必找出每一个可见的字，不要遗漏。"""

        try:
            raw = client.analyze_stele(tmp_path, prompt)
            for line in raw.strip().split('\n'):
                if '|' not in line: continue
                p = [s.strip() for s in line.split('|')]
                bbox = [int(v.strip()) for v in p[1].replace('[','').replace(']','').split(',')]
                
                # 全局坐标换算
                px_y = part[1] + int(bbox[0] * part[3] / 1000)
                px_x = part[0] + int(bbox[1] * part[2] / 1000)
                px_h = int((bbox[2] - bbox[0]) * part[3] / 1000)
                px_w = int((bbox[3] - bbox[1]) * part[2] / 1000)
                
                all_final_chars.append({
                    "char": p[2],
                    "original": p[3],
                    "bbox": [px_x, px_y, px_w, px_h]
                })
            os.remove(tmp_path)
        except: pass

    # 全局排序（从右往左，从上往下）
    all_final_chars.sort(key=lambda x: (-x['bbox'][0], x['bbox'][1]))
    for idx, c in enumerate(all_final_chars, 1): c['index'] = idx
    
    return all_final_chars

def run_library_guided_pipeline(image_path, stele_name, provider="gemini"):
    chars = run_yishan_extraction(image_path, provider)
    return {"characters": chars, "total_detected": len(chars)}
