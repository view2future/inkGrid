
from PIL import Image
import numpy as np
import os

# Create a blank image
width, height = 64, 64
img = Image.new('RGB', (width, height), color = 'black')
pixels = np.array(img)

# Add subtle noise (dark grey with random variations)
noise_factor = 0.2 # Controls the intensity of the noise
noise = np.random.randint(0, int(255 * noise_factor), (height, width, 3), dtype=np.uint8)
# Ensure the base color remains dark, just add variations
pixels = np.clip(pixels + noise, 0, 50) # Clip to a dark grey range

# Save the image
output_path = "frontend/public/noise.png"
if not os.path.exists(os.path.dirname(output_path)):
    os.makedirs(os.path.dirname(output_path))
Image.fromarray(pixels).save(output_path)
print(f"Generated {output_path}")
