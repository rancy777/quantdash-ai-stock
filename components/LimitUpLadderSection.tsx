import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import GlassCard from './ui/GlassCard';
import { Stock, LadderData } from '../types';
import { getLimitUpLadderData } from '../services/stockService';
import { getSingleDayCloseChange } from '../services/quotesService';
import { Loader2, TrendingUp, Calendar, ChevronLeft, ChevronRight, Palette, Clock3 } from 'lucide-react';

const StockHoverCard = React.lazy(() => import('./StockHoverCard'));

const HOVER_CARD_DEFAULT_SIZE = { width: 900, height: 760 };

const formatPct = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }
  const rounded = Number(value.toFixed(2));
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded}%`;
};

const LimitUpLadderSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ladderData, setLadderData] = useState<LadderData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSingleDayView, setIsSingleDayView] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showColorChain, setShowColorChain] = useState(false);
  const [singleDayCloseMap, setSingleDayCloseMap] = useState<Record<string, number>>({});
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
  const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const hoverCardSizeRef = useRef(HOVER_CARD_DEFAULT_SIZE);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getLimitUpLadderData(selectedDate);
        if (!mounted) return;
        setLadderData(data);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!isSingleDayView) setShowComparison(false);
  }, [isSingleDayView]);

  useEffect(() => {
    setSingleDayCloseMap({});
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const colorMap = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!ladderData) return {} as Record<string, React.CSSProperties>;
    const palette = [
      [229, 0, 0],
      [255, 140, 0],
      [255, 215, 0],
      [0, 201, 87],
      [0, 191, 255],
      [138, 43, 226],
      [0, 255, 255],
      [160, 82, 45],
      [255, 69, 0],
      [0, 100, 0],
      [0, 0, 139],
      [255, 255, 255],
    ];
    const styleMap: Record<string, React.CSSProperties> = {};
    let idx = 0;
    ladderData.boardCounts.forEach((row) => {
      ladderData.dates.forEach((dateKey) => {
        (row.data[dateKey] || []).forEach((stock) => {
          if (!styleMap[stock.name]) {
            const color = palette[idx % palette.length];
            styleMap[stock.name] = {
              backgroundColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.25)`,
              borderColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
              borderWidth: '2px',
              boxShadow: `0 0 8px rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`,
            };
            idx += 1;
          }
        });
      });
    });
    return styleMap;
  }, [ladderData]);

  const getStockStyle = useCallback(
    (stockName: string) => {
      if (!showColorChain) return {};
      return colorMap[stockName] || {};
    },
    [showColorChain, colorMap],
  );

  const conceptStats = useMemo(() => {
    if (!ladderData) return [] as [string, number][];
    const dateKey = selectedDate.slice(5);
    const stats: Record<string, number> = {};
    ladderData.boardCounts.forEach((row) => {
      const stocks = row.data[dateKey] || [];
      stocks.forEach((stock) => {
        const tags = stock.concepts?.length ? stock.concepts : stock.industry ? [stock.industry] : [row.label];
        tags.forEach((tag) => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      });
    });
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [ladderData, selectedDate]);

  const singleDayRows = useMemo(() => {
    if (!ladderData) return [] as { label: string; count: number; stocks: Stock[] }[];
    const dateKey = selectedDate.slice(5);
    return ladderData.boardCounts
      .map((row) => ({
        label: row.label,
        count: row.count,
        stocks: row.data[dateKey] || [],
      }))
      .filter((group) => group.stocks.length > 0);
  }, [ladderData, selectedDate]);

  const previousDayData = useMemo(() => {
    if (!ladderData) return null;
    const currentKey = selectedDate.slice(5);
    const idx = ladderData.dates.findIndex((d) => d === currentKey);
    if (idx === -1 || idx + 1 >= ladderData.dates.length) return null;
    return { label: ladderData.dates[idx + 1] };
  }, [ladderData, selectedDate]);

  const currentDayStockMap = useMemo(() => {
    if (!ladderData) return new Map<string, { stock: Stock; boardLabel: string }>();
    const map = new Map<string, { stock: Stock; boardLabel: string }>();
    const dateKey = selectedDate.slice(5);
    ladderData.boardCounts.forEach((row) => {
      (row.data[dateKey] || []).forEach((stock) => {
        map.set(stock.symbol, { stock, boardLabel: row.label });
      });
    });
    return map;
  }, [ladderData, selectedDate]);

  const comparisonPairs = useMemo(() => {
    if (!ladderData || !previousDayData) return [] as {
      prevBoardLabel: string;
      prevBoardCount: number;
      currBoardLabel: string;
      currBoardCount: number;
      key: string;
      rows: { symbol: string; prev?: Stock; curr?: Stock; today?: { stock: Stock; boardLabel: string } }[];
    }[];
    const currentLabel = selectedDate.slice(5);
    return ladderData.boardCounts
      .map((row) => {
        const prevStocks = row.data[previousDayData.label] || [];
        const upgradeTarget = row.count >= 7 ? row.count : row.count + 1;
        const targetRow = ladderData.boardCounts.find((r) => r.count === upgradeTarget);
        const currStocks = targetRow ? targetRow.data[currentLabel] || [] : [];
        if (prevStocks.length === 0 && currStocks.length === 0) return null;
        const currentMap = new Map<string, Stock>(
          currStocks.map((stock): [string, Stock] => [stock.symbol, stock]),
        );
        const rows: { symbol: string; prev?: Stock; curr?: Stock; today?: { stock: Stock; boardLabel: string } }[] = [];
        const seen = new Set<string>();
        prevStocks.forEach((stock) => {
          rows.push({
            symbol: stock.symbol,
            prev: stock,
            curr: currentMap.get(stock.symbol),
            today: currentDayStockMap.get(stock.symbol),
          });
          seen.add(stock.symbol);
        });
        currStocks.forEach((stock) => {
          if (!seen.has(stock.symbol)) {
            rows.push({
              symbol: stock.symbol,
              curr: stock,
              today: currentDayStockMap.get(stock.symbol) ?? { stock, boardLabel: targetRow ? targetRow.label : row.label },
            });
          }
        });
        return {
          prevBoardLabel: row.label,
          prevBoardCount: prevStocks.length,
          currBoardLabel: targetRow ? targetRow.label : row.label,
          currBoardCount: currStocks.length,
          rows,
          key: `${row.label}-${targetRow ? targetRow.label : row.label}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [ladderData, previousDayData, selectedDate, currentDayStockMap]);

  const missingComparisonSymbols = useMemo(() => {
    if (!showComparison) return [] as string[];
    const missing = new Set<string>();
    comparisonPairs.forEach((pair) => {
      pair.rows.forEach((row) => {
        if (!row.curr && row.prev) {
          missing.add(row.prev.symbol);
        }
      });
    });
    return Array.from(missing);
  }, [comparisonPairs, showComparison]);

  const missingSymbolsSet = useMemo(() => new Set(missingComparisonSymbols), [missingComparisonSymbols]);

  const pendingCloseSymbols = useMemo(() => {
    if (!showComparison) return [] as string[];
    return missingComparisonSymbols.filter((symbol) => singleDayCloseMap[symbol] === undefined);
  }, [missingComparisonSymbols, showComparison, singleDayCloseMap]);

  useEffect(() => {
    if (!showComparison || pendingCloseSymbols.length === 0) return;
    let cancelled = false;
    const fetchCloseMoves = async () => {
      const updates: Record<string, number> = {};
      for (const symbol of pendingCloseSymbols) {
        try {
          const pct = await getSingleDayCloseChange(symbol, selectedDate);
          if (pct !== null) {
            updates[symbol] = pct;
          }
        } catch (error) {
          console.warn('Failed to load single-day move for', symbol, error);
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setSingleDayCloseMap((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchCloseMoves();
    return () => {
      cancelled = true;
    };
  }, [pendingCloseSymbols, showComparison, selectedDate]);

  const handleDateChange = (amount: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + amount);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const updateHoverCardPosition = useCallback(() => {
    const { width, height } = hoverCardSizeRef.current;
    const padding = 16;
    let x = mousePosRef.current.x + 20;
    let y = mousePosRef.current.y + 20;
    if (x + width + padding > window.innerWidth) {
      x = Math.max(padding, mousePosRef.current.x - width - 20);
    }
    if (y + height + padding > window.innerHeight) {
      y = Math.max(padding, window.innerHeight - height - padding);
    }
    setCardPos({ x, y });
  }, []);

  const openHoverCard = useCallback((stock: Stock) => {
    setHoveredStock(stock);
    updateHoverCardPosition();
  }, [updateHoverCardPosition]);

  const startCloseTimer = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredStock(null);
    }, 200);
  }, []);

  const handleMouseEnter = (event: React.MouseEvent, stock: Stock) => {
    mousePosRef.current = { x: event.clientX, y: event.clientY };
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      openHoverCard(stock);
    }, 350);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    mousePosRef.current = { x: event.clientX, y: event.clientY };
    if (hoveredStock) {
      updateHoverCardPosition();
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    startCloseTimer();
  };

  const closeHoverInstant = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setHoveredStock(null);
  };

  const renderSingleDayCard = (stock: Stock, groupCount: number) => {
    const isSelected = selectedStockSymbol === stock.symbol;
    const displayTime = stock.limitUpTime ?? '--:--';
    return (
      <div
        key={stock.symbol}
        className={`relative p-4 rounded-xl border transition-all cursor-pointer overflow-hidden group/card ${
          !showColorChain
            ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40 shadow-sm hover:shadow-md'
            : ''
        } ${isSelected ? 'ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-500/10' : ''}`}
        style={getStockStyle(stock.name)}
        onMouseEnter={(e) => handleMouseEnter(e, stock)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setSelectedStockSymbol((prev) => (prev === stock.symbol ? null : stock.symbol))}
      >
        {stock.concepts?.[0] || stock.industry ? (
          <div
            className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
              showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
            }`}
          >
            {stock.concepts?.[0] ?? stock.industry}
          </div>
        ) : (
          <div
            className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
              showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
            }`}
          >
            {groupCount >= 7 ? '7连+' : `${groupCount}连板`}
          </div>
        )}
        <div
          className={`font-bold text-base mb-1 mt-1 pr-10 ${
            showColorChain ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-gray-100'
          }`}
        >
          {stock.name}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={`${showColorChain ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500'}`}>
            {stock.symbol}
          </span>
          <span className="text-xs font-bold text-red-500 flex items-center bg-red-500/5 px-1 rounded">
            <TrendingUp size={10} className="mr-0.5" />
            {formatPct(stock.pctChange)}
          </span>
        </div>
        <div
          className={`mt-2 text-[11px] flex items-center gap-1 ${
            showColorChain ? 'text-slate-600 dark:text-gray-200' : 'text-slate-400 dark:text-gray-400'
          }`}
        >
          <Clock3 size={12} className="text-cyan-500" />
          <span>最后涨停 {displayTime}</span>
        </div>
        {!showColorChain && (
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group/card:opacity-100 pointer-events-none transition-opacity duration-500" />
        )}
      </div>
    );
  };
  const renderComparisonCard = () => (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
          <span>昨 {previousDayData?.label}</span>
          <span className="text-slate-400 text-xs">vs</span>
          <span>今 {selectedDate.slice(5)}</span>
        </div>
        <span className="text-xs text-slate-400">逐级对齐对比昨日与今日的封板节奏</span>
      </div>
      <div className="space-y-4">
        {comparisonPairs.map((pair) => (
          <div
            key={pair.key}
            className="border border-slate-200 dark:border-slate-600 rounded-2xl p-4 bg-white dark:bg-white/5"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[11px] font-semibold text-slate-500 dark:text-gray-300 mb-3">
              <div>昨 {pair.prevBoardLabel} ({pair.prevBoardCount})</div>
              <div className="text-slate-300 dark:text-slate-600 text-xl text-center">⟶</div>
              <div className="text-right text-rose-500 dark:text-rose-300">今 {pair.currBoardLabel} ({pair.currBoardCount})</div>
            </div>
            <div className="space-y-2">
              {pair.rows.map((row) => {
                const pctClass = (value?: number) => (value !== undefined && value >= 0 ? 'text-red-500' : 'text-green-500');
                const fallbackToday = row.curr ? undefined : row.today;
                const displayStock = row.curr ?? fallbackToday?.stock ?? row.prev;
                const showManual = !row.curr;
                const manualPct = showManual ? singleDayCloseMap[row.symbol] : undefined;
                const awaitingManual = showManual && manualPct === undefined && missingSymbolsSet.has(row.symbol);
                return (
                  <div
                    key={row.symbol}
                    className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-stretch"
                  >
                    <div
                      className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                        row.prev
                          ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-slate-600'
                          : row.curr
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-400/30'
                            : 'bg-slate-50 dark:bg-white/5 border-dashed border-slate-200 dark:border-slate-600 text-slate-400'
                      }`}
                    >
                      {row.prev ? (
                        <>
                          <div className="font-semibold text-slate-700 dark:text-gray-100">{row.prev.name}</div>
                          <div className="text-[10px] text-slate-400">{row.prev.symbol}</div>
                          <div className={`${pctClass(row.prev.pctChange)} font-bold`}>
                            {formatPct(row.prev.pctChange)}
                          </div>
                        </>
                      ) : row.curr ? (
                        <>
                          <div className="font-semibold text-slate-700 dark:text-gray-100 flex items-center justify-between gap-1">
                            <span>{row.curr.name}</span>
                            <span className="text-[10px] text-emerald-500">今日新晋</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{row.curr.symbol}</div>
                          <div className={`${pctClass(row.curr.pctChange)} font-bold`}>
                            {formatPct(row.curr.pctChange)}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center text-[11px]">暂无数据</div>
                      )}
                    </div>
                    <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 text-base">⟶</div>
                    <div
                      className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                        row.curr
                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-400/30'
                        : fallbackToday
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-400/30 text-amber-600 dark:text-amber-200'
                          : 'bg-slate-50 dark:bg-white/5 border-dashed border-slate-200 dark:border-slate-600 text-slate-400'
                      }`}
                    >
                      {displayStock ? (
                        <>
                          <div className="font-semibold text-slate-700 dark:text-gray-100 flex items-center justify-between gap-1">
                            <span>{displayStock.name}</span>
                            {!row.curr && (
                              <span className="text-[10px] text-amber-500">
                                {fallbackToday ? `停留在 ${fallbackToday.boardLabel}` : '未晋级'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{displayStock.symbol}</div>
                          {showManual ? (
                            awaitingManual ? (
                              <div className="text-slate-400 text-[11px] font-medium">加载收盘数据...</div>
                            ) : (
                              <>
                                <div className={`${pctClass(manualPct)} font-bold`}>
                                  {manualPct !== undefined ? formatPct(manualPct) : '--'}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">收盘涨跌幅</div>
                              </>
                            )
                          ) : (
                            <div className={`${pctClass(displayStock.pctChange)} font-bold`}>
                              {formatPct(displayStock.pctChange)}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex-1 flex items-center text-[11px]">暂无数据</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSingleDay = () => (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-5">
      {singleDayRows.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-600 rounded-2xl p-10">
          <span>暂无该日的连板数据</span>
          <span className="text-xs text-slate-400">{selectedDate}</span>
        </div>
      ) : (
        <div className="space-y-4">
          {singleDayRows.map((group) => (
            <div
              key={group.label}
              className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white/15 dark:bg-white/[0.03] backdrop-blur px-4 py-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-lg ${
                      group.count >= 5
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                        : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                    }`}
                  >
                    {group.label}
                  </span>
                  <span className="text-xs text-slate-400">{group.stocks.length} 只</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">连板数 {group.count}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.stocks.map((stock) => renderSingleDayCard(stock, group.count))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const renderMultiDayTable = () => (
    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto custom-scrollbar relative flex flex-col">
      <table className="w-max border-collapse min-w-[2200px]">
        <thead className="sticky top-0 z-20 bg-slate-100/90 dark:bg-[#161a25]/95 backdrop-blur shadow-sm">
          <tr>
            <th className="p-0 min-w-[120px] h-[60px] border-b border-r border-slate-300 dark:border-slate-600 sticky left-0 z-30 bg-slate-100 dark:bg-[#161a25]">
              <div className="relative w-full h-full">
                <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
                  <line x1="0" y1="0" x2="100%" y2="100%" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
                </svg>
                <span className="absolute top-2 right-3 text-xs font-bold text-slate-600 dark:text-gray-300">日期</span>
                <span className="absolute bottom-2 left-3 text-xs font-bold text-slate-600 dark:text-gray-300">连板</span>
              </div>
            </th>
            {ladderData?.dates.map((date) => (
              <th
                key={date}
                className={`p-3 text-center min-w-[140px] border-b border-l border-slate-300 dark:border-slate-600 font-mono text-sm ${
                  date === selectedDate.slice(5)
                    ? 'text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-50/50 dark:bg-cyan-900/10'
                    : 'text-slate-700 dark:text-gray-200'
                }`}
              >
                {date}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
          {ladderData?.boardCounts.map((row) => (
            <tr key={row.label} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
              <td className="p-4 font-bold text-slate-700 dark:text-white sticky left-0 bg-slate-50/90 dark:bg-[#0f1219]/95 border-r border-b border-slate-300 dark:border-slate-600 z-10 text-sm shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                <div
                  className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg w-full text-center ${
                    row.count >= 5
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                  }`}
                >
                  {row.label}
                </div>
              </td>
              {ladderData.dates.map((date) => {
                const stocks = row.data[date] || [];
                const isSelectedDate = date === selectedDate.slice(5);
                return (
                  <td
                    key={`${row.label}-${date}`}
                    className={`p-2 align-top border-r border-slate-300 dark:border-slate-600 last:border-r-0 min-h-[100px] ${
                      isSelectedDate ? 'bg-cyan-50/20 dark:bg-cyan-900/5' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-2 min-h-[60px]">
                      {stocks.map((stock) => {
                        const isSelected = selectedStockSymbol === stock.symbol;
                        const displayTime = stock.limitUpTime ?? '--:--';
                        return (
                          <div
                            key={`${stock.symbol}-${date}`}
                            className={`relative p-2.5 rounded-lg transition-all cursor-pointer group/card overflow-hidden border ${
                              !showColorChain
                                ? 'bg-white dark:bg-white/5 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:border-cyan-500/50'
                                : ''
                            } ${isSelected ? 'ring-2 ring-amber-400 shadow-lg bg-amber-100/40 dark:bg-amber-500/10' : ''}`}
                            style={getStockStyle(stock.name)}
                            onMouseEnter={(e) => handleMouseEnter(e, stock)}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => setSelectedStockSymbol((prev) => (prev === stock.symbol ? null : stock.symbol))}
                          >
                            {stock.concepts?.[0] || stock.industry ? (
                              <div
                                className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
                                  showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
                                }`}
                              >
                                {stock.concepts?.[0] ?? stock.industry}
                              </div>
                            ) : (
                              <div
                                className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
                                  showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
                                }`}
                              >
                                {row.count >= 7 ? '7连+' : `${row.count}连板`}
                              </div>
                            )}
                            <div
                              className={`font-bold text-sm mb-1 mt-0.5 pr-8 ${
                                showColorChain ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-gray-100'
                              }`}
                            >
                              {stock.name}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`text-[10px] font-mono ${
                                  showColorChain ? 'text-slate-700 dark:text-gray-300' : 'text-slate-400'
                                }`}
                              >
                                {stock.symbol}
                              </span>
                              <span className="text-[11px] font-bold text-red-500 flex items-center">
                                {formatPct(stock.pctChange)}
                              </span>
                            </div>
                            <div
                              className={`mt-2 text-[10px] flex items-center gap-1 ${
                                showColorChain ? 'text-slate-700 dark:text-gray-200' : 'text-slate-400 dark:text-gray-400'
                              }`}
                            >
                              <Clock3 size={12} className="text-cyan-500" />
                              <span>最后涨停：{displayTime}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const hoverCardFallback = (
    <div className="w-[320px] h-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl flex items-center justify-center text-slate-500 dark:text-gray-400">
      <Loader2 className="animate-spin" />
    </div>
  );
  return (
    <div className="h-full flex flex-col gap-6 relative">
      <GlassCard className="flex-1 min-h-0 flex flex-col overflow-visible" noPadding>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-slate-300/50 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5 gap-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <span className="w-1 h-5 bg-cyan-500 rounded-full inline-block shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            连板天梯 <span className="text-xs font-normal text-slate-400 ml-2 hidden lg:inline">近20个交易日复盘</span>
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowColorChain((prev) => !prev)}
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
                onClick={() => handleDateChange(-1)}
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
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-black/20 border border-slate-300 dark:border-slate-600 text-sm font-mono text-slate-700 dark:text-gray-300 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <button
                onClick={() => handleDateChange(1)}
                disabled={selectedDate >= new Date().toISOString().split('T')[0]}
                className={`p-2 rounded-lg transition-colors ${
                  selectedDate >= new Date().toISOString().split('T')[0]
                    ? 'text-slate-300 dark:text-gray-700 cursor-not-allowed'
                    : 'hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400'
                }`}
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setIsSingleDayView((prev) => !prev)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${
                  isSingleDayView
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-cyan-500/30'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                {isSingleDayView ? '退出单日模式' : '进入单日模式'}
              </button>
              <button
                onClick={() => setShowComparison((prev) => !prev)}
                disabled={!isSingleDayView || comparisonPairs.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm ${
                  showComparison
                    ? 'bg-amber-500 text-white border-amber-400 shadow-amber-400/30'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                } ${
                  !isSingleDayView || comparisonPairs.length === 0
                    ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-white/5'
                    : ''
                }`}
              >
                今昨对比
              </button>
            </div>
          </div>
        </div>

        {isSingleDayView && !showComparison && !loading && ladderData && conceptStats.length > 0 && (
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-700 dark:text-gray-100 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
                概念涨停统计
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {selectedDate} ｜ {conceptStats.length} 个概念
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {conceptStats.map(([concept, count]) => (
                <div
                  key={concept}
                  className="px-3 py-2 rounded-xl bg-cyan-50/80 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/30 shadow-sm"
                >
                  <p className="text-xs font-semibold text-slate-600 dark:text-white">{concept}</p>
                  <p className="text-[11px] text-cyan-700 dark:text-cyan-300 mt-0.5">{count} 次涨停</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading || !ladderData ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
            <Loader2 className="animate-spin" /> {loading ? '加载中...' : '暂无数据'}
          </div>
        ) : isSingleDayView ? (
          showComparison && comparisonPairs.length > 0 && previousDayData ? (
            renderComparisonCard()
          ) : (
            renderSingleDay()
          )
        ) : (
          renderMultiDayTable()
        )}
      </GlassCard>

      {hoveredStock && (
        <div
          className="fixed z-[99]"
          style={{ left: cardPos.x, top: cardPos.y }}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = null;
            }
          }}
          onMouseLeave={startCloseTimer}
        >
          <React.Suspense fallback={hoverCardFallback}>
            <StockHoverCard
              stock={hoveredStock}
              onSizeChange={(size) => {
                hoverCardSizeRef.current = size || HOVER_CARD_DEFAULT_SIZE;
                updateHoverCardPosition();
              }}
            />
          </React.Suspense>
          <button
            className="absolute -top-3 -right-3 bg-slate-900 text-white rounded-full w-6 h-6 text-xs"
            onClick={closeHoverInstant}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default LimitUpLadderSection;
