import os
import json
import logging
from typing import List, Dict, Any
import PIL.Image
import sys

# 确保可以导入 core
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.vlm_client import GeminiSDKClient
from core.prompts import SYSTEM_PROMPT, get_analysis_prompt

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VLMProcessor:
    def __init__(self, api_key: str):
        self.client = GeminiSDKClient(api_key=api_key, model="gemini-2.0-flash-lite")
        self.output_dir = "exported_characters"
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def process_and_split(self, image_path: str, stele_name: str, script_type: str):
        """
        识别并切分碑帖图片
        """
        import time
        time.sleep(1) # 增加延迟避免突发请求
        if not os.path.exists(image_path):
            logger.error(f"图片不存在: {image_path}")
            return
            
        logger.info(f"开始处理: {image_path} ({stele_name})")
        
        # 1. 构造 Prompt
        analysis_prompt = get_analysis_prompt(stele_name, script_type)
        full_prompt = f"{SYSTEM_PROMPT}\n\n{analysis_prompt}"
        
        # 2. 调用 Gemini
        try:
            response_text = self.client.analyze_stele(image_path, full_prompt)
            data = json.loads(response_text)
            logger.info(f"Gemini 识别成功，解析到 {len(data.get('characters', []))} 个字符")
        except Exception as e:
            logger.error(f"识别失败: {str(e)}")
            return

        # 3. 加载原始图像用于切分
        original_img = PIL.Image.open(image_path)
        width, height = original_img.size

        # 4. 遍历字符并切分
        results = []
        for char_data in data.get('characters', []):
            try:
                idx = char_data.get('index', 0)
                orig_char = char_data.get('original_char', 'unknown')
                simp_char = char_data.get('simplified_char', 'unknown')
                pinyin = char_data.get('pinyin', 'unknown').replace(' ', '_')
                bbox = char_data.get('bbox') # [ymin, xmin, ymax, xmax] in 0-1000

                if not bbox or len(bbox) != 4:
                    continue

                # 转换为像素坐标
                ymin, xmin, ymax, xmax = bbox
                left = xmin * width / 1000
                top = ymin * height / 1000
                right = xmax * width / 1000
                bottom = ymax * height / 1000

                # 切割图片
                char_img = original_img.crop((left, top, right, bottom))
                
                # 构造文件名: 碑帖名_序号_拼音_汉字.jpg
                pinyin_clean = self._clean_pinyin(pinyin)
                filename = f"{stele_name}_{idx:04d}_{pinyin_clean}_{simp_char}.jpg"
                save_path = os.path.join(self.output_dir, filename)
                
                char_img.save(save_path, "JPEG", quality=95)
                logger.info(f"已保存: {filename}")
                
                results.append({
                    "char": simp_char,
                    "path": save_path,
                    "bbox": bbox
                })
            except Exception as e:
                logger.warning(f"切分字符 {idx} 失败: {str(e)}")

        # 保存识别元数据
        metadata_path = os.path.join(self.output_dir, f"{stele_name}_metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"处理完成！所有切片保存至: {self.output_dir}")
        return results

    def _clean_pinyin(self, pinyin: str) -> str:
        """简单的拼音去声调处理"""
        mapping = {
            'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
            'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
            'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
            'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
            'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ü': 'u',
            'ń': 'n', 'ň': 'n', 'ǹ': 'n'
        }
        for k, v in mapping.items():
            pinyin = pinyin.replace(k, v)
        return pinyin

if __name__ == "__main__":
    API_KEY = "AIzaSyBk4p4zNmA3zsaMsRLonpqzpMuDmW8w-x8"
    processor = VLMProcessor(API_KEY)
    
    # 使用正确的图片路径
    image = "../steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    processor.process_and_split(image, "峄山刻石", "小篆")