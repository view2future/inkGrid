import os
import json
# 移除 cv2 导入，因为我们现在只做前端展示功能
import numpy as np
from pypinyin import pinyin, Style

class AlignmentService:
    def __init__(self):
        self.steles_data = {}
        self.steles_full_data = []
        self._load_steles()

    def _load_steles(self):
        # Use relative path from this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(current_dir, "..", "data", "steles.json")
        
        if os.path.exists(data_path):
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.steles_full_data = data.get("steles", [])
                for stele in self.steles_full_data:
                    self.steles_data[stele["name"]] = stele["content"]
        else:
            print(f"WARNING: {data_path} not found.")

    def list_steles(self):
        # 返回简化的碑帖元数据列表
        return [{"id": s.get("id"), "name": s["name"], "dynasty": s.get("dynasty"), "author": s.get("author")} for s in self.steles_full_data]

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