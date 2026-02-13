import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis

def calculate_iou(box1, box2):
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    inter_x1, inter_y1 = max(x1, x2), max(y1, y2)
    inter_x2, inter_y2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
    if inter_x2 < inter_x1 or inter_y2 < inter_y1: return 0.0
    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    area1, area2 = w1 * h1, w2 * h2
    return inter_area / float(area1 + area2 - inter_area)

def scan_tile(args):
    path, bbox, sid = args
    try:
        res = run_vlm_region_analysis(path, bbox, sid, "小篆", provider="gemini")
        return res['characters']
    except:
        return []

def process_image_parallel(image_path: str, stele_id: str, output_dir: str):
    print("Parallel processing: {}".format(image_path))
    with PIL.Image.open(image_path) as img:
        width, height = img.size
    
    cols, rows = 6, 4
    tile_w, tile_h = width // cols, height // rows
    tasks = []
    
    for c in range(cols):
        for r in range(rows):
            left = width - (c + 1) * tile_w
            if c == cols - 1: left = 0
            top = r * tile_h
            bbox = [left, top, tile_w if left > 0 else width // cols, tile_h]
            tasks.append((image_path, bbox, stele_id))
    
    # 使用 8 个并发线程
    raw_detections = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(scan_tile, tasks))
        for res in results:
            raw_detections.extend(res)
    
    # 去重与排序
    unique_chars = []
    for det in raw_detections:
        if not any(calculate_iou(det['bbox'], ex['bbox']) > 0.4 for ex in unique_chars):
            unique_chars.append(det)
    
    unique_chars.sort(key=lambda x: (-x['bbox'][0], x['bbox'][1]))
    
    final_results = []
    with PIL.Image.open(image_path) as img:
        for i, char in enumerate(unique_chars, 1):
            s, o, b = char['char'], char['original'], char['bbox']
            try:
                crop = img.crop((max(0, b[0]), max(0, b[1]), min(width, b[0]+b[2]), min(height, b[1]+b[3])))
                filename = "{}_{:03d}_{}_{}.jpg".format(stele_id, i, s, o)
                crop.save(os.path.join(output_dir, filename))
                final_results.append({"id": i, "simplified": s, "original": o, "file": filename})
            except: pass
    
    print("Found {} unique chars.".format(len(final_results)))
    return final_results

def main():
    target = [
        ("steles/1-zhuanshu/1-yishankeshi/yishan.jpg", "yishan_p1"),
        ("steles/1-zhuanshu/1-yishankeshi/yishan2.jpg", "yishan_p2")
    ]
    out = "autonomous_export"
    if os.path.exists(out):
        import shutil
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)
    
    report = {}
    for p, s in target:
        report[s] = process_image_parallel(p, s, out)
    
    with open("parallel_segmentation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
