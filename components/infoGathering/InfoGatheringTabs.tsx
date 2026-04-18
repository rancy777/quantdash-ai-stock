import type { ReactNode } from 'react';
import { Bell, FileText, Newspaper, PenSquare, Users } from 'lucide-react';

import type { InfoGatheringTabId } from './types';

type InfoGatheringTabsProps = {
  activeTab: InfoGatheringTabId;
  onChange: (tab: InfoGatheringTabId) => void;
};

const tabs: Array<{ id: InfoGatheringTabId; label: string; icon: ReactNode }> = [
  { id: 'all', label: '全部', icon: <LayersIcon /> },
  { id: 'notice', label: '公告', icon: <Bell size={14} /> },
  { id: 'news', label: '新闻', icon: <Newspaper size={14} /> },
  { id: 'report', label: '研报', icon: <FileText size={14} /> },
  { id: 'expert', label: '高手', icon: <Users size={14} /> },
  { id: 'review', label: '大V复盘', icon: <PenSquare size={14} /> },
];

const InfoGatheringTabs = ({ activeTab, onChange }: InfoGatheringTabsProps) => {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="flex w-max gap-2 rounded-xl bg-slate-200/50 p-1 dark:bg-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export default InfoGatheringTabs;
