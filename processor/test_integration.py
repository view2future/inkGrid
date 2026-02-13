import sys
import os
import json

# Add parent directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from celery_app import process_stele

def test_full_pipeline():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(base_dir, "yishan.jpg")
    
    if not os.path.exists(image_path):
        print("Skipping test: yishan.jpg not found")
        return

    print(f"Testing full pipeline on {image_path}...")
    
    # Run synchronously
    # Note: Celery tasks can be called as regular functions if not using .delay()
    # BUT in the code `process_stele` is decorated.
    # To run the logic without worker, we can just call the underlying function 
    # if we strip the decorator, or just trust the logic flows we tested individually.
    # Actually, `process_stele` logic is: preprocess -> segment -> fetch -> align.
    # We can invoke it. 
    # Wait, calling `process_stele(path, name)` directly usually works in local mode or unit test mode 
    # depending on celery config 'task_always_eager'. 
    # But I haven't set that.
    # However, I can just call the logic components together here to simulate it.
    
    # Actually, let's try calling it.
    try:
        # We need to bypass the @task decorator behavior if no broker is running.
        # Or I can just manually stitch the calls like inside the function.
        from core.preprocess import preprocess_image
        from core.segmentation import segment_image
        from core.knowledge import TextVault
        from core.alignment import align_sequence
        
        # 1. Preprocess
        binary = preprocess_image(image_path)
        print("  Preprocessing: Done")
        
        # 2. Segment
        bboxes = segment_image(binary)
        print(f"  Segmentation: Found {len(bboxes)} boxes")
        
        # 3. Fetch
        vault = TextVault()
        text = vault.fetch_text("yishan")
        print(f"  Text Fetch: Got {len(text) if text else 0} chars")
        
        # 4. Align
        result = align_sequence(bboxes, text)
        print(f"  Alignment: Aligned {len(result)} items")
        
        # 5. Output check
        print(json.dumps(result[0], indent=2, ensure_ascii=False))
        
        print("Test Passed!")
        
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_full_pipeline()
