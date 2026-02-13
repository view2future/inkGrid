import cv2
import numpy as np
from scipy.signal import find_peaks


class GridService:
    def detect_grid_lines(self, image_np, expected_chars=135):
        """
        使用已知字数信息精确切分碑帖
        通过动态规划找到最优的行列分布
        """
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        height, width = gray.shape

        # 自适应阈值
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )

        # 形态学处理
        kernel = np.ones((3, 3), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)

        # 1. 分析行列比例，推断最佳行列数
        best_rows, best_cols = self._estimate_grid_dimensions(thresh, expected_chars)

        print(
            f"Estimated grid: {best_cols} columns × {best_rows} rows = {best_cols * best_rows} cells"
        )

        # 2. 检测垂直线（列）
        v_lines = self._detect_lines_with_count(
            thresh, axis=0, target_count=best_cols + 1
        )

        # 3. 检测水平线（行）
        h_lines = self._detect_lines_with_count(
            thresh, axis=1, target_count=best_rows + 1
        )

        # 确保边界
        h_lines = self._ensure_boundary(h_lines, height)
        v_lines = self._ensure_boundary(v_lines, width)

        print(
            f"Final: {len(h_lines) - 1} rows × {len(v_lines) - 1} columns = {(len(h_lines) - 1) * (len(v_lines) - 1)} cells"
        )

        return h_lines, v_lines

    def _estimate_grid_dimensions(self, thresh, expected_chars):
        """
        根据图像特征和期望字数，估算最佳行列数
        """
        height, width = thresh.shape

        # 计算投影
        col_proj = np.sum(thresh, axis=0)
        row_proj = np.sum(thresh, axis=1)

        # 找可能的列数（基于垂直投影的峰值）
        col_peaks = self._count_peaks(col_proj, min_distance=width // 25)

        # 找可能的行数（基于水平投影的峰值）
        row_peaks = self._count_peaks(row_proj, min_distance=height // 20)

        print(f"Detected peaks: {col_peaks} cols, {row_peaks} rows")

        # 尝试找到最接近 expected_chars 的行列组合
        best_cols = max(1, round(np.sqrt(expected_chars * width / height)))
        best_rows = max(1, round(expected_chars / best_cols))

        # 在合理范围内搜索最佳组合
        min_error = float("inf")
        for cols in range(max(1, col_peaks - 3), col_peaks + 4):
            for rows in range(max(1, row_peaks - 3), row_peaks + 4):
                char_count = cols * rows
                error = abs(char_count - expected_chars)
                if error < min_error:
                    min_error = error
                    best_cols = cols
                    best_rows = rows

        return best_rows, best_cols

    def _count_peaks(self, projection, min_distance=50):
        """估算投影中的峰值数量（文字区域数）"""
        projection = np.asarray(projection).flatten()
        inverted = np.max(projection) - projection

        peaks, _ = find_peaks(
            inverted, distance=min_distance, prominence=np.std(inverted)
        )
        return len(peaks)

    def _detect_lines_with_count(self, thresh, axis, target_count):
        """
        检测指定数量的等分线
        axis=0: 垂直线（列分隔）
        axis=1: 水平线（行分隔）
        """
        if axis == 0:
            projection = np.sum(thresh, axis=0)
            total_dim = thresh.shape[1]
        else:
            projection = np.sum(thresh, axis=1)
            total_dim = thresh.shape[0]

        projection = np.asarray(projection).flatten()

        if target_count <= 2:
            return [0, total_dim]

        # 方法1：尝试基于投影峰值检测
        lines = self._detect_by_peaks(projection, total_dim, target_count)

        # 方法2：如果检测到的线不够，使用均匀分布补充
        if len(lines) < target_count:
            lines = self._interpolate_lines(lines, total_dim, target_count)

        # 方法3：如果检测到的线太多，进行合并
        if len(lines) > target_count:
            lines = self._merge_lines(lines, target_count)

        return sorted(lines)

    def _detect_by_peaks(self, projection, total_dim, target_count):
        """基于峰值检测找分隔线"""
        inverted = np.max(projection) - projection
        min_distance = total_dim // (target_count - 1)

        # 找到文字密度高的峰值（行/列中心）
        peaks, _ = find_peaks(
            inverted,
            distance=max(20, min_distance // 2),
            prominence=np.std(inverted) * 0.2,
            width=2,
        )

        lines = [0]

        if len(peaks) >= 2:
            # 在峰值之间画线
            for i in range(len(peaks) - 1):
                boundary = (peaks[i] + peaks[i + 1]) // 2
                if boundary > lines[-1] + 10:  # 确保最小间隔
                    lines.append(int(boundary))

        if total_dim - lines[-1] > 10:
            lines.append(total_dim)
        else:
            lines[-1] = total_dim

        return lines

    def _interpolate_lines(self, lines, total_dim, target_count):
        """在线之间插入额外的线以达到目标数量"""
        lines = sorted(set(lines))

        while len(lines) < target_count:
            # 找到最大的间隔
            gaps = [(lines[i + 1] - lines[i], i) for i in range(len(lines) - 1)]
            gaps.sort(reverse=True)

            if not gaps or gaps[0][0] < 20:
                break

            # 在最大间隔中间插入新线
            max_gap, idx = gaps[0]
            new_line = (lines[idx] + lines[idx + 1]) // 2
            lines.append(new_line)
            lines.sort()

        return lines

    def _merge_lines(self, lines, target_count):
        """合并多余的线"""
        lines = sorted(set(lines))

        while len(lines) > target_count:
            # 找到最小的间隔并合并
            min_gap = float("inf")
            min_idx = -1

            for i in range(len(lines) - 1):
                gap = lines[i + 1] - lines[i]
                if gap < min_gap:
                    min_gap = gap
                    min_idx = i

            if min_idx >= 0:
                # 移除较近的线（保留中间的）
                del lines[min_idx + 1]

        return lines

    def _ensure_boundary(self, lines, total_dim):
        """确保边界线在图像边缘"""
        if not lines:
            return [0, total_dim]

        lines = sorted(set(lines))

        # 确保起点
        if lines[0] > 5:
            lines = [0] + lines
        else:
            lines[0] = 0

        # 确保终点
        if lines[-1] < total_dim - 5:
            lines.append(total_dim)
        else:
            lines[-1] = total_dim

        return lines
