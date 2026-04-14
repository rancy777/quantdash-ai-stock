
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ChanFractal, Stock } from '../types';
import { getStockKline } from '../services/quotesService';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Loader2, Plus, LayoutGrid, FileText, Info, Lock, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { emitAIStockObservationRequest } from '../services/aiNavigationService';
import { analyzeChanStructure } from '../services/chanService';

interface CardSize {
  width: number;
  height: number;
}

interface StockHoverCardProps {
  stock: Stock;
  onSizeChange?: (size: CardSize) => void;
}

// Custom shape for Candlestick
const CandleStickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || !payload.candleBody) return null;

  const { isUp } = payload;
  const color = isUp ? '#ef4444' : '#10b981';

  const [minBody, maxBody] = payload.candleBody;
  const bodyRange = maxBody - minBody;
  const ratio = bodyRange === 0 ? 0 : height / bodyRange;
  
  const yHigh = y - (payload.high - maxBody) * ratio;
  const yLow = (y + height) + (minBody - payload.low) * ratio;
  const center = x + width / 2;

  return (
    <g>
      <line x1={center} y1={isNaN(yHigh) ? y : yHigh} x2={center} y2={isNaN(yLow) ? y + height : yLow} stroke={color} strokeWidth={1} />
      <rect 
        x={x} y={y} width={width} height={Math.max(1, height)} 
        fill={color} 
        stroke={color} strokeWidth={1}
      />
    </g>
  );
};

// --- Indicators Logic ---
const calcMA = (data: any[], n: number) => {
  if (!data || data.length === 0) return [];
  return data.map((entry, index) => {
    if (index < n - 1) return { ...entry, [`MA${n}`]: null };
    const sum = data.slice(index - n + 1, index + 1).reduce((acc, curr) => acc + curr.close, 0);
    return { ...entry, [`MA${n}`]: sum / n };
  });
};

const calcEMA = (data: any[], n: number, key = 'close') => {
  if (!data || data.length === 0) return [];
  const k = 2 / (n + 1);
  if (!data[0]) return [];
  let ema = data[0][key];
  return data.map((d, i) => {
    if (i === 0) return { ...d, [`ema${n}`]: ema };
    ema = d[key] * k + ema * (1 - k);
    return { ...d, [`ema${n}`]: ema };
  });
};

const calcRSI = (data: any[], n: number = 14) => {
    if (!data || data.length === 0) return [];
    let gains = 0;
    let losses = 0;
    return data.map((d, i) => {
        if (i < n) return { ...d, rsi: null };
        if (i === n) {
             for (let j = 1; j <= n; j++) {
                if (data[j] && data[j-1]) {
                    const change = data[j].close - data[j-1].close;
                    if (change > 0) gains += change;
                    else losses += Math.abs(change);
                }
             }
             gains /= n;
             losses /= n;
        } else if (i > n) {
             const prev = data[i-1];
             if (prev) {
                 const change = d.close - prev.close;
                 const gain = change > 0 ? change : 0;
                 const loss = change < 0 ? Math.abs(change) : 0;
                 gains = (gains * (n - 1) + gain) / n;
                 losses = (losses * (n - 1) + loss) / n;
             }
        }
        const rs = losses === 0 ? 100 : gains / losses;
        const rsi = 100 - (100 / (1 + rs));
        return { ...d, rsi };
    });
};

const calcKDJ = (data: any[]) => {
    if (!data || data.length === 0) return [];
    let k = 50;
    let d = 50;
    return data.map((entry, i) => {
        if (i < 8) return { ...entry, k: 50, d: 50, j: 50 };
        const slice = data.slice(i - 8, i + 1);
        const low9 = Math.min(...slice.map(s => s.low));
        const high9 = Math.max(...slice.map(s => s.high));
        const rsv = high9 === low9 ? 50 : ((entry.close - low9) / (high9 - low9)) * 100;
        k = (2/3) * k + (1/3) * rsv;
        d = (2/3) * d + (1/3) * k;
        const j = 3 * k - 2 * d;
        return { ...entry, k, d, j };
    });
};

const calcBOLL = (data: any[], period: number = 20, multiplier: number = 2) => {
    if (!data || data.length === 0) return [];
    return data.map((entry, index) => {
        if (index < period - 1) return { ...entry, bollUpper: null, bollMiddle: null, bollLower: null };
        const slice = data.slice(index - period + 1, index + 1);
        const mean = slice.reduce((acc, curr) => acc + curr.close, 0) / period;
        const variance = slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        return { 
            ...entry, 
            bollUpper: mean + multiplier * std,
            bollMiddle: mean,
            bollLower: mean - multiplier * std
        };
    });
};

const calcBIAS = (data: any[], periods: number[] = [6, 12, 24]) => {
    if (!data || data.length === 0) return [];
    return data.map((entry, index) => {
        const next = { ...entry };
        periods.forEach(period => {
            if (index < period - 1) {
                next[`bias${period}`] = null;
            } else {
                const slice = data.slice(index - period + 1, index + 1);
                const ma = slice.reduce((acc, curr) => acc + curr.close, 0) / period;
                next[`bias${period}`] = ma === 0 ? null : ((entry.close - ma) / ma) * 100;
            }
        });
        return next;
    });
};

const calcWR = (data: any[], period: number = 14) => {
    if (!data || data.length === 0) return [];
    return data.map((entry, index) => {
        if (index < period - 1) return { ...entry, wr: null };
        const slice = data.slice(index - period + 1, index + 1);
        const high = Math.max(...slice.map(s => s.high));
        const low = Math.min(...slice.map(s => s.low));
        if (high === low) return { ...entry, wr: null };
        const wr = ((high - entry.close) / (high - low)) * -100;
        return { ...entry, wr };
    });
};

const calcVR = (data: any[], period: number = 26) => {
    if (!data || data.length === 0) return [];
    return data.map((entry, index) => {
        if (index < period) return { ...entry, vr: null };
        let av = 0;
        let bv = 0;
        let cv = 0;
        for (let i = index - period + 1; i <= index; i++) {
            const curr = data[i];
            const prev = data[i - 1] ?? curr;
            if (!prev) continue;
            if (curr.close > prev.close) av += curr.volume;
            else if (curr.close < prev.close) bv += curr.volume;
            else cv += curr.volume;
        }
        const base = (bv * 2 + cv) || 1;
        const vr = ((av * 2 + cv) / base) * 100;
        return { ...entry, vr };
    });
};


const CARD_LAYOUT = {
  default: { width: 900, minHeight: 720, main: 260, volume: 90, tech: 180 },
  expanded: { width: 1100, minHeight: 900, main: 330, volume: 120, tech: 240 }
};
const MAIN_CHART_MARGIN = { top: 10, right: 0, left: 0, bottom: 0 };
const PRICE_AXIS_WIDTH = 40;
const DRAG_FRAME_INTERVAL = 32;
const HOVER_FRAME_INTERVAL = 48;

const StockHoverCard: React.FC<StockHoverCardProps> = ({ stock, onSizeChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [fullData, setFullData] = useState<any[]>([]);
  const [viewState, setViewState] = useState({ startIndex: 0, visibleCount: 60 });
  
  // Interaction States
  const [activeItem, setActiveItem] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [crosshair, setCrosshair] = useState<{ x: number, y: number, price: number, index: number } | null>(null);

  // Config States
  const [period, setPeriod] = useState(101); 
  const [activeTech, setActiveTech] = useState('MACD');
  const [showMA, setShowMA] = useState(true);
  const [showChanStructure, setShowChanStructure] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const layout = isExpanded ? CARD_LAYOUT.expanded : CARD_LAYOUT.default;
  useEffect(() => {
    if (typeof window === 'undefined' || !onSizeChange) return;
    const el = containerRef.current;
    if (!el) return;
    const notify = () => {
      const nextSize = {
        width: el.offsetWidth,
        height: el.offsetHeight
      };
      const prevSize = lastReportedSizeRef.current;
      if (prevSize && prevSize.width === nextSize.width && prevSize.height === nextSize.height) return;
      lastReportedSizeRef.current = nextSize;
      onSizeChange(nextSize);
    };
    notify();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => notify());
      observer.observe(el);
      return () => observer.disconnect();
    }
    const handleResize = () => notify();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [layout.width, isExpanded, onSizeChange]);

  // Refs for interactions
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartIdx = useRef(0);
  const viewStateRef = useRef(viewState);
  const activeItemRef = useRef<any>(null);
  const crosshairRef = useRef<typeof crosshair>(null);
  const dragFrameRef = useRef<number | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingDragStartRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ x: number; y: number; price: number; index: number; item: any } | null>(null);
  const lastDragCommitAtRef = useRef(0);
  const lastHoverCommitAtRef = useRef(0);
  const lastReportedSizeRef = useRef<CardSize | null>(null);
  
  // Fetch and Process Data
  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  useEffect(() => {
    crosshairRef.current = crosshair;
  }, [crosshair]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      const rawKlines = await getStockKline(stock.symbol, period);
      
      if (!mounted) return;

      if (!rawKlines || rawKlines.length === 0) {
          setFullData([]);
          setLoading(false);
          setActiveItem(null);
          return;
      }

      let processed = rawKlines.map(d => ({
          ...d,
          isUp: d.close >= d.open,
          candleBody: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
          change: d.close - d.open,
          changePercent: ((d.close - d.open) / d.open) * 100
      }));

      // Calculate indicators
      processed = calcMA(processed, 5);
      processed = calcMA(processed, 10);
      processed = calcMA(processed, 30);
      processed = calcMA(processed, 60);
      processed = calcBOLL(processed);
      processed = calcBIAS(processed);
      processed = calcWR(processed);
      processed = calcVR(processed);
      processed = calcRSI(processed);
      processed = calcKDJ(processed);

      // MACD
      let emaData = calcEMA(processed, 12);
      if (emaData.length > 0) {
          emaData = calcEMA(emaData, 26);
          let dea = 0;
          if (emaData.length > 0 && emaData[0]) {
              dea = (emaData[0].ema12 || 0) - (emaData[0].ema26 || 0);
          }
          const finalData = emaData.map((d, i) => {
             const dif = (d.ema12 || 0) - (d.ema26 || 0);
             if (i > 0) dea = dea * 0.8 + dif * 0.2;
             const macd = (dif - dea) * 2;
             return { ...d, dif, dea, macd };
          });

          setFullData(finalData);
          const start = Math.max(0, finalData.length - 60);
          setViewState({ startIndex: start, visibleCount: 60 });
          viewStateRef.current = { startIndex: start, visibleCount: 60 };
          setActiveItem(finalData[finalData.length - 1]);
          activeItemRef.current = finalData[finalData.length - 1];
      } else {
          setFullData([]);
          setActiveItem(null);
          activeItemRef.current = null;
      }
      
      setLoading(false);
    };

    loadData();
    return () => { mounted = false; };
  }, [stock.symbol, period]);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
      if (hoverFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    };
  }, []);

  const displayData = useMemo(() => {
    return fullData.slice(viewState.startIndex, viewState.startIndex + viewState.visibleCount);
  }, [fullData, viewState]);

  // Price Domain for Scale Calculation
  const priceDomain = useMemo(() => {
    if (displayData.length === 0) return [0, 1];
    const min = Math.min(...displayData.map(d => d.low));
    const max = Math.max(...displayData.map(d => d.high));
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [displayData]);

  const techYAxisProps = useMemo(() => {
    switch (activeTech) {
        case 'KDJ':
        case 'RSI':
            return { domain: [0, 100] as [number, number], allowDecimals: false };
        case 'WR':
            return { domain: [-100, 0] as [number, number], allowDecimals: false };
        case 'VR':
            return { domain: [0, 'auto'] as [number | 'auto', number | 'auto'], allowDecimals: false };
        case 'BIAS':
            return { domain: [-20, 20] as [number, number], allowDecimals: true };
        case 'BOLL':
            return { domain: [priceDomain[0], priceDomain[1]] as [number, number], allowDecimals: true };
        default:
            return { domain: ['auto', 'auto'] as [number | 'auto', number | 'auto'], allowDecimals: true };
    }
  }, [activeTech, priceDomain]);

  const chanAnalysis = useMemo(() => analyzeChanStructure(displayData), [displayData]);
  const chanBiPoints = useMemo<ChanFractal[]>(() => {
    if (chanAnalysis.bis.length === 0) return [];
    return chanAnalysis.bis.reduce<ChanFractal[]>((points, bi, index) => {
      if (index === 0) points.push(bi.start);
      points.push(bi.end);
      return points;
    }, []);
  }, [chanAnalysis.bis]);
  const chanSummaryLabel = useMemo(() => {
    const directionLabel =
      chanAnalysis.summary.latestDirection === 'up'
        ? '向上'
        : chanAnalysis.summary.latestDirection === 'down'
          ? '向下'
          : '未定';
    return `笔 ${chanAnalysis.summary.biCount} / 段 ${chanAnalysis.summary.segmentCount} / 中枢 ${chanAnalysis.summary.pivotZoneCount} / ${directionLabel}`;
  }, [chanAnalysis.summary]);

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (fullData.length === 0) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartIdx.current = viewStateRef.current.startIndex;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!chartAreaRef.current || displayData.length === 0) return;
    const rect = chartAreaRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = rect.width;
    const mainChartHeight = layout.main;

    if (isDragging.current) {
        const deltaX = e.clientX - dragStartX.current;
        const pixelsPerCandle = width / viewStateRef.current.visibleCount;
        const moveCount = Math.round(deltaX / pixelsPerCandle);
        const newStart = dragStartIdx.current - moveCount;
        const maxStart = Math.max(0, fullData.length - viewStateRef.current.visibleCount);
        const clampedStart = Math.max(0, Math.min(newStart, maxStart));
        if (clampedStart === viewStateRef.current.startIndex) return;
        pendingDragStartRef.current = clampedStart;
        if (dragFrameRef.current !== null) return;
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const nextStart = pendingDragStartRef.current;
          pendingDragStartRef.current = null;
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (now - lastDragCommitAtRef.current < DRAG_FRAME_INTERVAL) {
            pendingDragStartRef.current = nextStart;
            return;
          }
          if (nextStart === null || nextStart === viewStateRef.current.startIndex) return;
          lastDragCommitAtRef.current = now;
          viewStateRef.current = { ...viewStateRef.current, startIndex: nextStart };
          setViewState(prev => {
            if (prev.startIndex === nextStart) return prev;
            return { ...prev, startIndex: nextStart };
          });
        });
        return; 
    }

    if (!isLocked) {
        const candleWidth = width / viewStateRef.current.visibleCount;
        const index = Math.floor(mouseX / candleWidth);
        const clampedIndex = Math.max(0, Math.min(index, displayData.length - 1));
        const item = displayData[clampedIndex];

        let price = 0;
        if (mouseY <= mainChartHeight) {
            const [minP, maxP] = priceDomain;
            const priceRange = maxP - minP;
            const ratio = mouseY / mainChartHeight;
            price = maxP - ratio * priceRange;
        }

        pendingHoverRef.current = { x: mouseX, y: mouseY, price, index: clampedIndex, item };
        if (hoverFrameRef.current !== null) return;
        hoverFrameRef.current = window.requestAnimationFrame(() => {
          hoverFrameRef.current = null;
          const nextHover = pendingHoverRef.current;
          pendingHoverRef.current = null;
          if (!nextHover) return;
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (now - lastHoverCommitAtRef.current < HOVER_FRAME_INTERVAL) {
            pendingHoverRef.current = nextHover;
            return;
          }
          lastHoverCommitAtRef.current = now;

          const prevCrosshair = crosshairRef.current;
          if (
            !prevCrosshair ||
            prevCrosshair.index !== nextHover.index ||
            Math.abs(prevCrosshair.x - nextHover.x) > 2 ||
            Math.abs(prevCrosshair.y - nextHover.y) > 2
          ) {
            const nextCrosshair = {
              x: nextHover.x,
              y: nextHover.y,
              price: nextHover.price,
              index: nextHover.index
            };
            crosshairRef.current = nextCrosshair;
            setCrosshair(nextCrosshair);
          }

          if (activeItemRef.current !== nextHover.item) {
            activeItemRef.current = nextHover.item;
            setActiveItem(nextHover.item);
          }
        });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dist = Math.abs(e.clientX - dragStartX.current);
    isDragging.current = false;

    if (dist < 5 && fullData.length > 0) {
        setIsLocked(prev => !prev);
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    pendingDragStartRef.current = null;
    pendingHoverRef.current = null;
    if (!isLocked) {
        crosshairRef.current = null;
        setCrosshair(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
     e.stopPropagation();
     if (fullData.length === 0) return;
     const delta = Math.sign(e.deltaY);
     const zoomSpeed = 4;
     const newCount = Math.max(20, Math.min(200, viewState.visibleCount + delta * zoomSpeed));
     
     const currentEnd = viewState.startIndex + viewState.visibleCount;
     let newStart = currentEnd - newCount;
     newStart = Math.max(0, Math.min(newStart, fullData.length - newCount));
     
     setViewState({ startIndex: newStart, visibleCount: newCount });
  };

  return (
    <div 
      ref={containerRef}
      className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl flex flex-col text-slate-600 dark:text-[#cfd3dc] font-sans select-none overflow-hidden relative transition-all duration-300"
      style={{ width: layout.width, minHeight: layout.minHeight }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e222d] flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-[#e1e4ea]">{stock.name}</h3>
            <div className="text-sm text-slate-500 dark:text-[#848e9c] mt-0.5">{stock.symbol}</div>
          </div>
          {isLocked && (
             <div className="flex items-center gap-1 text-[#f0b90b] text-xs border border-[#f0b90b]/30 bg-[#f0b90b]/10 px-2 py-1 rounded">
                <Lock size={12} /> <span>已锁定</span>
             </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-2 rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-[#848e9c] hover:text-[#f0b90b] hover:border-[#f0b90b]/50 transition-colors"
            title={isExpanded ? '还原尺寸' : '放大查看'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="text-right">
          <div className={`text-2xl font-bold font-mono ${stock.pctChange >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
            {stock.price.toFixed(2)}
          </div>
          <div className="flex gap-4 text-sm font-mono mt-0.5">
             <span className={`${stock.pctChange >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}`}>
               {stock.pctChange > 0 ? '+' : ''}{stock.pctChange}%
             </span>
          </div>
          </div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 text-sm bg-slate-50 dark:bg-[#161a25] z-20 relative">
        {[
          { label: '日K', val: 101 }, { label: '周K', val: 102 }, { label: '月K', val: 103 },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setPeriod(tab.val); setIsLocked(false); }}
            className={`px-4 py-1.5 cursor-pointer hover:text-[#f0b90b] transition-colors ${period === tab.val ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-slate-500 dark:text-[#848e9c]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="px-2 py-1 flex text-xs font-mono justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161a25] z-20 relative h-[24px]">
         {activeItem ? (
             <>
                <span className="text-slate-900 dark:text-[#e1e4ea]">{activeItem.date}</span>
                <span><span className="text-slate-400 dark:text-[#848e9c] mr-1">开</span><span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>{activeItem.open?.toFixed(2)}</span></span>
                <span><span className="text-slate-400 dark:text-[#848e9c] mr-1">高</span><span className={activeItem.high > activeItem.open ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>{activeItem.high?.toFixed(2)}</span></span>
                <span><span className="text-slate-400 dark:text-[#848e9c] mr-1">低</span><span className={activeItem.low < activeItem.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{activeItem.low?.toFixed(2)}</span></span>
                <span><span className="text-slate-400 dark:text-[#848e9c] mr-1">收</span><span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>{activeItem.close?.toFixed(2)}</span></span>
                <span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>{activeItem.changePercent?.toFixed(2)}%</span>
             </>
         ) : <span>-</span>}
      </div>

      {/* Indicator Legend */}
      <div className="px-2 py-1 flex text-[11px] font-mono gap-4 items-center bg-white dark:bg-[#161a25] z-20 relative h-[24px]">
         {activeItem && showMA && (
             activeTech === 'BOLL' ? (
                <>
                  <span className="text-[#fb7185]">UPPER: {activeItem.bollUpper ? activeItem.bollUpper.toFixed(2) : '-'}</span>
                  <span className="text-[#f0b90b]">MID: {activeItem.bollMiddle ? activeItem.bollMiddle.toFixed(2) : '-'}</span>
                  <span className="text-[#38bdf8]">LOWER: {activeItem.bollLower ? activeItem.bollLower.toFixed(2) : '-'}</span>
                </>
            ) : (
                <>
                  <span className="text-[#f0b90b]">MA5: {activeItem.MA5?.toFixed(2)}</span>
                  <span className="text-[#3b82f6]">MA10: {activeItem.MA10?.toFixed(2)}</span>
                  <span className="text-[#a855f7]">MA30: {activeItem.MA30?.toFixed(2)}</span>
                  <span className="text-[#22c55e]">MA60: {activeItem.MA60?.toFixed(2)}</span>
                </>
             )
         )}
         {showChanStructure && (
           <span className="ml-auto text-[10px] text-amber-700 dark:text-amber-300">
             缠论 {chanSummaryLabel}
           </span>
         )}
      </div>

      {/* UNIFIED CHART CONTAINER WITH OVERLAY */}
      <div 
         className={`flex-1 flex flex-col bg-white dark:bg-[#161a25] relative select-none ${isDragging.current ? 'cursor-grabbing' : 'cursor-crosshair'}`}
         ref={chartAreaRef}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseLeave}
         onWheel={handleWheel}
      >
         {loading && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-[#161a25]/80">
                 <Loader2 className="animate-spin text-slate-400 dark:text-[#848e9c]" />
             </div>
         )}
         
         {!loading && fullData.length === 0 && (
             <div className="absolute inset-0 z-50 flex items-center justify-center text-slate-400 dark:text-[#848e9c]">
                 暂无数据
             </div>
         )}

         {/* Charts Layer */}
         <div className="flex flex-col h-full w-full pointer-events-none">
            {/* Main Chart */}
            <div className="w-full relative" style={{ height: layout.main }}>
                <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={displayData} margin={MAIN_CHART_MARGIN}>
                     <YAxis domain={priceDomain} orientation="right" tick={{fontSize: 10, fill: '#64748b'}} tickCount={6} axisLine={false} tickLine={false} width={40} />
                     <Bar dataKey="candleBody" shape={<CandleStickShape />} isAnimationActive={false} />
                      {showMA && (
                        <>
                          <Line type="monotone" dataKey="MA5" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="MA10" stroke="#3b82f6" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="MA30" stroke="#a855f7" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="MA60" stroke="#22c55e" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                      )}
                      {activeTech === 'BOLL' && (
                         <>
                           <Line type="monotone" dataKey="bollUpper" stroke="#fb7185" dot={false} strokeWidth={1} isAnimationActive={false} strokeDasharray="4 2" />
                          <Line type="monotone" dataKey="bollMiddle" stroke="#fbbf24" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="bollLower" stroke="#38bdf8" dot={false} strokeWidth={1} isAnimationActive={false} strokeDasharray="4 2" />
                        </>
                     )}
                   </ComposedChart>
                </ResponsiveContainer>
                {showChanStructure && (
                  <div
                    className="absolute pointer-events-none z-10 overflow-visible"
                    style={{
                      top: MAIN_CHART_MARGIN.top,
                      right: PRICE_AXIS_WIDTH + MAIN_CHART_MARGIN.right,
                      bottom: MAIN_CHART_MARGIN.bottom,
                      left: MAIN_CHART_MARGIN.left
                    }}
                  >
                  <svg className="w-full h-full overflow-visible">
                    {chanAnalysis.pivotZones.map((box, index) => {
                      const x = `${(box.startIndex / displayData.length) * 100}%`;
                      const width = `${(Math.max(box.endIndex - box.startIndex, 1) / displayData.length) * 100}%`;
                      const y = `${((priceDomain[1] - box.upper) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                      const height = `${((box.upper - box.lower) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                      return (
                        <rect
                          key={`chan-box-${index}-${box.startIndex}-${box.endIndex}`}
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill="rgba(59, 130, 246, 0.14)"
                          stroke="rgba(59, 130, 246, 0.9)"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          rx={3}
                        />
                      );
                    })}
                    {chanAnalysis.segments.map((segment) => {
                      const x1 = `${((segment.start.index + 0.5) / displayData.length) * 100}%`;
                      const y1 = `${((priceDomain[1] - segment.start.price) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                      const x2 = `${((segment.end.index + 0.5) / displayData.length) * 100}%`;
                      const y2 = `${((priceDomain[1] - segment.end.price) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                      return (
                        <line
                          key={segment.id}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={segment.direction === 'up' ? '#8b5cf6' : '#ec4899'}
                          strokeWidth={3}
                          strokeDasharray="6 3"
                          strokeLinecap="round"
                          opacity={0.78}
                        />
                      );
                    })}
                    {chanBiPoints.map((point, index) => {
                      if (chanBiPoints.length < 2) return null;
                      const x = `${((point.index + 0.5) / displayData.length) * 100}%`;
                      const y = `${((priceDomain[1] - point.price) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                      const stroke = point.type === 'top' ? '#f97316' : '#06b6d4';
                      return (
                        <g key={`${point.date}-${point.type}-${point.index}`}>
                          {index > 0 && (() => {
                            const prev = chanBiPoints[index - 1];
                            const x1 = `${((prev.index + 0.5) / displayData.length) * 100}%`;
                            const y1 = `${((priceDomain[1] - prev.price) / Math.max(priceDomain[1] - priceDomain[0], 0.0001)) * 100}%`;
                            return (
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x}
                                y2={y}
                                stroke="#f59e0b"
                                strokeWidth={2}
                                strokeLinecap="round"
                                opacity={0.95}
                              />
                            );
                          })()}
                          <circle cx={x} cy={y} r={3.5} fill={stroke} stroke="#ffffff" strokeWidth={1} />
                        </g>
                      );
                    })}
                  </svg>
                  </div>
                )}
            </div>

            {/* Volume Chart */}
            <div className="w-full border-t border-slate-200 dark:border-slate-800 relative" style={{ height: layout.volume }}>
                 <div className="absolute top-1 left-2 text-[10px] text-slate-400 dark:text-[#848e9c]">VOL: {activeItem ? activeItem.volume : ''}</div>
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={displayData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                     <YAxis orientation="right" tick={{fontSize: 10, fill: '#64748b'}} tickCount={3} axisLine={false} tickLine={false} width={40} />
                     <Bar dataKey="volume" isAnimationActive={false}>
                        {displayData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isUp ? '#ef4444' : '#10b981'} />
                        ))}
                     </Bar>
                   </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Tech Chart */}
            <div className="w-full border-t border-slate-200 dark:border-slate-800 relative" style={{ height: layout.tech }}>
                 {/* Tech Legend */}
                 {activeItem && (
                    <>
                      {activeTech === 'MACD' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">DIF: {activeItem.dif?.toFixed(3)}</span>
                          <span className="text-[#3b82f6]">DEA: {activeItem.dea?.toFixed(3)}</span>
                          <span className={activeItem.macd >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>MACD: {activeItem.macd?.toFixed(3)}</span>
                        </div>
                      )}
                      {activeTech === 'KDJ' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">K: {activeItem.k?.toFixed(2)}</span>
                          <span className="text-[#3b82f6]">D: {activeItem.d?.toFixed(2)}</span>
                          <span className="text-[#a855f7]">J: {activeItem.j?.toFixed(2)}</span>
                        </div>
                      )}
                      {activeTech === 'RSI' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">RSI14: {activeItem.rsi?.toFixed(2)}</span>
                        </div>
                      )}
                      {activeTech === 'BIAS' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">BIAS6: {activeItem.bias6?.toFixed(2)}%</span>
                          <span className="text-[#3b82f6]">BIAS12: {activeItem.bias12?.toFixed(2)}%</span>
                          <span className="text-[#a855f7]">BIAS24: {activeItem.bias24?.toFixed(2)}%</span>
                        </div>
                      )}
                      {activeTech === 'WR' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">WR14: {activeItem.wr?.toFixed(2)}</span>
                        </div>
                      )}
                      {activeTech === 'VR' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#f0b90b]">VR26: {activeItem.vr?.toFixed(2)}</span>
                        </div>
                      )}
                      {activeTech === 'BOLL' && (
                        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
                          <span className="text-[#fb7185]">UP: {activeItem.bollUpper?.toFixed(2)}</span>
                          <span className="text-[#f0b90b]">MID: {activeItem.bollMiddle?.toFixed(2)}</span>
                          <span className="text-[#38bdf8]">LOW: {activeItem.bollLower?.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                 )}
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={displayData} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
                     <YAxis 
                        orientation="right" 
                        domain={techYAxisProps.domain} 
                        tick={{fontSize: 10, fill: '#64748b'}} 
                        tickCount={3} 
                        axisLine={false} 
                        tickLine={false} 
                        width={40}
                        allowDecimals={techYAxisProps.allowDecimals}
                     />
                     {activeTech === 'MACD' && (
                        <>
                          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                          <Bar dataKey="macd" isAnimationActive={false}>
                              {displayData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.macd >= 0 ? '#ef4444' : '#10b981'} />
                              ))}
                          </Bar>
                          <Line type="monotone" dataKey="dif" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="dea" stroke="#3b82f6" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                     {activeTech === 'KDJ' && (
                        <>
                           <ReferenceLine y={80} stroke="#64748b" strokeDasharray="3 3" />
                           <ReferenceLine y={20} stroke="#64748b" strokeDasharray="3 3" />
                           <Line type="monotone" dataKey="k" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                           <Line type="monotone" dataKey="d" stroke="#3b82f6" dot={false} strokeWidth={1} isAnimationActive={false} />
                           <Line type="monotone" dataKey="j" stroke="#a855f7" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                     {activeTech === 'RSI' && (
                        <>
                          <ReferenceLine y={70} stroke="#64748b" strokeDasharray="3 3" />
                          <ReferenceLine y={30} stroke="#64748b" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="rsi" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                     {activeTech === 'BIAS' && (
                        <>
                          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="bias6" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="bias12" stroke="#3b82f6" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="bias24" stroke="#a855f7" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                     {activeTech === 'WR' && (
                        <>
                          <ReferenceLine y={-20} stroke="#64748b" strokeDasharray="3 3" />
                          <ReferenceLine y={-80} stroke="#64748b" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="wr" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                     {activeTech === 'VR' && (
                        <>
                          <ReferenceLine y={160} stroke="#64748b" strokeDasharray="3 3" />
                          <ReferenceLine y={70} stroke="#64748b" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="vr" stroke="#f0b90b" dot={false} strokeWidth={1} isAnimationActive={false} />
                        </>
                     )}
                      {activeTech === 'BOLL' && (
                        <>
                          <Line type="monotone" dataKey="bollUpper" stroke="#fb7185" dot={false} strokeWidth={1} isAnimationActive={false} strokeDasharray="4 2" />
                          <Line type="monotone" dataKey="bollMiddle" stroke="#fbbf24" dot={false} strokeWidth={1} isAnimationActive={false} />
                          <Line type="monotone" dataKey="bollLower" stroke="#38bdf8" dot={false} strokeWidth={1} isAnimationActive={false} strokeDasharray="4 2" />
                        </>
                     )}
                   </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* CUSTOM CROSSHAIR OVERLAY */}
         {crosshair && (
             <div className="absolute inset-0 pointer-events-none z-30">
                 {/* Lines */}
                 <svg className="w-full h-full">
                     <line 
                        x1={crosshair.x} y1={0} 
                        x2={crosshair.x} y2="100%" 
                        stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 4" 
                     />
                     <line 
                        x1={0} y1={crosshair.y} 
                        x2="100%" y2={crosshair.y} 
                        stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 4" 
                     />
                 </svg>

                 {/* Price Tag (Right Axis) */}
                 {crosshair.y <= 210 && (
                     <div 
                        className="absolute right-0 bg-slate-800 text-white text-[10px] px-1 py-0.5 rounded-l font-mono border-y border-l border-slate-600"
                        style={{ top: crosshair.y - 10 }}
                     >
                        {crosshair.price.toFixed(2)}
                     </div>
                 )}

                 {/* Time Tag (Bottom) */}
                 <div 
                    className="absolute bottom-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded-t font-mono border-x border-t border-slate-600 transform -translate-x-1/2"
                    style={{ left: crosshair.x }}
                 >
                    {activeItem?.date}
                 </div>
             </div>
         )}
      </div>

      {/* Tech Tabs */}
      <div className="flex border-t border-b border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-[#1e222d] overflow-x-auto z-20 relative">
        <button
          onClick={() => setShowMA(prev => !prev)}
          className={`px-3 py-2 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 transition-colors ${
            showMA
              ? 'text-[#f0b90b] bg-amber-50 dark:bg-amber-500/10'
              : 'text-slate-500 dark:text-[#848e9c]'
          }`}
        >
          MA均线
        </button>
        <button
          onClick={() => setShowChanStructure(prev => !prev)}
          className={`px-3 py-2 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 transition-colors ${
            showChanStructure
              ? 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10'
              : 'text-slate-500 dark:text-[#848e9c]'
          }`}
        >
          缠论结构
        </button>
        {['MACD', 'KDJ', 'RSI', 'BOLL', 'BIAS', 'WR', 'VR'].map((tab) => (
          <div 
            key={tab} 
            onClick={() => setActiveTech(tab)}
            className={`px-3 py-2 cursor-pointer whitespace-nowrap hover:bg-slate-200 dark:hover:bg-[#2b313f] transition-colors ${activeTech === tab ? 'text-[#f0b90b] bg-slate-200 dark:bg-[#2b313f]' : 'text-slate-500 dark:text-[#848e9c]'}`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Footer Buttons */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-[#1e222d] z-20 relative xl:grid-cols-5">
        <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
          <Plus size={14} /> 加自选
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 bg-slate-100 dark:bg-[#2b313f] hover:bg-slate-200 dark:hover:bg-[#363c4e] text-slate-700 dark:text-[#e1e4ea] text-xs py-2 rounded transition-colors">
          <LayoutGrid size={14} /> 加板块
        </button>
        <button
          onClick={() => emitAIStockObservationRequest(stock.symbol, 'hover-card')}
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
    </div>
  );
};

export default StockHoverCard;
