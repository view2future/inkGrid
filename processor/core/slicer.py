"""
Image Slicer for Stele Characters based on VLM coordinates.

根据VLM返回的坐标，精确切分碑帖图像中的每个字符。
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageOps
from typing import List, Dict, Any, Optional, Tuple
import json


class CharacterSlicer:
    """
    字符切分器 - 基于VLM提供的精确坐标切分碑帖图像
    """
    
    def __init__(self, output_dir: str = "./sliced_chars"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # 切分参数
        self.padding_ratio = 0.05  # 内边距比例（防止字符贴边）
        self.min_size = 32  # 最小字符尺寸
        
    def slice_characters(
        self,
        image_path: str,
        characters: List[Dict[str, Any]],
        stele_name: str,
        output_format: str = "jpg",
        quality: int = 95
    ) -> List[Dict[str, Any]]:
        """
        根据VLM识别结果切分所有字符
        
        Args:
            image_path: 原始碑帖图像路径
            characters: VLM返回的字符列表，包含bbox信息
            stele_name: 碑帖名称（用于命名）
            output_format: 输出格式
            quality: JPEG质量
            
        Returns:
            包含切分后图像路径的字符列表
        """
        # 读取原始图像
        img = Image.open(image_path)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            
        img_width, img_height = img.size
        
        sliced_results = []
        
        for char_data in characters:
            bbox = char_data['bbox']  # [x, y, w, h] in pixels
            x, y, w, h = bbox
            
            # 添加内边距
            pad_x = int(w * self.padding_ratio)
            pad_y = int(h * self.padding_ratio)
            
            # 计算切分区域（确保不越界）
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(img_width, x + w + pad_x)
            y2 = min(img_height, y + h + pad_y)
            
            # 切分字符
            char_img = img.crop((x1, y1, x2, y2))
            
            # 标准化尺寸（保持比例）
            char_img = self._normalize_size(char_img)
            
            # 生成文件名
            filename = self._generate_filename(
                stele_name=stele_name,
                index=char_data['index'],
                row=char_data.get('row', 0),
                col=char_data.get('col', 0),
                char=char_data['char'],
                ext=output_format
            )
            
            output_path = os.path.join(self.output_dir, filename)
            
            # 保存图像
            if output_format.lower() in ['jpg', 'jpeg']:
                char_img.save(output_path, 'JPEG', quality=quality)
            else:
                char_img.save(output_path, output_format.upper())
            
            # 构建结果
            result = char_data.copy()
            result['sliced_image'] = output_path
            result['sliced_bbox'] = [x1, y1, x2 - x1, y2 - y1]
            sliced_results.append(result)
            
        return sliced_results
    
    def _normalize_size(self, img: Image.Image, target_size: int = 128) -> Image.Image:
        """
        标准化图像尺寸，保持宽高比
        
        Args:
            img: 输入图像
            target_size: 目标尺寸（长边的长度）
            
        Returns:
            标准化后的图像
        """
        w, h = img.size
        
        # 计算缩放比例
        max_dim = max(w, h)
        if max_dim < self.min_size:
            # 如果图像太小，放大到最小尺寸
            scale = self.min_size / max_dim
        else:
            # 否则保持原大小或缩小到目标尺寸
            scale = min(1.0, target_size / max_dim)
            
        new_w = int(w * scale)
        new_h = int(h * scale)
        
        # 使用LANCZOS重采样
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        return img
    
    def _generate_filename(
        self,
        stele_name: str,
        index: int,
        row: int,
        col: int,
        char: str,
        ext: str
    ) -> str:
        """
        生成规范的文件名
        
        命名规范: {碑帖名}_char_{序号:03d}_r{行:02d}_c{列:02d}_{字符}.{扩展名}
        
        例如: 峄山刻石_char_001_r01_c01_皇.jpg
        """
        # 清理碑帖名（移除特殊字符）
        safe_name = stele_name.replace('《', '').replace('》', '').replace(' ', '_')
        
        # 清理字符（处理□等特殊情况）
        safe_char = char if char and char.strip() else 'unknown'
        
        filename = f"{safe_name}_char_{index:03d}_r{row:02d}_c{col:02d}_{safe_char}.{ext}"
        
        return filename
    
    def create_visualization(
        self,
        image_path: str,
        characters: List[Dict[str, Any]],
        output_path: str = None,
        draw_boxes: bool = True,
        draw_labels: bool = True
    ) -> str:
        """
        创建带标注的可视化图像
        
        Args:
            image_path: 原始图像路径
            characters: 字符列表
            output_path: 输出路径
            draw_boxes: 是否绘制边界框
            draw_labels: 是否绘制标签
            
        Returns:
            输出图像路径
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
            
        for char_data in characters:
            bbox = char_data['bbox']
            x, y, w, h = bbox
            
            if draw_boxes:
                # 绘制边界框（绿色）
                cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            if draw_labels:
                # 准备标签文字
                label = f"{char_data['index']}.{char_data['char']}"
                
                # 计算文字位置
                label_y = y - 5 if y > 20 else y + h + 15
                
                # 绘制文字背景
                (text_w, text_h), _ = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
                )
                cv2.rectangle(
                    img,
                    (x, label_y - text_h - 2),
                    (x + text_w, label_y + 2),
                    (0, 0, 0),
                    -1
                )
                
                # 绘制文字（白色）
                cv2.putText(
                    img,
                    label,
                    (x, label_y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (255, 255, 255),
                    1
                )
        
        if output_path is None:
            base, ext = os.path.splitext(image_path)
            output_path = f"{base}_annotated{ext}"
        
        cv2.imwrite(output_path, img)
        return output_path


def process_stele_image(
    image_path: str,
    stele_name: str,
    script_type: str,
    output_dir: str,
    vlm_client=None,
    create_viz: bool = True
) -> Dict[str, Any]:
    """
    完整的碑帖处理流程：VLM识别 + 图像切分 + 可视化
    
    Args:
        image_path: 碑帖图像路径
        stele_name: 碑帖名称
        script_type: 书体类型
        output_dir: 输出目录
        vlm_client: VLM客户端（可选）
        create_viz: 是否创建可视化
        
    Returns:
        处理结果字典
    """
    from .inference import run_vlm_analysis
    
    print(f"\n{'='*60}")
    print(f"Processing: {stele_name}")
    print(f"Image: {image_path}")
    print(f"{'='*60}\n")
    
    # Step 1: VLM识别
    print("Step 1: VLM Analysis...")
    analysis_result = run_vlm_analysis(
        image_path=image_path,
        stele_name=stele_name,
        script_type=script_type,
        use_ground_truth=True
    )
    
    characters = analysis_result['characters']
    print(f"✓ Detected {len(characters)} characters\n")
    
    # Step 2: 图像切分
    print("Step 2: Slicing characters...")
    slicer = CharacterSlicer(output_dir=output_dir)
    sliced = slicer.slice_characters(
        image_path=image_path,
        characters=characters,
        stele_name=stele_name
    )
    print(f"✓ Sliced {len(sliced)} characters to {output_dir}\n")
    
    # Step 3: 可视化
    viz_path = None
    if create_viz:
        print("Step 3: Creating visualization...")
        viz_path = slicer.create_visualization(
            image_path=image_path,
            characters=characters,
            output_path=os.path.join(output_dir, f"{stele_name}_annotated.jpg")
        )
        print(f"✓ Visualization saved to {viz_path}\n")
    
    # 保存完整结果
    result_path = os.path.join(output_dir, f"{stele_name}_analysis.json")
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump({
            'stele_info': analysis_result['info'],
            'total_detected': analysis_result['total_detected'],
            'image_dimensions': analysis_result['image_dimensions'],
            'characters': sliced
        }, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Analysis result saved to {result_path}\n")
    
    return {
        'stele_name': stele_name,
        'total_chars': len(sliced),
        'output_dir': output_dir,
        'sliced_images': [s['sliced_image'] for s in sliced],
        'visualization': viz_path,
        'analysis_file': result_path
    }
