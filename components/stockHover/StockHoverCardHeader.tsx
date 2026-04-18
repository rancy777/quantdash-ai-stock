import React from 'react';
import { Lock, Maximize2, Minimize2 } from 'lucide-react';
import { Stock } from '../../types';

type StockHoverCardHeaderProps = {
  stock: Stock;
  isLocked: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
};

export default function StockHoverCardHeader({
  stock,
  isLocked,
  isExpanded,
  onToggleExpanded,
}: StockHoverCardHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e222d] flex justify-between items-center z-20 relative">
      <div className="flex items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-[#e1e4ea]">{stock.name}</h3>
          <div className="text-sm text-slate-500 dark:text-[#848e9c] mt-0.5">{stock.symbol}</div>
        </div>
        {isLocked && (
          <div className="flex items-center gap-1 text-[#f0b90b] text-xs border border-[#f0b90b]/30 bg-[#f0b90b]/10 px-2 py-1 rounded">
            <Lock size={12} />
            <span>已锁定</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleExpanded}
          className="p-2 rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-[#848e9c] hover:text-[#f0b90b] hover:border-[#f0b90b]/50 transition-colors"
          title={isExpanded ? '还原尺寸' : '放大查看'}
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <div className="text-right">
          <div
            className={`text-2xl font-bold font-mono ${stock.pctChange >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}
          >
            {stock.price.toFixed(2)}
          </div>
          <div className="flex gap-4 text-sm font-mono mt-0.5">
            <span className={`${stock.pctChange >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
              {stock.pctChange > 0 ? '+' : ''}
              {stock.pctChange}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
