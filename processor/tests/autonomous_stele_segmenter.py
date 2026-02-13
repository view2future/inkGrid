import os
import sys
import json
import PIL.Image
from typing import List, Dict, Any

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_region_analysis

def calculate_iou(box1, box2):
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    inter_x1 = max(x1, x2)
    inter_y1 = max(y1, y2)
    inter_x2 = min(x1 + w1, x2 + w2)
    inter_y2 = min(y1 + h1, y2 + h2)
    if inter_x2 < inter_x1 or inter_y2 < inter_y1:
        return 0.0
    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    area1, area2 = w1 * h1, w2 * h2
    return inter_area / float(area1 + area2 - inter_area)

def process_image_autonomously(image_path: str, stele_id: str, output_dir: str):
    print("Processing: {}".format(image_path))
    if not os.path.exists(image_path): return []
    with PIL.Image.open(image_path) as img:
        width, height = img.size
    cols, rows = 6, 4
    tile_w, tile_h = width // cols, height // rows
    raw_detections = []
    for c in range(cols):
        for r in range(rows):
            left = width - (c + 1) * tile_w
            if c == cols - 1: left = 0
            top = r * tile_h
            region_bbox = [left, top, tile_w if left > 0 else width // cols, tile_h]
            try:
                result = run_vlm_region_analysis(
                    image_path=image_path,
                    region_bbox=region_bbox,
                    stele_name="discovery",
                    script_type="小篆",
                    provider="gemini"
                )
                raw_detections.extend(result['characters'])
            except:
                pass
    unique_chars = []
    for det in raw_detections:
        is_duplicate = False
        for existing in unique_chars:
            if calculate_iou(det['bbox'], existing['bbox']) > 0.4:
                is_duplicate = True
                break
        if not is_duplicate: unique_chars.append(det)
    unique_chars.sort(key=lambda x: (-x['bbox'][0], x['bbox'][1]))
    results = []
    with PIL.Image.open(image_path) as img:
        for i, char in enumerate(unique_chars, 1):
            simplified, original = char['char'], char['original']
            x, y, w, h = char['bbox']
            try:
                crop = img.crop((max(0, x), max(0, y), min(width, x+w), min(height, y+h)))
                filename = "{}_{:03d}_{}_{}.jpg".format(stele_id, i, simplified, original)
                crop.save(os.path.join(output_dir, filename))
                results.append({"id": i, "simplified": simplified, "original": original, "file": filename})
            except: pass
    print("Found {} chars in {}.".format(len(results), stele_id))
    return results

def main():
    target_images = [
        ("steles/1-zhuanshu/1-yishankeshi/yishan.jpg", "yishan_p1"),
        ("steles/1-zhuanshu/1-yishankeshi/yishan2.jpg", "yishan_p2")
    ]
    output_base = "autonomous_export"
    if os.path.exists(output_base):
        import shutil
        shutil.rmtree(output_base)
    os.makedirs(output_base, exist_ok=True)
    report = {}
    for path, sid in target_images:
        report[sid] = process_image_autonomously(path, sid, output_base)
    with open("autonomous_segmentation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()