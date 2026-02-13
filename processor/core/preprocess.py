import cv2
import numpy as np
import PIL.Image

def enhance_stele_image(image_path: str, output_path: str):
    """
    Perform image enhancement for better VLM recognition:
    - Adaptive Histogram Equalization (CLAHE)
    - Sharpening
    - Denoising
    """
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Image not found at {image_path}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl1 = clahe.apply(gray)
    
    # Sharpening
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(cl1, -1, kernel)
    
    # Save enhanced image
    cv2.imwrite(output_path, sharpened)
    return output_path