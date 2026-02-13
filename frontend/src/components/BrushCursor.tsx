import React from 'react';

interface BrushCursorProps {
  width?: number;
  height?: number;
}

const BrushCursor: React.FC<BrushCursorProps> = ({ width = 48, height = 48 }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 毛笔头 - 较大且带有墨汁 */}
      <ellipse
        cx="14"
        cy="34"
        rx="8"
        ry="10"
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="0.5"
      />
      <ellipse
        cx="14"
        cy="36"
        rx="6"
        ry="8"
        fill="#0d0d0d"
      />
      
      {/* 毛笔头白色部分 */}
      <ellipse
        cx="14"
        cy="32"
        rx="7"
        ry="9"
        fill="#f5f5f5"
        opacity="0.9"
      />
      
      {/* 墨汁渐变效果 */}
      <ellipse
        cx="14"
        cy="38"
        rx="4"
        ry="5"
        fill="#000"
        opacity="0.7"
      />
      
      {/* 笔斗（连接处） */}
      <path
        d="M10 22 Q14 24 18 22 L17 28 Q14 29 11 28 Z"
        fill="#4a3728"
        stroke="#2d1f14"
        strokeWidth="0.5"
      />
      
      {/* 细长的笔杆 */}
      <path
        d="M12 24 L16 24 L15 8 L13 8 Z"
        fill="#c4956a"
        stroke="#a67c52"
        strokeWidth="0.5"
      />
      
      {/* 笔杆木纹效果 */}
      <line x1="13.5" y1="10" x2="13.5" y2="22" stroke="#b0895f" strokeWidth="0.5" opacity="0.5" />
      <line x1="14.5" y1="10" x2="14.5" y2="22" stroke="#b0895f" strokeWidth="0.5" opacity="0.5" />
      
      {/* 笔杆装饰线 */}
      <ellipse cx="14" cy="12" rx="1.5" ry="0.5" fill="#2d1f14" />
      <ellipse cx="14" cy="18" rx="1.5" ry="0.5" fill="#2d1f14" />
      
      {/* 笔尾 */}
      <ellipse cx="14" cy="7" rx="1.5" ry="1" fill="#4a3728" />
    </svg>
  );
};

export default BrushCursor;

// 作为CSS光标使用的data URL
// hotspot 设置为 4 28，对应笔尖中心位置，确保点击精准
export const brushCursorCSS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 48 48' fill='none'%3E%3Cellipse cx='14' cy='34' rx='8' ry='10' fill='%231a1a1a' stroke='%23333' stroke-width='0.5'/%3E%3Cellipse cx='14' cy='36' rx='6' ry='8' fill='%230d0d0d'/%3E%3Cellipse cx='14' cy='32' rx='7' ry='9' fill='%23f5f5f5' opacity='0.9'/%3E%3Cellipse cx='14' cy='38' rx='4' ry='5' fill='%23000' opacity='0.7'/%3E%3Cpath d='M10 22 Q14 24 18 22 L17 28 Q14 29 11 28 Z' fill='%234a3728' stroke='%232d1f14' stroke-width='0.5'/%3E%3Cpath d='M12 24 L16 24 L15 8 L13 8 Z' fill='%23c4956a' stroke='%23a67c52' stroke-width='0.5'/%3E%3Cellipse cx='14' cy='12' rx='1.5' ry='0.5' fill='%232d1f14'/%3E%3Cellipse cx='14' cy='18' rx='1.5' ry='0.5' fill='%232d1f14'/%3E%3Cellipse cx='14' cy='7' rx='1.5' ry='1' fill='%234a3728'/%3E%3C/svg%3E") 4 28, auto`;
