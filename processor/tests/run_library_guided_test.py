import os
import sys
import json
import PIL.Image

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from processor.core.vlm_client import get_vlm_client
from processor.core.knowledge import vault

def main():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "峄山刻石"
    output_dir = "final_perfect_export"
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. 加载库中全文
    gt_full = vault.get_ground_truth(stele_name)
    # yishan.jpg 是前半部分，约 135 字
    gt_text = gt_full[:135]
    print(f"Aligning against ground truth: {gt_text[:10]}...")

    client = get_vlm_client(provider="gemini")
    with PIL.Image.open(image_path) as img:
        w, h = img.size

    # 2. 分批请求，确保一个字不少
    batch_size = 30
    all_chars = []
    for i in range(0, len(gt_text), batch_size):
        batch = gt_text[i:i+batch_size]
        prompt = f"""你是金石专家。请精确定位这{len(batch)}个字。
待定位字：{batch}
输出：序号 | [ymin, xmin, ymax, xmax] | 字
注意：坐标全局归一化 [0-1000]。"""
        
        try:
            raw = client.analyze_stele(image_path, prompt)
            for line in raw.strip().split('\n'):
                if '|' not in line: continue
                parts = [p.strip() for p in line.split('|')]
                bbox_str = parts[1].replace('[', '').replace(']', '')
                ymin, xmin, ymax, xmax = [int(v.strip()) for v in bbox_str.split(',')]
                
                all_chars.append({
                    "char": parts[2],
                    "bbox": [int(xmin*w/1000), int(ymin*h/1000), int((xmax-xmin)*w/1000), int((ymax-ymin)*h/1000)]
                })
        except: pass

    # 3. 导出
    with PIL.Image.open(image_path) as img:
        for idx, char in enumerate(all_chars, 1):
            x, y, w, h = char['bbox']
            img.crop((max(0, x), max(0, y), min(img.width, x+w), min(img.height, y+h))).save(
                os.path.join(output_dir, f"{idx:03d}_{char['char']}.jpg"), quality=95
            )
            
    print(f"DONE! Exported {len(all_chars)} perfect slices to '{output_dir}'.")

if __name__ == "__main__":
    main()