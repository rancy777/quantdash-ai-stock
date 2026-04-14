import React from 'react';
import { Activity, Bell, Grid, Settings, Moon, Sun, User } from 'lucide-react';
import { SyncRuntimeStatus, SyncStatusPayload } from '../types';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  syncStatus: SyncStatusPayload | null;
  runtimeStatus: SyncRuntimeStatus;
}

const Header: React.FC<HeaderProps> = ({ isDark, toggleTheme, syncStatus, runtimeStatus }) => {
  const isRunning = runtimeStatus.state === 'running';
  const hasFailure = syncStatus?.overallStatus === 'failed';
  const statusText = isRunning
    ? '数据同步中'
    : hasFailure
      ? '最近同步异常'
      : '数据已就绪';
  const statusDotClass = isRunning
    ? 'bg-cyan-500 animate-pulse'
    : hasFailure
      ? 'bg-amber-500'
      : 'bg-green-500 animate-pulse';
  const latestTradingDate = syncStatus?.onlineTradingDate ?? '--';

  return (
    <header className={`h-16 border-b flex items-center justify-between px-6 sticky top-0 z-50 backdrop-blur-md transition-colors
      ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white/60'}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity size={20} className="text-white" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-gray-400 font-sans tracking-tight">
          Quant<span className="text-cyan-500 dark:text-cyan-400">Dash</span>
        </h1>
        <div className={`ml-8 hidden md:flex gap-1 p-1 rounded-lg transition-colors ${isDark ? 'bg-white/5' : 'bg-slate-200/50'}`}>
          <button className={`px-3 py-1 text-xs font-medium rounded-md shadow-sm transition-all ${isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-800 shadow-sm'}`}>沪深</button>
          <button className={`px-3 py-1 text-xs font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>港股</button>
          <button className={`px-3 py-1 text-xs font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>美股</button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-4 text-sm font-mono mr-4 transition-colors text-slate-500 dark:text-gray-400">
           <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}></span>
            {statusText}
           </span>
           <span>交易日: {latestTradingDate}</span>
        </div>
        
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className={`p-2 rounded-lg transition-colors relative ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-gray-900"></span>
        </button>
        <button className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          <Grid size={18} />
        </button>
        <button className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}>
          <Settings size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs border border-white/20 cursor-pointer shadow-md">
          JD
        </div>
      </div>
    </header>
  );
};

export default Header;
