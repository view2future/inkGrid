"""
Batch processor for stele analysis - handles large images by processing in regions.
"""

import os
from typing import List, Dict, Any, Tuple
from PIL import Image
import json

from .vlm_client import VLMClient
from .prompts import SYSTEM_PROMPT
from .models import scale_to_pixels


class BatchSteleProcessor:
    """
    分批处理大型碑帖图像
    
    将图像分成多个区域，逐区域进行VLM识别，然后合并结果
    """
    
    def __init__(self, api_key: str = None):
        self.client = VLMClient(api_key=api_key)
        self.chars_per_batch = 30  # 每批处理30个字符
        
    def analyze_stele_in_batches(
        self,
        image_path: str,
        stele_name: str,
        script_type: str,
        ground_truth_text: str = None
    ) -> Dict[str, Any]:
        """
        分批分析碑帖图像
        
        策略：
        1. 首先识别图像获取大概字数
        2. 将真值文本分成多批
        3. 对每批分别进行识别
        4. 合并所有结果
        """
        print(f"Analyzing {stele_name} in batches...")
        
        # Load image
        with Image.open(image_path) as img:
            img_width, img_height = img.size
        
        # If ground truth available, use it to guide batching
        if ground_truth_text:
            return self._analyze_with_ground_truth(
                image_path, stele_name, script_type, 
                ground_truth_text, img_width, img_height
            )
        else:
            # Without ground truth, process whole image at once
            return self._analyze_single_batch(
                image_path, stele_name, script_type,
                img_width, img_height
            )
    
    def _analyze_with_ground_truth(
        self,
        image_path: str,
        stele_name: str,
        script_type: str,
        ground_truth_text: str,
        img_width: int,
        img_height: int
    ) -> Dict[str, Any]:
        """使用真值文本分批处理"""
        
        # Clean ground truth
        gt_clean = "".join(ground_truth_text.split())
        total_chars = len(gt_clean)
        
        print(f"Total characters in ground truth: {total_chars}")
        
        # Split into batches
        batches = []
        for i in range(0, total_chars, self.chars_per_batch):
            batch_text = gt_clean[i:i + self.chars_per_batch]
            batches.append({
                'start_idx': i,
                'text': batch_text,
                'hint': gt_clean[max(0, i-5):i+len(batch_text)+5]  # 带上下文
            })
        
        print(f"Split into {len(batches)} batches")
        
        # Process each batch
        all_characters = []
        
        for batch_num, batch in enumerate(batches, 1):
            print(f"\nProcessing batch {batch_num}/{len(batches)}...")
            
            prompt = f"""{SYSTEM_PROMPT}

请识别并切分这张碑帖图片中的文字。

碑帖信息：
- 名称：《{stele_name}》
- 书体：{script_type}

本次需要识别的文字（共{len(batch['text'])}字）：
{batch['text']}

这是第{batch_num}批，从第{batch['start_idx']+1}字开始。
请只返回这{len(batch['text'])}个字符的识别结果，按顺序编号从{batch['start_idx']+1}开始。
"""
            
            try:
                response = self.client.analyze_stele(image_path, prompt, max_retries=2)
                
                # Parse response
                batch_chars = self._parse_batch_response(response, batch['start_idx'])
                all_characters.extend(batch_chars)
                
                print(f"  ✓ Got {len(batch_chars)} characters")
                
            except Exception as e:
                print(f"  ✗ Batch {batch_num} failed: {e}")
                # Add placeholder characters for failed batch
                for i, char in enumerate(batch['text']):
                    all_characters.append({
                        'index': batch['start_idx'] + i + 1,
                        'original_char': char,
                        'simplified_char': char,
                        'pinyin': '',
                        'definition': '',
                        'bbox': [0, 0, 10, 10],
                        'row': 0,
                        'col': 0
                    })
        
        # Build final result
        return {
            'tablet_id': stele_name,
            'info': {
                'name': stele_name,
                'script_type': script_type,
                'layout': 'Vertical',
                'total_characters': len(all_characters)
            },
            'image_dimensions': {'width': img_width, 'height': img_height},
            'characters': all_characters,
            'total_detected': len(all_characters)
        }
    
    def _analyze_single_batch(
        self,
        image_path: str,
        stele_name: str,
        script_type: str,
        img_width: int,
        img_height: int
    ) -> Dict[str, Any]:
        """单批次处理（无真值）"""
        
        from .inference import run_vlm_analysis
        
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name=stele_name,
            script_type=script_type,
            use_ground_truth=False
        )
        
        return result
    
    def _parse_batch_response(self, response: str, start_idx: int) -> List[Dict]:
        """解析批次响应"""
        import json
        import re
        
        # Clean JSON
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()
        
        # Find JSON boundaries
        start = response.find('{')
        end = response.rfind('}')
        
        if start == -1 or end == -1:
            raise ValueError("No JSON found in response")
        
        json_str = response[start:end+1]
        
        # Fix common issues
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            # Try more aggressive cleaning
            json_str = re.sub(r'\n\s*}', '}', json_str)
            json_str = re.sub(r'\n\s*]', ']', json_str)
            data = json.loads(json_str)
        
        characters = data.get('characters', [])
        
        # Ensure correct indexing
        for i, char in enumerate(characters):
            char['index'] = start_idx + i + 1
        
        return characters
