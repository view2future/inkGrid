import numpy as np
from cnocr import CnOcr
import cv2

class OCREngine:
    def __init__(self):
        print("Initializing CnOcr engine...")
        self.ocr = CnOcr()
        print("CnOcr engine initialized.")

    def recognize_crop(self, image_np):
        # 确保图像是uint8类型
        if image_np.dtype != np.uint8:
            image_np = image_np.astype(np.uint8)
        
        # 如果是灰度图，转成RGB三通道
        if len(image_np.shape) == 2:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)

        # CnOcr 期望的输入是 [H, W, C] 格式
        res = self.ocr.ocr_for_single_line(image_np)
        return res[0] if res and len(res) > 0 else ""
        
    def batch_recognize(self, image_list_np):
        # 批量识别，可能需要对图像进行预处理
        results = self.ocr.ocr_for_single_lines(image_list_np)
        return [res[0] if res else "" for res in results]