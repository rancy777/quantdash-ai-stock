import React from 'react';
import { TECH_TABS } from './constants';
import { ActiveTech } from './types';

type StockHoverCardTechTabsProps = {
  showMA: boolean;
  showChanStructure: boolean;
  activeTech: ActiveTech;
  onToggleMA: () => void;
  onToggleChanStructure: () => void;
  onSelectTech: (tab: ActiveTech) => void;
};

export default function StockHoverCardTechTabs({
  showMA,
  showChanStructure,
  activeTech,
  onToggleMA,
  onToggleChanStructure,
  onSelectTech,
}: StockHoverCardTechTabsProps) {
  return (
    <div className="flex border-t border-b border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-[#1e222d] overflow-x-auto z-20 relative">
      <button
        onClick={onToggleMA}
        className={`px-3 py-2 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 transition-colors ${
          showMA
            ? 'text-[#f0b90b] bg-amber-50 dark:bg-amber-500/10'
            : 'text-slate-500 dark:text-[#848e9c]'
        }`}
      >
        MA均线
      </button>
      <button
        onClick={onToggleChanStructure}
        className={`px-3 py-2 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 transition-colors ${
          showChanStructure
            ? 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10'
            : 'text-slate-500 dark:text-[#848e9c]'
        }`}
      >
        缠论结构
      </button>
      {TECH_TABS.map((tab) => (
        <div
          key={tab}
          onClick={() => onSelectTech(tab)}
          className={`px-3 py-2 cursor-pointer whitespace-nowrap hover:bg-slate-200 dark:hover:bg-[#2b313f] transition-colors ${activeTech === tab ? 'text-[#f0b90b] bg-slate-200 dark:bg-[#2b313f]' : 'text-slate-500 dark:text-[#848e9c]'}`}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
