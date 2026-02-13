import os
import json
import cv2
import numpy as np
from pypinyin import pinyin, Style

class AlignmentService:
    def __init__(self):
        self.steles_data = {}
        self._load_steles()

    def _load_steles(self):
        # Use relative path from this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(current_dir, "..", "data", "steles.json")
        
        if os.path.exists(data_path):
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for stele in data.get("steles", []):
                    self.steles_data[stele["name"]] = stele["content"]
        else:
            print(f"WARNING: {data_path} not found.")

    def list_steles(self):
        return list(self.steles_data.keys())

    def get_stele_content(self, stele_name: str):
        # 尝试精确匹配
        content = self.steles_data.get(stele_name)
        if content:
            return content
            
        # 尝试模糊匹配 (处理 URL 编码或空格差异)
        for name, data in self.steles_data.items():
            if name in stele_name or stele_name in name:
                print(f"DEBUG: Fuzzy matched '{stele_name}' to '{name}'")
                return data
                
        print(f"DEBUG: Stele '{stele_name}' not found. Available: {list(self.steles_data.keys())}")
        return []

    def align_characters(self, image_cv, h_lines, v_lines, stele_name, ocr_engine, offset=0):
        stele_content = self.get_stele_content(stele_name)
        if not stele_content: return []

        aligned_chars = []
        char_idx = offset

        for r_idx in range(len(h_lines) - 1):
            for c_idx in range(len(v_lines) - 1):
                if char_idx >= len(stele_content): break

                y1, y2 = h_lines[r_idx], h_lines[r_idx+1]
                x1, x2 = v_lines[c_idx], v_lines[c_idx+1]
                
                # 确保裁剪区域有效
                if x2 <= x1 or y2 <= y1: continue

                crop_img = image_cv[y1:y2, x1:x2]
                
                # 调用 OCR 识别
                # recognized_text = ocr_engine.recognize_crop(crop_img)
                recognized_text = ""
                
                current_char_info = stele_content[char_idx]
                
                aligned_chars.append({
                    "text": recognized_text, # 可以保留OCR结果
                    "aligned_text": current_char_info["simplified"], # 强制使用标准字
                    "simplified": current_char_info["simplified"],
                    "pinyin": current_char_info["pinyin"],
                    "meaning": current_char_info["meaning"],
                    "en_word": current_char_info.get("en_word", ""),
                    "en_meaning": current_char_info.get("en_meaning", ""),
                    "bbox": [x1, y1, x2, y2],
                    "confidence": 1.0 # 假设为1.0
                })
                char_idx += 1
        return aligned_chars

    def auto_calculate_offset(self, image_cv, h_lines, v_lines, stele_name, ocr_engine):
        stele_content = self.get_stele_content(stele_name)
        if not stele_content: return 0

        # 简单的自动匹配逻辑：尝试识别前几个格子，与标准碑帖内容匹配，返回最佳偏移量
        best_offset = 0
        max_matches = 0

        for offset_attempt in range(min(10, len(stele_content))): # 只尝试前10个可能的偏移
            current_matches = 0
            temp_char_idx = offset_attempt
            
            for r_idx in range(min(2, len(h_lines) - 1)): # 只检查前两行
                for c_idx in range(min(2, len(v_lines) - 1)): # 只检查前两列
                    if temp_char_idx >= len(stele_content): break

                    y1, y2 = h_lines[r_idx], h_lines[r_idx+1]
                    x1, x2 = v_lines[c_idx], v_lines[c_idx+1]

                    if x2 <= x1 or y2 <= y1: continue
                    
                    crop_img = image_cv[y1:y2, x1:x2]
                    recognized_text = ocr_engine.recognize_crop(crop_img)
                    
                    if recognized_text and recognized_text == stele_content[temp_char_idx]["simplified"]:
                        current_matches += 1
                    temp_char_idx += 1
                if temp_char_idx >= len(stele_content): break
            
            if current_matches > max_matches:
                max_matches = current_matches
                best_offset = offset_attempt
                
        return best_offset