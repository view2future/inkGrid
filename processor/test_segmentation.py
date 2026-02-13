import sys
import os
import cv2
import glob

# Add parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.preprocess import preprocess_image
from core.segmentation import segment_image

def visualize(image_path, bboxes, output_path):
    img = cv2.imread(image_path)
    if img is None: return
    for i, (x, y, w, h) in enumerate(bboxes):
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 2)
    cv2.imwrite(output_path, img)

def detect_script_type(filepath: str) -> str:
    """
    Simple heuristic or mapping based on filename/path to determine script type.
    """
    path_lower = filepath.lower()
    if 'zhuanshu' in path_lower or 'yishan' in path_lower or 'tai-shan' in path_lower:
        return 'zhuanshu'
    if 'lishu' in path_lower or 'caoquan' in path_lower or 'li-qi' in path_lower:
        return 'lishu'
    return 'kaishu' # Default

def test_file(filepath):
    if not os.path.exists(filepath):
        return

    script_type = detect_script_type(filepath)
    print(f"Testing {filepath} [{script_type}]...")
    
    try:
        binary = preprocess_image(filepath)
        bboxes = segment_image(binary, script_type=script_type)
        
        print(f"  Found {len(bboxes)} characters.")
        
        dirname = os.path.dirname(filepath)
        basename = os.path.basename(filepath)
        name, ext = os.path.splitext(basename)
        out_path = os.path.join(dirname, f"{name}_segmented{ext}")
        
        visualize(filepath, bboxes, out_path)
        print(f"  Saved visualization to {out_path}")
        
    except Exception as e:
        print(f"  Error: {e}")

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    steles_dir = os.path.join(base_dir, "steles")
    
    image_extensions = ['*.jpg', '*.jpeg', '*.png']
    files = []
    for ext in image_extensions:
        files.extend(glob.glob(os.path.join(steles_dir, '**', ext), recursive=True))
    
    target_files = [f for f in files if "_segmented" not in f and "_binary" not in f]
    
    if not target_files:
        print("No images found.")
        return

    for filepath in target_files:
        test_file(filepath)

if __name__ == "__main__":
    main()
