#!/usr/bin/env python3
"""
演示完整流程：分批VLM识别 + 图像切分
"""

import os
import sys
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from core.vlm_client import VLMClient
from core.slicer import CharacterSlicer
from core.prompts import SYSTEM_PROMPT
from core.models import scale_to_pixels

# 峄山刻石真值文本（135字）
YISHAN_TEXT = "皇帝立国维初在昔嗣世称王讨伐乱逆威动四极武义直方戎臣奉诏经时不久灭六暴强廿有六年上荐高号孝道显明既献泰成乃降专惠亲巡远方登于绎山群臣从者咸思攸长追念乱世分土建邦以开争理功战日作流血于野自泰古始世无万数陀及五帝莫能禁止乃今皇帝一家天下兵不复起灾害灭除黔首康定利泽长久群臣诵略刻此乐石以著经纪"


def process_in_batches(image_path, stele_name, script_type, batch_size=25):
    """分批处理碑帖"""
    client = VLMClient()
    all_characters = []
    
    total_chars = len(YISHAN_TEXT)
    num_batches = (total_chars + batch_size - 1) // batch_size
    
    print(f"Processing {total_chars} characters in {num_batches} batches...")
    print("="*60)
    
    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, total_chars)
        batch_text = YISHAN_TEXT[start:end]
        
        print(f"\nBatch {batch_idx + 1}/{num_batches}: characters {start+1}-{end}")
        
        prompt = f"""{SYSTEM_PROMPT}

请识别碑帖中第{start+1}到第{end}个字符。

碑帖：《{stele_name}》，书体：{script_type}
参考文本：{batch_text}

重要：
1. 返回这{len(batch_text)}个字符的完整信息
2. index从{start+1}开始编号
3. 确保bbox坐标精确，用于图像切分
"""
        
        try:
            response = client.analyze_stele(image_path, prompt, max_retries=2)
            
            # Parse response
            import re
            json_str = response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1]
            
            json_str = json_str.strip()
            start_idx = json_str.find('{')
            end_idx = json_str.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = json_str[start_idx:end_idx+1]
                json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
                
                data = json.loads(json_str)
                chars = data.get('characters', [])
                
                # Adjust indices
                for char in chars:
                    char['index'] = start + chars.index(char) + 1
                
                all_characters.extend(chars)
                print(f"  ✓ Got {len(chars)} characters")
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
            # Add placeholders
            for i, char in enumerate(batch_text):
                all_characters.append({
                    'index': start + i + 1,
                    'original_char': char,
                    'simplified_char': char,
                    'pinyin': '',
                    'definition': '',
                    'bbox': [0, 0, 10, 10],
                    'row': (start + i) // 9 + 1,
                    'col': (start + i) % 9 + 1
                })
    
    return all_characters


def main():
    # Setup
    os.environ.setdefault('KIMI_API_KEY', os.getenv('KIMI_API_KEY', ''))
    os.environ['KIMI_MODEL'] = 'moonshot-v1-128k-vision-preview'
    
    if not os.getenv('KIMI_API_KEY'):
        print("Error: KIMI_API_KEY not set")
        sys.exit(1)
    
    # Paths
    image_path = '../steles/1-zhuanshu/1-yishankeshi/yishan.jpg'
    output_dir = '../test_output/峄山刻石'
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*60)
    print("InkGrid Stele Processor - Demo")
    print("="*60)
    print(f"Image: {image_path}")
    print(f"Output: {output_dir}")
    print("="*60 + "\n")
    
    # Step 1: VLM Analysis in batches
    print("Step 1: VLM Analysis (Batched)")
    characters = process_in_batches(image_path, '峄山刻石', '小篆', batch_size=25)
    print(f"\n✓ Total characters: {len(characters)}")
    
    # Get image dimensions for coordinate conversion
    from PIL import Image
    with Image.open(image_path) as img:
        img_width, img_height = img.size
    
    # Convert coordinates and prepare for slicing
    processed_chars = []
    for char in characters:
        bbox = char['bbox']  # [ymin, xmin, ymax, xmax] normalized
        pixel_bbox = scale_to_pixels(bbox, img_width, img_height)
        
        processed_chars.append({
            'index': char['index'],
            'char': char['simplified_char'],
            'original': char['original_char'],
            'pinyin': char.get('pinyin', ''),
            'definition': char.get('definition', ''),
            'bbox': pixel_bbox,  # [x, y, w, h] in pixels
            'row': char.get('row', 0),
            'col': char.get('col', 0)
        })
    
    # Step 2: Slice images
    print("\nStep 2: Slicing Characters")
    slicer = CharacterSlicer(output_dir=output_dir)
    
    sliced = slicer.slice_characters(
        image_path=image_path,
        characters=processed_chars,
        stele_name='峄山刻石',
        output_format='jpg'
    )
    
    print(f"✓ Sliced {len(sliced)} characters")
    
    # Step 3: Visualization
    print("\nStep 3: Creating Visualization")
    viz_path = slicer.create_visualization(
        image_path=image_path,
        characters=processed_chars,
        output_path=os.path.join(output_dir, 'visualization.jpg')
    )
    print(f"✓ Visualization saved: {viz_path}")
    
    # Step 4: Save results
    result = {
        'stele_name': '峄山刻石',
        'script_type': '小篆',
        'total_characters': len(sliced),
        'characters': sliced
    }
    
    result_path = os.path.join(output_dir, 'result.json')
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Result saved: {result_path}")
    
    # Summary
    print("\n" + "="*60)
    print("Processing Complete!")
    print("="*60)
    print(f"Total: {len(sliced)} characters")
    print(f"Output: {output_dir}")
    print("\nFirst 10 characters:")
    for char in sliced[:10]:
        print(f"  {char['index']:3d}. {char['original']} ({char['char']})")
        print(f"       {os.path.basename(char['sliced_image'])}")
    
    print("\nLast 5 characters:")
    for char in sliced[-5:]:
        print(f"  {char['index']:3d}. {char['original']} ({char['char']})")


if __name__ == '__main__':
    main()
