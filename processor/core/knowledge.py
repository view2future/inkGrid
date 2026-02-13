import json
import os
from typing import Optional, List, Dict

class SteleRegistry:
    """
    墨阵碑帖标准库管理类。
    实现从本地 JSON 加载名帖真值，并提供模糊匹配和检索功能。
    """
    def __init__(self, data_path: Optional[str] = None):
        if data_path is None:
            # 默认路径指向同级 data 目录
            data_path = os.path.join(os.path.dirname(__file__), "..", "data", "steles.json")
        
        self.data_path = data_path
        self.steles: List[Dict] = []
        self.load_data()

    def load_data(self):
        """从 JSON 加载数据。"""
        if not os.path.exists(self.data_path):
            print(f"[Warning] Stele database not found at {self.data_path}")
            return
        
        try:
            with open(self.data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.steles = data.get("steles", [])
        except Exception as e:
            print(f"[Error] Failed to load stele registry: {e}")

    def find_stele(self, query: str) -> Optional[Dict]:
        """
        根据名称或别名查找碑帖。
        支持模糊匹配。
        """
        query = query.lower().strip()
        for stele in self.steles:
            # 检查名称
            if query in stele['name'].lower():
                return stele
            # 检查别名
            for alias in stele.get('aliases', []):
                if query in alias.lower():
                    return stele
        return None

    def get_ground_truth(self, stele_name: str) -> Optional[str]:
        """获取标准全文（清洗掉标点和空白）。"""
        stele = self.find_stele(stele_name)
        if not stele:
            return None
        
        content = stele.get('content', '')
        # 清洗：移除所有非汉字符号
        import re
        clean_content = re.sub(r'[^\u4e00-\u9fa5□]', '', content)
        return clean_content

    def list_all(self) -> List[Dict]:
        """列出库中所有碑帖简介。"""
        return [
            {
                "id": s["id"],
                "name": s["name"],
                "dynasty": s["dynasty"],
                "author": s["author"],
                "script_type": s["script_type"],
                "total_chars": s["total_chars"]
            }
            for s in self.steles
        ]

# 保持接口兼容性 (Singleton)
class TextVault(SteleRegistry):
    def fetch_text(self, stele_name: str) -> Optional[str]:
        return self.get_ground_truth(stele_name)
    
    def fetch_info(self, stele_name: str) -> Optional[dict]:
        return self.find_stele(stele_name)

# 导出单例
vault = TextVault()