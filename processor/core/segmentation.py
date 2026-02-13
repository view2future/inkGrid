import cv2
import numpy as np
from paddleocr import PaddleOCR
from typing import List, Dict, Any, Tuple
import difflib

# Initialize PaddleOCR globally
ocr_engine = PaddleOCR(
    use_angle_cls=False, 
    lang="ch",
    det_db_unclip_ratio=1.2,
    det_db_box_thresh=0.3,
    det_db_thresh=0.2
)

def sort_boxes_to_list(polys: List[np.ndarray], texts: List[str], scores: List[float]) -> List[Dict[str, Any]]:
    if not polys: return []
    items = []
    widths = []
    for poly, txt, score in zip(polys, texts, scores):
        xs, ys = poly[:, 0], poly[:, 1]
        w, h = np.max(xs) - np.min(xs), np.max(ys) - np.min(ys)
        widths.append(w)
        items.append({
            'cx': np.mean(xs), 'cy': np.mean(ys), 
            'bbox': [int(np.min(xs)), int(np.min(ys)), int(w), int(h)],
            'poly': poly, 'ocr_text': txt, 'ocr_conf': float(score)
        })
    
    median_w = np.median(widths) if widths else 50
    items.sort(key=lambda k: k['cx'], reverse=True)
    
    columns = []
    current_col = []
    if items:
        current_col.append(items[0])
        current_mean_x = items[0]['cx']
        for i in range(1, len(items)):
            item = items[i]
            if abs(item['cx'] - current_mean_x) < median_w * 0.8:
                current_col.append(item)
            else:
                columns.append(current_col)
                current_col = [item]
                current_mean_x = item['cx']
        columns.append(current_col)
    
    final_sorted = []
    for col in columns:
        col.sort(key=lambda k: k['cy'])
        final_sorted.extend(col)
    return final_sorted

def find_best_matching_substring(query: str, target: str) -> str:
    """
    Find the most likely substring in target that matches the query (OCR result).
    """
    if not query or not target: return target
    
    # Use SequenceMatcher to find the best match
    s = difflib.SequenceMatcher(None, query, target)
    match = s.find_longest_match(0, len(query), 0, len(target))
    
    # Heuristic: Take a window around the best match
    # For V1, let's just return the substring if it's reasonably long.
    # But wait, we need EXACT count. 
    # If the user says yishan.jpg has 135 chars, and our OCR is garbage, 
    # we should probably just take the first 135 chars of GT if we can't find a better anchor.
    
    return target # Fallback to full target for now

def segment_image_paddle_with_gt(image_path: str, ground_truth_text: str) -> List[Dict[str, Any]]:
    """
    Hybrid approach: Use PaddleOCR to detect lines/chunks, 
    then use Ground Truth to slice them into individual characters.
    """
    result = ocr_engine.ocr(image_path)
    if not result or not isinstance(result, list): return []
    
    res_dict = result[0]
    dt_polys = res_dict.get('dt_polys', [])
    rec_texts = res_dict.get('rec_texts', [])
    rec_scores = res_dict.get('rec_scores', [])
    
    # 1. Sort detected chunks (Lines)
    sorted_chunks = sort_boxes_to_list(dt_polys, rec_texts, rec_scores)
    if not sorted_chunks: return []
    
    # 2. Dynamic Window Selection (Partial Image Handling)
    # Combine all OCR text to find where we are in the GT
    ocr_full = "".join(rec_texts)
    # In V2, we would use this to crop ground_truth_text.
    # For now, let's assume the provided GT matches the image content.
    effective_gt = ground_truth_text 
    
    # 3. Global allocation of characters to chunks
    total_height = sum(c['bbox'][3] for c in sorted_chunks)
    gt_len = len(effective_gt)
    
    # Proportional allocation
    chars_per_chunk = []
    for chunk in sorted_chunks:
        h = chunk['bbox'][3]
        n = round((h / total_height) * gt_len)
        if n < 1: n = 1
        chars_per_chunk.append(n)
        
    # Adjust to match exactly gt_len
    current_total = sum(chars_per_chunk)
    max_iter = 100
    iters = 0
    while current_total != gt_len and iters < max_iter:
        iters += 1
        if current_total < gt_len:
            # Need more. Find chunk that is "least crowded"
            idx = np.argmax([c['bbox'][3] / cp for c, cp in zip(sorted_chunks, chars_per_chunk)])
            chars_per_chunk[idx] += 1
            current_total += 1
        else:
            # Need fewer. Find chunk that is "most crowded"
            idx = np.argmin([c['bbox'][3] / cp for c, cp in zip(sorted_chunks, chars_per_chunk)])
            if chars_per_chunk[idx] > 1:
                chars_per_chunk[idx] -= 1
                current_total -= 1
            else:
                # Can't reduce further, find any chunk > 1
                for j in range(len(chars_per_chunk)):
                    if chars_per_chunk[j] > 1:
                        chars_per_chunk[j] -= 1
                        current_total -= 1
                        break
                
    # 4. Slice Chunks
    final_results = []
    char_ptr = 0
    
    for chunk, n in zip(sorted_chunks, chars_per_chunk):
        x, y, w, h = chunk['bbox']
        h_unit = h / n
        
        for i in range(n):
            if char_ptr < gt_len:
                char = effective_gt[char_ptr]
                char_ptr += 1
            else:
                char = None
                
            final_results.append({
                "char": char,
                "bbox": [x, int(y + i * h_unit), w, int(h_unit)],
                "ocr_text": chunk['ocr_text'] if i == 0 else "", 
                "ocr_conf": chunk['ocr_conf']
            })
            
    return final_results