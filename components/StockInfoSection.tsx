
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import DataFreshnessBadge from './ui/DataFreshnessBadge';
import { getStockList } from '../services/quotesService';
import { getStockListDataFreshness } from '../services/quotes/stockLists';
import { DataFreshnessMeta, Stock } from '../types';
import { Search, TrendingUp, TrendingDown, Layers, Activity, Loader2 } from 'lucide-react';
import { StockDetailRequest } from '../services/stockNavigationService';

const StockHoverCard = lazy(() => import('./StockHoverCard'));

interface StockInfoSectionProps {
  stockDetailRequest?: StockDetailRequest | null;
  onStockDetailRequestHandled?: (request: StockDetailRequest) => void;
}

const StockInfoSection: React.FC<StockInfoSectionProps> = ({
  stockDetailRequest = null,
  onStockDetailRequestHandled,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataFreshness, setDataFreshness] = useState<DataFreshnessMeta | null>(null);

  // Hover Card State
  const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 }); // Fixed position when card opens
  
  // Refs for logic
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 }); // Track mouse without re-render

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getStockList();
      setStocks(data);
      setDataFreshness(getStockListDataFreshness());
      if (data.length > 0) {
        setSelectedStock(data[0]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredStocks = stocks.filter(s => 
    s.name.includes(searchTerm) || s.symbol.includes(searchTerm)
  );

  useEffect(() => {
    if (!stockDetailRequest || stocks.length === 0) return;
    const target = stocks.find((item) => item.symbol === stockDetailRequest.symbol);
    if (target) {
      setSelectedStock(target);
      setSearchTerm(target.symbol);
    }
    onStockDetailRequestHandled?.(stockDetailRequest);
  }, [stockDetailRequest, stocks, onStockDetailRequestHandled]);

  const handleRowMouseEnter = (e: React.MouseEvent, stock: Stock) => {
    // Clear any pending close timer if we moved from card back to row, or row to row
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Debounce showing the card
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    hoverTimeoutRef.current = setTimeout(() => {
      // Freeze the position at the moment the card opens based on latest mouse pos
      setCardPos(mousePosRef.current);
      setHoveredStock(stock);
    }, 400); // 400ms delay before opening
  };

  const handleRowMouseMove = (e: React.MouseEvent) => {
    // Always track latest mouse position in ref
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleRowMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    // Delay closing to allow user to move into the card
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredStock(null);
    }, 300);
  };

  const handleCardMouseEnter = () => {
    // If user enters the card, cancel the close timer
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    // If user leaves card, close it immediately (or add small delay if needed)
    setHoveredStock(null);
  };

  // Calculate position styles
  const getCardStyle = () => {
    const cardWidth = 750;
    const cardHeight = 600;
    const gap = 15; // Decreased gap to make it easier to enter
    
    // Use the frozen cardPos, not the dynamic mousePosRef
    let left = cardPos.x + gap;
    let top = cardPos.y - cardHeight / 4; 
    
    // Boundary check right
    if (left + cardWidth > window.innerWidth) {
      left = cardPos.x - cardWidth - gap;
    }
    // Boundary check bottom
    if (top + cardHeight > window.innerHeight) {
       top = window.innerHeight - cardHeight - gap;
    }
    // Boundary check top
    if (top < gap) {
      top = gap;
    }

    return {
      position: 'fixed' as 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 100,
      pointerEvents: 'auto' as 'auto', // Allow interaction
    };
  };

  const hoverCardFallback = (
    <div className="w-[320px] h-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl flex items-center justify-center text-slate-500 dark:text-gray-400">
      <Loader2 className="animate-spin" />
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
        <Loader2 className="animate-spin" /> 加载实时行情...
      </div>
    );
  }

  if (!selectedStock) return null;

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 dark:text-gray-400 group-focus-within:text-cyan-500 dark:group-focus-within:text-cyan-400 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="输入股票代码或名称 (如: 600519)..."
          className="w-full pl-12 pr-4 py-3 rounded-xl focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all
            bg-white dark:bg-slate-900/50 
            text-slate-900 dark:text-white 
            border border-slate-200 dark:border-white/10 
            focus:border-cyan-500/50 
            placeholder-slate-400 dark:placeholder-gray-500
            shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="absolute right-3 top-3 text-xs border px-2 py-0.5 rounded 
          text-slate-400 border-slate-200 bg-slate-50
          dark:text-gray-600 dark:border-gray-800 dark:bg-gray-900">
          CMD + K
        </div>
      </div>

      {/* Main Stock Display */}
      <GlassCard className="bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/40 border-t-white/20 dark:border-t-white/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedStock.name}</h2>
              <span className="font-mono text-lg text-slate-500 dark:text-gray-400 bg-black/5 dark:bg-black/20 px-2 py-1 rounded">{selectedStock.symbol}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Badge variant="outline">概念板块/题材概念</Badge>
              <Badge variant="blue"><Layers size={12} className="inline mr-1"/>{selectedStock.industry}</Badge>
              {selectedStock.concepts.map(c => (
                <Badge key={c} variant="outline">{c}</Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-end gap-6 text-right">
            <div>
              <div className="text-sm text-slate-500 dark:text-gray-400 mb-1">当前价格</div>
              <div className={`text-4xl font-mono font-bold ${selectedStock.pctChange >= 0 ? 'text-up' : 'text-down'}`}>
                {selectedStock.price.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500 dark:text-gray-400 mb-1">涨跌幅</div>
              <div className={`text-2xl font-mono font-bold flex items-center justify-end ${selectedStock.pctChange >= 0 ? 'text-up' : 'text-down'}`}>
                {selectedStock.pctChange >= 0 ? <TrendingUp size={24} className="mr-1"/> : <TrendingDown size={24} className="mr-1"/>}
                {selectedStock.pctChange > 0 ? '+' : ''}{selectedStock.pctChange}%
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
           {[
             { label: '成交量', val: selectedStock.volume },
             { label: '成交额', val: selectedStock.turnover },
             { label: '市盈率(TTM)', val: selectedStock.pe ? selectedStock.pe.toFixed(1) : '-' }, 
             { label: '总市值(亿)', val: selectedStock.marketCap ? selectedStock.marketCap : '-' }
           ].map((item, i) => (
             <div key={i}>
               <div className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider">{item.label}</div>
               <div className="text-lg font-mono text-slate-700 dark:text-gray-200">{item.val}</div>
             </div>
           ))}
        </div>
      </GlassCard>

      {/* Stock List Table */}
      <GlassCard
        title="股票列表"
        className="flex-1 min-h-0"
        noPadding
        action={<DataFreshnessBadge meta={dataFreshness} />}
      >
        <div className="overflow-auto h-[400px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 backdrop-blur-sm bg-slate-50/90 dark:bg-white/5 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">代码</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">名称</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-right">涨跌幅</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-right">最新价</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">概念板块/题材概念</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">行业</th>
                <th className="p-4 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">主力资金</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
              {filteredStocks.map((stock) => (
                <tr 
                  key={stock.symbol} 
                  className={`transition-colors cursor-pointer group 
                    ${selectedStock.symbol === stock.symbol ? 'bg-cyan-50/50 dark:bg-white/[0.08]' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.03]'}`}
                  onClick={() => setSelectedStock(stock)}
                  onMouseEnter={(e) => handleRowMouseEnter(e, stock)}
                  onMouseMove={handleRowMouseMove}
                  onMouseLeave={handleRowMouseLeave}
                >
                  <td className="p-4 font-mono text-slate-500 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors relative">
                    {stock.symbol}
                  </td>
                  <td className="p-4 font-medium text-slate-800 dark:text-gray-200">{stock.name}</td>
                  <td className={`p-4 font-mono text-right font-bold ${stock.pctChange >= 0 ? 'text-up' : 'text-down'}`}>
                    {stock.pctChange > 0 ? '+' : ''}{stock.pctChange}%
                  </td>
                  <td className="p-4 font-mono text-right text-slate-600 dark:text-gray-300">{stock.price.toFixed(2)}</td>
                  <td className="p-4 hidden lg:table-cell">
                    <Badge variant="outline">
                      {stock.concepts?.[0] ?? '暂无概念'}
                    </Badge>
                  </td>
                  <td className="p-4 hidden md:table-cell"><Badge variant="default" className="bg-slate-200/50 dark:bg-gray-800 text-slate-600 dark:text-gray-300">{stock.industry}</Badge></td>
                  <td className="p-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                       <Activity size={14} className={stock.pctChange > 0 ? 'text-up' : 'text-down'} />
                       <span className="text-xs text-slate-500 dark:text-gray-500">流入</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Hover Card Portal/Overlay */}
      {hoveredStock && (
        <div 
          style={getCardStyle()}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        >
          <Suspense fallback={hoverCardFallback}>
            <StockHoverCard stock={hoveredStock} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default StockInfoSection;
