import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Palette } from 'lucide-react';

interface LimitUpLadderToolbarProps {
  selectedDate: string;
  showColorChain: boolean;
  isSingleDayView: boolean;
  showComparison: boolean;
  comparisonEnabled: boolean;
  disableNextDate: boolean;
  onToggleColorChain: () => void;
  onDateChange: (amount: number) => void;
  onSelectedDateChange: (value: string) => void;
  onToggleSingleDayView: () => void;
  onToggleComparison: () => void;
}

const LimitUpLadderToolbar: React.FC<LimitUpLadderToolbarProps> = ({
  selectedDate,
  showColorChain,
  isSingleDayView,
  showComparison,
  comparisonEnabled,
  disableNextDate,
  onToggleColorChain,
  onDateChange,
  onSelectedDateChange,
  onToggleSingleDayView,
  onToggleComparison,
}) => (
  <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-slate-300/50 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5 gap-4">
    <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
      <span className="w-1 h-5 bg-cyan-500 rounded-full inline-block shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
      连板天梯 <span className="text-xs font-normal text-slate-400 ml-2 hidden lg:inline">近20个交易日复盘</span>
    </h3>
    <div className="flex items-center gap-4">
      <button
        onClick={onToggleColorChain}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border shadow-sm ${
          showColorChain
            ? 'bg-purple-500 text-white border-purple-600 shadow-purple-500/30'
            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
        }`}
      >
        <Palette size={18} />
        <span>连板追踪</span>
      </button>
      <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-600 mx-2 hidden sm:block" />
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <button
          onClick={() => onDateChange(-1)}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="relative group">
          <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
            <Calendar size={14} className="text-slate-400" />
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onSelectedDateChange(event.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-black/20 border border-slate-300 dark:border-slate-600 text-sm font-mono text-slate-700 dark:text-gray-300 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <button
          onClick={() => onDateChange(1)}
          disabled={disableNextDate}
          className={`p-2 rounded-lg transition-colors ${
            disableNextDate
              ? 'text-slate-300 dark:text-gray-700 cursor-not-allowed'
              : 'hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400'
          }`}
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={onToggleSingleDayView}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${
            isSingleDayView
              ? 'bg-cyan-600 text-white border-cyan-500 shadow-cyan-500/30'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
          }`}
        >
          {isSingleDayView ? '退出单日模式' : '进入单日模式'}
        </button>
        <button
          onClick={onToggleComparison}
          disabled={!comparisonEnabled}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${
            showComparison
              ? 'bg-amber-500 text-white border-amber-400 shadow-amber-400/30'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
          } ${
            !comparisonEnabled ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-white/5' : ''
          }`}
        >
          今昨对比
        </button>
      </div>
    </div>
  </div>
);

export default LimitUpLadderToolbar;
