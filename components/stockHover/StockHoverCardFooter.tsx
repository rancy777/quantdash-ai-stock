import React from 'react';
import { FileText, Info, LayoutGrid, Plus, Sparkles } from 'lucide-react';

type StockHoverCardFooterProps = {
  onObserve: () => void;
};

export default function StockHoverCardFooter({ onObserve }: StockHoverCardFooterProps) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-[#1e222d] z-20 relative xl:grid-cols-5">
      <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
        <Plus size={14} /> 加自选
      </button>
      <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
        <LayoutGrid size={14} /> 加板块
      </button>
      <button
        onClick={onObserve}
        className="flex-1 flex items-center justify-center gap-1 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-200 text-xs py-2 rounded transition-colors"
      >
        <Sparkles size={14} /> AI观察
      </button>
      <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
        <FileText size={14} /> 个股资讯
      </button>
      <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
        <Info size={14} /> 个股资料
      </button>
    </div>
  );
}
