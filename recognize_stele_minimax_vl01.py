#!/usr/bin/env python3
"""
Recognize characters in stele image using MiniMax-VL-01 model.

This script identifies characters in the stele image, counts them,
and crops each character into individual images with proper naming.
"""

import os
import json
import PIL.Image
import sys
import re
from dotenv import load_dotenv

# Add processor to path
sys.path.append(os.path.join(os.getcwd(), "processor"))

from core.vlm_client import get_vlm_client
from core.models import scale_to_pixels


def create_optimized_prompt():
    """
    Create an optimized prompt for MiniMax model to recognize stele characters.
    Even though the model name suggests it's a text model, the API can handle images.
    """
    return """你是一个专业的中国古代书法识别专家，专门研究篆书碑帖。

任务：分析这张《峄山刻石》篆书碑帖，识别出每一个汉字并统计总数。

具体要求：
1. 仔细数出图片中总共有多少个汉字
2. 按照从上到下、从右到左的传统阅读顺序，依次列出每个字
3. 第一个字应该是"皇"
4. 将所有识别出的字符按顺序以JSON格式返回

输出格式：请严格按照以下JSON格式返回结果，不要添加其他解释文字：

{
  "total_count": 总字数,
  "characters": [
    {
      "index": 序号（从1开始）,
      "original_char": 原始字符,
      "simplified_char": 简体对应字
    }
  ]
}

注意：确保所有字符都被识别，不要遗漏任何字符。"""


def recognize_stele_characters(image_path, output_dir):
    """
    Use MiniMax-VL-01 model to recognize characters in the stele image.
    
    Args:
        image_path: Path to the stele image
        output_dir: Directory to save cropped character images
    """
    print(f"Starting MiniMax analysis for {image_path}...")

    # Initialize the MiniMax client
    client = get_vlm_client(provider="minimax")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")

    # Load image to get dimensions
    with PIL.Image.open(image_path) as img:
        full_width, full_height = img.size

    print(f"Image dimensions: {full_width}x{full_height}")

    # Get the optimized prompt
    prompt = create_optimized_prompt()

    all_characters = []

    try:
        print("Sending request to MiniMax model...")
        response_text = client.analyze_stele(image_path, prompt)

        print(f"Raw response received. Length: {len(response_text)}")
        print(f"Response preview: {response_text[:500]}...")

        # Try to extract JSON from the response
        # Look for JSON-like structure
        json_start = response_text.find('{')
        json_end = response_text.rfind('}')

        if json_start != -1 and json_end != -1 and json_start < json_end:
            json_str = response_text[json_start:json_end+1]

            try:
                result = json.loads(json_str)

                if "characters" in result:
                    total_count = result.get("total_count", len(result["characters"]))
                    print(f"Found {total_count} characters in response")

                    for c in result["characters"]:
                        # Since the text model might not provide bbox, we'll handle this later
                        all_characters.append({
                            "index": c.get("index", len(all_characters)+1),
                            "original": c.get("original_char", "□"),
                            "simplified": c.get("simplified_char", "□"),
                            "bbox": None  # Will be handled separately
                        })
                else:
                    print("No 'characters' key found in JSON response")
                    print(f"Response keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON from response: {e}")
                print(f"JSON substring: {json_str[:200]}...")
                
                # Try to find character objects using regex as fallback
                char_pattern = r'\{[^{}]*"original_char"[^{}]*\}'
                char_matches = re.findall(char_pattern, response_text)

                print(f"Fallback: Found {len(char_matches)} character objects via regex.")

                for char_str in char_matches:
                    try:
                        c = json.loads(char_str)

                        all_characters.append({
                            "index": c.get("index", len(all_characters)+1),
                            "original": c.get("original_char", "□"),
                            "simplified": c.get("simplified_char", "□"),
                            "bbox": None  # Will be handled separately
                        })
                    except:
                        continue
        else:
            print("Could not find JSON structure in response")
            print(f"Response preview: {response_text[:500]}...")

    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        if 'response_text' in locals():
            print(f"Raw response: {response_text[:500]}...")

    if not all_characters:
        print("No characters were successfully parsed.")
        return

    print(f"Successfully parsed {len(all_characters)} characters")

    # Since we don't have bounding boxes from the text model, we'll use a grid-based approach
    # to divide the image based on the number of characters found
    print(f"Found {len(all_characters)} characters. Using grid-based approach for cropping...")

    # Calculate grid dimensions based on aspect ratio of the image and number of characters
    # Assuming traditional vertical layout (columns from right to left)
    num_chars = len(all_characters)

    # Estimate grid dimensions - for Yishan stele, typically arranged in columns
    # Try to estimate number of rows and columns based on image aspect ratio
    aspect_ratio = full_height / full_width  # height/width ratio

    # For a vertical text layout, estimate rows and columns
    import math
    estimated_cols = max(1, int(math.sqrt(num_chars / aspect_ratio)))
    estimated_rows = max(1, int(num_chars / estimated_cols))

    # Adjust if we don't have enough characters assigned
    if estimated_cols * estimated_rows < num_chars:
        estimated_cols += 1
        estimated_rows = math.ceil(num_chars / estimated_cols)

    print(f"Estimated grid: {estimated_rows} rows x {estimated_cols} cols")

    # Calculate cell dimensions with padding
    cell_width = full_width // estimated_cols
    cell_height = full_height // estimated_rows
    padding_x = int(cell_width * 0.1)  # 10% padding
    padding_y = int(cell_height * 0.1)  # 10% padding

    # Save cropped images
    print(f"Cropping and saving {num_chars} characters...")
    final_results = []

    with PIL.Image.open(image_path) as full_img:
        for i, char_data in enumerate(all_characters):
            # Calculate position in grid (right-to-left, top-to-bottom)
            col_idx = estimated_cols - 1 - (i // estimated_rows)  # Right to left
            row_idx = i % estimated_rows  # Top to bottom

            # Calculate coordinates with padding
            x = col_idx * cell_width + padding_x
            y = row_idx * cell_height + padding_y
            w = cell_width - 2 * padding_x
            h = cell_height - 2 * padding_y

            # Ensure coordinates are within image bounds
            x = max(0, x)
            y = max(0, y)
            w = min(w, full_width - x)
            h = min(h, full_height - y)

            if w <= 0 or h <= 0:
                print(f"Skipping invalid region for character {i}: position ({col_idx}, {row_idx})")
                continue

            char_img = full_img.crop((x, y, x + w, y + h))

            # Create safe filenames by replacing problematic characters
            safe_orig = char_data["original"].replace("/", "_").replace("\\", "_").replace(" ", "_")
            safe_simp = char_data["simplified"].replace("/", "_").replace("\\", "_").replace(" ", "_")

            # Use a clear naming convention: index_originalChar_simplifiedChar.jpg
            filename = f"{char_data['index']:03d}_{safe_orig}_{safe_simp}.jpg"
            file_path = os.path.join(output_dir, filename)

            # Save with high quality
            char_img.save(file_path, quality=95, format='JPEG')

            char_data["image_path"] = file_path
            final_results.append(char_data)

    # Save summary report
    report_path = os.path.join(output_dir, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_count": len(final_results),
            "characters": final_results,
            "source_image": image_path,
            "image_dimensions": [full_width, full_height],
            "model_used": "MiniMax (abab6.5s-chat with image support)"
        }, f, ensure_ascii=False, indent=2)

    print(f"Analysis complete! Found and saved {len(final_results)} characters.")
    print(f"Results saved to {output_dir}")

    # Print the sequence of characters found
    chars_str = "".join([c["original"] for c in final_results])
    simp_str = "".join([c["simplified"] for c in final_results])
    print(f"Original sequence: {chars_str}")
    print(f"Simplified sequence: {simp_str}")
    
    return final_results


if __name__ == "__main__":
    # Use the specific image path mentioned in the request
    img_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    
    # Check if the image exists
    if not os.path.exists(img_path):
        print(f"Image path does not exist: {img_path}")
        print("Looking for similar files in the directory...")
        yishan_dir = "steles/1-zhuanshu/1-yishankeshi/"
        if os.path.exists(yishan_dir):
            for file in os.listdir(yishan_dir):
                if file.endswith(('.jpg', '.jpeg', '.png')):
                    print(f"  - {yishan_dir}{file}")
        exit(1)
    
    print(f"Using image path: {img_path}")
    out_dir = "processor/exported_characters/yishan_minimax_vl01_recognition"
    
    # Load environment variables
    load_dotenv(os.path.join("processor", ".env"))
    
    # Run the recognition
    results = recognize_stele_characters(img_path, out_dir)
    
    if results:
        print(f"\nRecognition completed successfully!")
        print(f"Total characters found: {len(results)}")
        print(f"Character images saved in: {out_dir}")
    else:
        print(f"\nRecognition failed!")