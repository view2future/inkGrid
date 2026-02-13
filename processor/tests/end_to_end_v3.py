import os
import sys
import json
import PIL.Image

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from processor.core.inference import run_native_precision_pipeline

def main():
    image_paths = [
        "steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
        "steles/1-zhuanshu/1-yishankeshi/yishan2.jpg"
    ]
    output_dir = "v3_final_export"
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    for path in image_paths:
        name = os.path.basename(path)
        print("--- Native Analysis: {} ---".format(name))
        try:
            result = run_native_precision_pipeline(path)
            print("Successfully detected {} characters.".format(result['total_detected']))
            
            with PIL.Image.open(path) as img:
                for char in result['characters']:
                    idx = char['index']
                    s, o = char['char'], char['original']
                    x, y, w, h = char['bbox']
                    try:
                        filename = "{}_{:03d}_{}_{}.jpg".format(name.replace('.jpg',''), idx, s, o)
                        img.crop((max(0, x), max(0, y), min(img.width, x+w), min(img.height, y+h))).save(
                            os.path.join(output_dir, filename), quality=95
                        )
                    except: pass
        except Exception as e:
            print("Error: {}".format(e))

if __name__ == "__main__":
    main()