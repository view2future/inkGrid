import os
import json
import logging
import PIL.Image
import re

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def try_repair_json(json_str: str) -> dict:
    """
    尝试修复不完整的 JSON 字符串（处理截断问题）
    """
    json_str = json_str.strip()
    # 如果已经是完整的，直接返回
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # 尝试补齐括号
    logger.info("检测到 JSON 不完整，尝试修复...")
    
    # 找到最后一个完整的对象
    # 这是一个非常简化的逻辑：不断尝试去掉最后一个字符直到能解析，或者手动闭合
    temp_str = json_str
    for _ in range(100): # 最多回溯 100 个字符
        try:
            # 尝试闭合数组和对象
            test_str = temp_str + '
    ]
}'
            return json.loads(test_str)
        except:
            temp_str = temp_str[:-1]
            if not temp_str: break
            
    raise ValueError("无法修复该 JSON 数据")

class VLMSplitter:
    def __init__(self, output_dir="exported_characters"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def split_from_json(self, image_path, data, stele_name):
        original_img = PIL.Image.open(image_path)
        width, height = original_img.size
        
        results = []
        for char_data in data.get('characters', []):
            try:
                idx = char_data.get('index', 0)
                simp_char = char_data.get('simplified_char', 'unknown').strip()
                pinyin = char_data.get('pinyin', 'unknown').strip().replace(' ', '_')
                bbox = char_data.get('bbox')

                if not bbox or len(bbox) != 4: continue

                ymin, xmin, ymax, xmax = bbox
                left, top = xmin * width / 1000, ymin * height / 1000
                right, bottom = xmax * width / 1000, ymax * height / 1000

                char_img = original_img.crop((left, top, right, bottom))
                
                # 命名规则
                pinyin_clean = self._clean_pinyin(pinyin)
                filename = f"{stele_name}_{idx:04d}_{pinyin_clean}_{simp_char}.jpg"
                save_path = os.path.join(self.output_dir, filename)
                
                char_img.save(save_path, "JPEG", quality=95)
                logger.info(f"成功切分: {filename}")
                results.append(save_path)
            except Exception as e:
                logger.error(f"切分索引 {idx} 失败: {e}")
        return results

    def _clean_pinyin(self, pinyin: str) -> str:
        mapping = {'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
                   'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
                   'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ü': 'u'}
        for k, v in mapping.items(): pinyin = pinyin.replace(k, v)
        return pinyin

if __name__ == "__main__":
    # 模拟您刚才获得的 JSON 数据片段（手动修复版）
    mock_data = {
      "stele_info": {
        "name": "峄山刻石",
        "script_type": "篆书",
        "layout": "Vertical",
        "total_characters": 120
      },
      "characters": [
        {
          "index": 1,
          "original_char": "皇",
          "simplified_char": "皇",
          "pinyin": "huáng",
          "definition": "皇帝，君主",
          "bbox": [19, 905, 78, 985],
          "row": 1,
          "col": 1
        },
        {
          "index": 2,
          "original_char": "帝",
          "simplified_char": "帝",
          "pinyin": "dì",
          "definition": "皇帝，君主",
          "bbox": [82, 905, 142, 985],
          "row": 1,
          "col": 2
        }
      ]
    }
    
    splitter = VLMSplitter()
    img_path = "steles/1-zhuanshu/1-yishankeshi/yishan.jpg"
    if os.path.exists(img_path):
        splitter.split_from_json(img_path, mock_data, "峄山刻石")
    else:
        print(f"找不到图片: {img_path}")
