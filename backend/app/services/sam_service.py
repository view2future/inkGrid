import os
from PIL import Image
import numpy as np
import uuid
from typing import List, Optional

# 尝试导入 SAM 和 PyTorch，并处理可能存在的 ImportError
try:
    from segment_anything import sam_model_registry, SamPredictor
    import torch
    SAM_AVAILABLE = True
    DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"SAM using device: {DEVICE}")
except ImportError:
    print("WARNING: SAM or PyTorch not installed. SAM features will be disabled.")
    SAM_AVAILABLE = False
    SamPredictor = None
    torch = None

# SAM 模型路径，需要预下载
SAM_CHECKPOINT = "sam_vit_h_4b8939.pth" # Or other models
SAM_MODEL_TYPE = "vit_h"

class SAMService:
    def __init__(self):
        self.predictor = None
        if SAM_AVAILABLE:
            try:
                sam_checkpoint_path = os.path.join(os.getcwd(), "models", SAM_CHECKPOINT)
                if not os.path.exists(sam_checkpoint_path):
                    print(f"WARNING: SAM checkpoint not found at {sam_checkpoint_path}. SAM features may not work.")
                    return
                    
                sam = sam_model_registry[SAM_MODEL_TYPE](checkpoint=sam_checkpoint_path)
                sam.to(device=DEVICE)
                self.predictor = SamPredictor(sam)
                print("SAM predictor initialized.")
            except Exception as e:
                print(f"ERROR: Failed to initialize SAM predictor: {e}")
                self.predictor = None

    def segment_image(self, image: Image.Image, bbox: List[int]) -> Optional[str]:
        if not SAM_AVAILABLE or self.predictor is None: 
            print("SAM not available or not initialized.")
            return None
            
        try:
            image_np = np.array(image)
            self.predictor.set_image(image_np)

            input_box = np.array(bbox)
            masks, _, _ = self.predictor.predict(
                point_coords=None,
                point_labels=None,
                box=input_box[None, :],
                multimask_output=False,
            )

            # 将 mask 转换为 PIL 图像并保存
            mask = masks[0].astype(np.uint8) * 255
            mask_image = Image.fromarray(mask)
            
            mask_filename = f"mask_{uuid.uuid4()}.png"
            mask_filepath = os.path.join("uploads", mask_filename)
            mask_image.save(mask_filepath)
            return mask_filename
        except Exception as e:
            print(f"ERROR: SAM segmentation failed: {e}")
            return None