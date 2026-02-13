import sys
import os
import cv2

# Add parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.segmentation import segment_image_paddle_with_gt
from core.knowledge import TextVault

def visualize(image_path, results, output_path):
    img = cv2.imread(image_path)
    if img is None: return
    
    for i, item in enumerate(results):
        x, y, w, h = item['bbox']
        # Draw box
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 2)
        # Draw Index and Char
        label = f"{i}:{item['char']}" if item['char'] else str(i)
        cv2.putText(img, label, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 0), 1)
        
    cv2.imwrite(output_path, img)

def test_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    stele_name = "yishan" if "yishan" in filepath.lower() else "caoquan"
    vault = TextVault()
    gt_text = vault.fetch_text(stele_name)

    print(f"Testing {filepath} with PaddleOCR + GT ({len(gt_text) if gt_text else 0} chars)...")
    try:
        results = segment_image_paddle_with_gt(filepath, gt_text)
        print(f"  Found {len(results)} characters.")
        
        # Visualize
        dirname = os.path.dirname(filepath)
        basename = os.path.basename(filepath)
        name, ext = os.path.splitext(basename)
        out_path = os.path.join(dirname, f"{name}_paddle_gt{ext}")
        
        visualize(filepath, results, out_path)
        print(f"  Saved visualization to {out_path}")
        
    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Yishan
    test_file(os.path.join(base_dir, "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"))
    
    # 2. Caoquan
    test_file(os.path.join(base_dir, "steles/2-lishu/1-caoquanbei/caoquanbei-001.jpg"))

if __name__ == "__main__":
    main()