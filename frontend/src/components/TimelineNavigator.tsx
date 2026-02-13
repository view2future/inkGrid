import { useState } from 'react';

interface TimelineNavigatorProps {
  dynasties: Record<string, any[]>;
  selectedDynasty: string | null;
  onSelect: (dynasty: string | null) => void;
  totalCount: number;
}

export const TimelineNavigator = ({ 
  dynasties, 
  selectedDynasty, 
  onSelect,
  totalCount 
}: TimelineNavigatorProps) => {
  const dynastyList = Object.keys(dynasties).sort((a, b) => {
    // 简单排序，实际可以根据 DYNASTY_CONFIG 排序
    return a.localeCompare(b);
  });

  return (
    <div className="mt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">朝代时间轴</h3>
        <span className="text-sm text-gray-500">{totalCount} 碑帖</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {dynastyList.map(dynasty => (
          <button
            key={dynasty}
            onClick={() => onSelect(selectedDynasty === dynasty ? null : dynasty)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDynasty === dynasty
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {dynasty}
          </button>
        ))}
        
        {selectedDynasty && (
          <button
            onClick={() => onSelect(null)}
            className="ml-auto px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
};