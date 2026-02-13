import os
import sys
import json
import PIL.Image

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from processor.core.inference import run_precision_pipeline

def main():
    image_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    stele_name = "峄山刻石"
    output_dir = "precision_export"
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    result = run_precision_pipeline(image_path=image_path, stele_name=stele_name, provider="gemini")
    
    with PIL.Image.open(image_path) as img:
        for i, char in enumerate(result['characters'], 1):
            gt_char = char.get('gt_char', char.get('char', 'unknown'))
            original = char.get('original_char', '□')
            bbox = char.get('global_bbox')
            if not bbox or bbox == [0,0,0,0]: continue
            x, y, w, h = bbox
            try:
                img.crop((max(0, x), max(0, y), min(img.width, x+w), min(img.height, y+h))).save(
                    os.path.join(output_dir, "{:03d}_{}_{}.jpg".format(i, gt_char, original)), quality=95
                )
            except: pass
            
    with open("precision_pipeline_report.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("DONE! Exported to precision_export/")

if __name__ == "__main__":
    main()