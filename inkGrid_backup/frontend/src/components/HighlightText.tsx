import { useMemo } from 'react';

interface HighlightTextProps {
  text: string;
  highlight?: string;
  className?: string;
}

export const HighlightText = ({ text, highlight, className = '' }: HighlightTextProps) => {
  if (!highlight || !text) {
    return <span className={className}>{text}</span>;
  }

  // 简单的高亮逻辑（不区分大小写）
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (regex.test(part)) {
          return (
            <mark key={index} className="bg-yellow-200 text-black px-1 rounded">
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};