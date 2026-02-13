import json
from typing import List, Dict, Any
import difflib

class TextAligner:
    """
    将 VLM 识别出的原始字符序列与标准文本(GT)进行对齐。
    用于纠正 VLM 的错字、漏字。
    """
    def __init__(self, ground_truth: str):
        self.gt = "".join(ground_truth.split()) # 移除空白符
        
    def align(self, vlm_chars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        使用序列比对算法进行对齐。
        vlm_chars: 包含 'char' (simplified) 的列表
        """
        vlm_text = "".join([c.get('char', '□') for c in vlm_chars])
        
        # 使用 SequenceMatcher 寻找最佳匹配
        matcher = difflib.SequenceMatcher(None, self.gt, vlm_text)
        
        aligned_results = []
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                # 完全匹配，保留 VLM 的坐标，使用 GT 的文字
                for i, j in zip(range(i1, i2), range(j1, j2)):
                    char_data = vlm_chars[j].copy()
                    char_data['gt_char'] = self.gt[i]
                    char_data['status'] = 'matched'
                    aligned_results.append(char_data)
            elif tag == 'replace':
                # 文字不一致，以 GT 为准，坐标沿用 VLM
                for i, j in zip(range(i1, i2), range(j1, j2)):
                    char_data = vlm_chars[j].copy()
                    char_data['gt_char'] = self.gt[i]
                    char_data['status'] = 'corrected'
                    aligned_results.append(char_data)
            elif tag == 'delete':
                # GT 中有，但 VLM 漏识别了
                for i in range(i1, i2):
                    aligned_results.append({
                        'gt_char': self.gt[i],
                        'status': 'missing',
                        'char': '□',
                        'bbox': [0,0,0,0] # 标记为缺失
                    })
            elif tag == 'insert':
                # VLM 多识别了（幻觉）
                # 通常忽略
                pass
                
        return aligned_results