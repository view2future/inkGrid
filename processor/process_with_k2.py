#!/usr/bin/env python3
"""
使用 KIMI K2.5 模型处理碑帖

K2.5 特点：
- 256K 上下文
- 支持图像+视频+推理
- temperature 必须为 1
- 响应时间较长
"""

import os
import sys
import json
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

# 强制使用 K2.5
os.environ['KIMI_MODEL'] = 'kimi-k2.5'

from core.vlm_client import VLMClient
from core.slicer import CharacterSlicer
from core.models import scale_to_pixels
from PIL import Image

# 峄山刻石真值
YISHAN_TEXT = "皇帝立国维初在昔嗣世称王讨伐乱逆威动四极武义直方戎臣奉诏经时不久灭六暴强廿有六年上荐高号孝道显明既献泰成乃降专惠亲巡远方登于绎山群臣从者咸思攸长追念乱世分土建邦以开争理功战日作流血于野自泰古始世无万数陀及五帝莫能禁止乃今皇帝一家天下兵不复起灾害灭除黔首康定利泽长久群臣诵略刻此乐石以著经纪"


def process_with_k25(image_path, stele_name, script_type, batch_size=20):
    """使用 K2.5 分批处理"""
    
    client = VLMClient()
    all_characters = []
    
    total_chars = len(YISHAN_TEXT)
    num_batches = (total_chars + batch_size - 1) // batch_size
    
    print(f"\n使用 KIMI K2.5 模型处理")
    print(f"总字数: {total_chars}, 分 {num_batches} 批")
    print("="*60)
    
    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, total_chars)
        batch_text = YISHAN_TEXT[start:end]
        
        print(f"\n批次 {batch_idx + 1}/{num_batches}: 第 {start+1}-{end} 字")
        print(f"文字: {batch_text}")
        
        # K2.5 优化的提示词
        prompt = f"""你是一个中国书法碑帖识别专家。请分析图片中的碑帖文字。

任务：识别并定位第 {start+1} 到第 {end} 个字符（共 {len(batch_text)} 字）

参考文字：{batch_text}

输出要求：
1. 返回严格的 JSON 格式
2. 每个字符包含：index, original_char, simplified_char, pinyin, definition, bbox, row, col
3. bbox 格式为 [ymin, xmin, ymax, xmax]，归一化到 0-1000
4. index 从 {start+1} 开始编号
5. 确保 JSON 完整，不要截断

示例格式：
{{
  "stele_info": {{"name": "{stele_name}", "script_type": "{script_type}", "total_characters": {len(batch_text)}}},
  "characters": [
    {{"index": {start+1}, "original_char": "{batch_text[0]}", "simplified_char": "{batch_text[0]}", "pinyin": "", "definition": "", "bbox": [0,0,100,100], "row": 1, "col": 1}}
  ]
}}
"""
        
        try:
            print(f"  发送请求... (K2.5 处理时间约 30-60 秒)")
            start_time = time.time()
            
            response = client.analyze_stele(
                image_path, 
                prompt, 
                max_retries=2,
                temperature=1  # K2.5 要求
            )
            
            elapsed = time.time() - start_time
            print(f"  ✓ 完成，耗时 {elapsed:.1f} 秒")
            
            # 解析 JSON
            import re
            json_str = response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1]
            
            json_str = json_str.strip()
            start_pos = json_str.find('{')
            end_pos = json_str.rfind('}')
            
            if start_pos != -1 and end_pos != -1:
                json_str = json_str[start_pos:end_pos+1]
                json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
                
                data = json.loads(json_str)
                chars = data.get('characters', [])
                
                # 调整索引
                for char in chars:
                    char['index'] = start + chars.index(char) + 1
                
                all_characters.extend(chars)
                print(f"  ✓ 识别到 {len(chars)} 个字符")
            
        except Exception as e:
            print(f"  ✗ 错误: {str(e)[:100]}")
            # 添加占位符
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
    api_key = os.getenv('KIMI_API_KEY')
    if not api_key:
        print("错误: KIMI_API_KEY 未设置")
        sys.exit(1)
    
    print("="*60)
    print("InkGrid - KIMI K2.5 碑帖处理器")
    print("="*60)
    
    # 路径
    image_path = '../steles/1-zhuanshu/1-yishankeshi/yishan.jpg'
    output_dir = '../test_output_k2/峄山刻石'
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"\n碑帖: 峄山刻石")
    print(f"模型: KIMI K2.5 (256K 上下文)")
    print(f"输出: {output_dir}")
    
    # Step 1: VLM 识别
    print("\n" + "="*60)
    print("Step 1: K2.5 VLM 识别")
    print("="*60)
    
    start_total = time.time()
    characters = process_with_k25(image_path, '峄山刻石', '小篆', batch_size=20)
    
    print(f"\n✓ 识别完成，共 {len(characters)} 个字符")
    print(f"  耗时: {time.time() - start_total:.1f} 秒")
    
    # Step 2: 切分图像
    print("\n" + "="*60)
    print("Step 2: 切分字符图像")
    print("="*60)
    
    with Image.open(image_path) as img:
        img_width, img_height = img.size
    
    processed_chars = []
    for char in characters:
        bbox = char['bbox']
        pixel_bbox = scale_to_pixels(bbox, img_width, img_height)
        processed_chars.append({
            'index': char['index'],
            'char': char['simplified_char'],
            'original': char['original_char'],
            'pinyin': char.get('pinyin', ''),
            'definition': char.get('definition', ''),
            'bbox': pixel_bbox,
            'row': char.get('row', 0),
            'col': char.get('col', 0)
        })
    
    slicer = CharacterSlicer(output_dir=output_dir)
    sliced = slicer.slice_characters(
        image_path=image_path,
        characters=processed_chars,
        stele_name='峄山刻石'
    )
    
    print(f"✓ 切分完成: {len(sliced)} 个字符")
    
    # Step 3: 可视化
    print("\n" + "="*60)
    print("Step 3: 生成可视化")
    print("="*60)
    
    viz_path = slicer.create_visualization(
        image_path=image_path,
        characters=processed_chars,
        output_path=os.path.join(output_dir, 'visualization.jpg')
    )
    print(f"✓ 可视化: {viz_path}")
    
    # 保存结果
    result = {
        'model': 'kimi-k2.5',
        'stele_name': '峄山刻石',
        'script_type': '小篆',
        'total_characters': len(sliced),
        'characters': sliced
    }
    
    with open(os.path.join(output_dir, 'result.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 总结
    print("\n" + "="*60)
    print("处理完成!")
    print("="*60)
    print(f"总耗时: {time.time() - start_total:.1f} 秒")
    print(f"模型: KIMI K2.5")
    print(f"字符数: {len(sliced)}")
    print(f"输出目录: {output_dir}")
    print("\n前10个字符:")
    for char in sliced[:10]:
        print(f"  {char['index']:3d}. {char['original']} ({char['char']})")


if __name__ == '__main__':
    main()
