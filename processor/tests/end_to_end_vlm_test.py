import os
import sys
import json
import PIL.Image

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from processor.core.inference import run_vlm_analysis

def run_end_to_end_test():
    image_paths = [
        "steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
        "steles/1-zhuanshu/1-yishankeshi/yishan2.jpg"
    ]
    output_dir = "end_to_end_export"
    os.makedirs(output_dir, exist_ok=True)
    
    for path in image_paths:
        name = os.path.basename(path)
        print("Analyzing: {}".format(name))
        try:
            result = run_vlm_analysis(
                image_path=path,
                stele_name="峄山刻石",
                script_type="小篆",
                use_ground_truth=False,
                provider="kimi"
            )
            print("Detected {} chars.".format(len(result['characters'])))
            with open(os.path.join(output_dir, "{}.json".format(name)), "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            with PIL.Image.open(path) as img:
                for i, char in enumerate(result['characters']):
                    x, y, w, h = char['bbox']
                    img.crop((max(0, x), max(0, y), min(img.width, x+w), min(img.height, y+h))).save(
                        os.path.join(output_dir, "{}_char_{:03d}_{}.jpg".format(name, i+1, char['char']))
                    )
        except Exception as e:
            print("Error: {}".format(e))

if __name__ == "__main__":
    run_end_to_end_test()