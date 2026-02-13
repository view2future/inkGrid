import sys
import os
# Add parent directory to path to import core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.preprocess import preprocess_image

def test_preprocess():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, "yishan.jpg")
    output_path = os.path.join(base_dir, "yishan_binary.jpg")
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Processing {input_path}...")
    try:
        preprocess_image(input_path, output_path)
        print(f"Success! Output saved to {output_path}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_preprocess()
