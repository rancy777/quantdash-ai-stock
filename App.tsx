
import React, { Suspense, lazy, useState, useEffect } from 'react';
import Header from './components/Header';
import { LayoutDashboard, Sliders, Radio, Activity, TrendingUp, Layers, Bot, Github, Sparkles } from 'lucide-react';
import SyncStatusCard from './components/SyncStatusCard';
import { fetchSyncRuntimeStatus, loadSyncStatus } from './services/syncStatusService';
import { SyncRuntimeStatus, SyncStatusPayload } from './types';
import { AIStockObservationRequest, subscribeAIStockObservationRequest } from './services/aiNavigationService';
import { StockDetailRequest, subscribeStockDetailRequest } from './services/stockNavigationService';

const StockInfoSection = lazy(() => import('./components/StockInfoSection'));
const ScreenerSection = lazy(() => import('./components/ScreenerSection'));
const InfoGatheringSection = lazy(() => import('./components/InfoGatheringSection'));
const SentimentSection = lazy(() => import('./components/SentimentSection'));
const LimitUpLadderSection = lazy(() => import('./components/LimitUpLadderSection'));
const SectorCycleSection = lazy(() => import('./components/SectorCycleSection'));
const AIIntegrationSection = lazy(() => import('./components/AIIntegrationSection'));
const SkillsSection = lazy(() => import('./components/SkillsSection'));
const GitHubSection = lazy(() => import('./components/GitHubSection'));

type TabType = 'stock' | 'screener' | 'info' | 'sentiment' | 'ladder' | 'sector' | 'ai' | 'skills' | 'github';

const SectionLoader: React.FC = () => (
  <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400">
    正在加载模块...
  </div>
);

const DEFAULT_RUNTIME_STATUS: SyncRuntimeStatus = {
  state: 'idle',
  trigger: null,
  mode: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
  pid: null,
};

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  // Track which tabs have been initialized to perform lazy loading (only load when visited)
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(new Set(['stock']));
  const [isDark, setIsDark] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatusPayload | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<SyncRuntimeStatus>(DEFAULT_RUNTIME_STATUS);
  const [syncStatusLoading, setSyncStatusLoading] = useState(true);
  const [pendingStockObservationRequest, setPendingStockObservationRequest] = useState<AIStockObservationRequest | null>(null);
  const [pendingStockDetailRequest, setPendingStockDetailRequest] = useState<StockDetailRequest | null>(null);

  // Toggle dark mode class on html element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    // Mark tab as visited when activated
    setVisitedTabs(prev => {
        const next = new Set(prev);
        next.add(activeTab);
        return next;
    });
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    const refreshSyncState = async () => {
      const [nextStatus, nextRuntime] = await Promise.all([
        loadSyncStatus(),
        fetchSyncRuntimeStatus(),
      ]);
      if (cancelled) return;
      setSyncStatus(nextStatus);
      setRuntimeStatus(nextRuntime);
      setSyncStatusLoading(false);
    };

    refreshSyncState();
    const interval = window.setInterval(refreshSyncState, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    return subscribeAIStockObservationRequest((request) => {
      setPendingStockObservationRequest(request);
      setActiveTab('ai');
      setVisitedTabs((prev) => {
        const next = new Set(prev);
        next.add('ai');
        return next;
      });
    });
  }, []);

  useEffect(() => {
    return subscribeStockDetailRequest((request) => {
      setPendingStockDetailRequest(request);
      setActiveTab('stock');
      setVisitedTabs((prev) => {
        const next = new Set(prev);
        next.add('stock');
        return next;
      });
    });
  }, []);

  const toggleTheme = () => setIsDark(!isDark);

  const menuItems = [
    { id: 'stock', label: '股票信息', icon: <LayoutDashboard size={20} /> },
    { id: 'screener', label: '选股工具', icon: <Sliders size={20} /> },
    { id: 'ladder', label: '连板天梯', icon: <TrendingUp size={20} /> },
    { id: 'sector', label: '板块周期', icon: <Layers size={20} /> },
    { id: 'info', label: '信息采集', icon: <Radio size={20} /> },
    { id: 'sentiment', label: '情绪周期', icon: <Activity size={20} /> },
    { id: 'ai', label: 'AI对接', icon: <Bot size={20} /> },
    { id: 'skills', label: 'Skills', icon: <Sparkles size={20} /> },
    { id: 'github', label: 'GitHub', icon: <Github size={20} /> },
  ];

  const renderLazySection = (tab: TabType, element: React.ReactNode) => (
    <div className={activeTab === tab ? 'block h-full' : 'hidden h-full'}>
      {visitedTabs.has(tab) && (
        <Suspense fallback={<SectionLoader />}>
          {element}
        </Suspense>
      )}
    </div>
  );

  return (
    <div className={`h-screen font-sans selection:bg-cyan-500/30 overflow-hidden flex flex-col transition-colors duration-500
      ${isDark 
        ? 'bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-gray-950 to-black text-gray-200' 
        : 'bg-slate-50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-white text-slate-800'
      }`}>
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] transition-colors duration-500 ${isDark ? 'bg-blue-900/10' : 'bg-blue-400/20'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full blur-[100px] transition-colors duration-500 ${isDark ? 'bg-cyan-900/10' : 'bg-cyan-400/20'}`} />
      </div>

      <Header
        isDark={isDark}
        toggleTheme={toggleTheme}
        syncStatus={syncStatus}
        runtimeStatus={runtimeStatus}
      />

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside className={`w-64 flex-shrink-0 border-r backdrop-blur-md flex flex-col transition-all duration-300
          ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white/60'}`}>
          <div className="p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  activeTab === item.id 
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-cyan-500/20' 
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                {/* Active Indicator Line */}
                {activeTab === item.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_10px_#22d3ee]" />
                )}
                
                <span className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className="font-medium tracking-wide">{item.label}</span>
                
                {/* Hover Glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </button>
            ))}
          </div>
          
          <div className={`mt-auto p-6 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
             <SyncStatusCard
               isDark={isDark}
               status={syncStatus}
               runtimeStatus={runtimeStatus}
               loading={syncStatusLoading}
               onRefresh={async () => {
                 const [nextStatus, nextRuntime] = await Promise.all([
                   loadSyncStatus(),
                   fetchSyncRuntimeStatus(),
                 ]);
                 setSyncStatus(nextStatus);
                 setRuntimeStatus(nextRuntime);
               }}
             />
             <div className={`p-4 rounded-xl border ${isDark ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-white/5' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100'}`}>
                <h4 className={`text-sm font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>Pro 版本</h4>
                <p className="text-xs text-slate-500 dark:text-gray-500 mb-3">解锁 AI 深度投研功能</p>
                <button className="w-full py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 transition-shadow hover:scale-[1.02] active:scale-[0.98]">立即升级</button>
             </div>
          </div>
        </aside>

        {/* Main Content Area - KEEP ALIVE IMPLEMENTATION */}
        <main className="flex-1 p-6 overflow-hidden h-full">
           <div className="h-full w-full max-w-[1920px] mx-auto relative">
              {/* We render all visited tabs but hide the inactive ones using CSS. 
                  This preserves their state (scroll, data, etc.) */}
              {renderLazySection(
                'stock',
                <StockInfoSection
                  stockDetailRequest={pendingStockDetailRequest}
                  onStockDetailRequestHandled={(request) => {
                    setPendingStockDetailRequest((current) =>
                      current?.requestedAt === request.requestedAt ? null : current
                    );
                  }}
                />
              )}
              {renderLazySection('screener', <ScreenerSection />)}
              {renderLazySection('ladder', <LimitUpLadderSection />)}
              {renderLazySection('sector', <SectorCycleSection />)}
              {renderLazySection('info', <InfoGatheringSection />)}
              {renderLazySection('sentiment', <SentimentSection />)}
              {renderLazySection(
                'ai',
                <AIIntegrationSection
                  stockObservationRequest={pendingStockObservationRequest}
                  onStockObservationRequestHandled={(request) => {
                    setPendingStockObservationRequest((current) =>
                      current?.requestedAt === request.requestedAt ? null : current
                    );
                  }}
                />
              )}
              {renderLazySection('skills', <SkillsSection />)}
              {renderLazySection('github', <GitHubSection />)}

           </div>
        </main>
      </div>
    </div>
  );
}

export default App;
