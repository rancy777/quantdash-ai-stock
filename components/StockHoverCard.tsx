
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChanFractal } from '../types';
import { getStockKline } from '../services/quotesService';
import { emitAIStockObservationRequest } from '../services/aiNavigationService';
import { analyzeChanStructure } from '../services/chanService';
import {
  CARD_LAYOUT,
  DRAG_FRAME_INTERVAL,
  HOVER_FRAME_INTERVAL,
} from './stockHover/constants';
import { processHoverCardData } from './stockHover/indicators';
import StockHoverCardBars from './stockHover/StockHoverCardBars';
import StockHoverCardChartArea from './stockHover/StockHoverCardChartArea';
import StockHoverCardFooter from './stockHover/StockHoverCardFooter';
import StockHoverCardHeader from './stockHover/StockHoverCardHeader';
import StockHoverCardTechTabs from './stockHover/StockHoverCardTechTabs';
import {
  ActiveTech,
  CardSize,
  CrosshairState,
  HoverCardDataPoint,
  StockHoverCardProps,
  TechYAxisProps,
} from './stockHover/types';

const StockHoverCard: React.FC<StockHoverCardProps> = ({ stock, onSizeChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullData, setFullData] = useState<HoverCardDataPoint[]>([]);
  const [viewState, setViewState] = useState({ startIndex: 0, visibleCount: 60 });

  const [activeItem, setActiveItem] = useState<HoverCardDataPoint | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);

  const [period, setPeriod] = useState(101);
  const [activeTech, setActiveTech] = useState<ActiveTech>('MACD');
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

  const chartAreaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartIdx = useRef(0);
  const viewStateRef = useRef(viewState);
  const activeItemRef = useRef<HoverCardDataPoint | null>(null);
  const crosshairRef = useRef<CrosshairState | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingDragStartRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{
    x: number;
    y: number;
    price: number;
    index: number;
    item: HoverCardDataPoint;
  } | null>(null);
  const lastDragCommitAtRef = useRef(0);
  const lastHoverCommitAtRef = useRef(0);
  const lastReportedSizeRef = useRef<CardSize | null>(null);

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

      const processed = processHoverCardData(rawKlines);
      if (processed.length > 0) {
        setFullData(processed);
        const start = Math.max(0, processed.length - 60);
        setViewState({ startIndex: start, visibleCount: 60 });
        viewStateRef.current = { startIndex: start, visibleCount: 60 };
        setActiveItem(processed[processed.length - 1]);
        activeItemRef.current = processed[processed.length - 1];
      } else {
        setFullData([]);
        setActiveItem(null);
        activeItemRef.current = null;
      }

      setLoading(false);
    };

    loadData();
    return () => {
      mounted = false;
    };
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

  const priceDomain = useMemo(() => {
    if (displayData.length === 0) return [0, 1];
    const min = Math.min(...displayData.map((item) => item.low));
    const max = Math.max(...displayData.map((item) => item.high));
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [displayData]);

  const techYAxisProps = useMemo<TechYAxisProps>(() => {
    switch (activeTech) {
      case 'KDJ':
      case 'RSI':
        return { domain: [0, 100], allowDecimals: false };
      case 'WR':
        return { domain: [-100, 0], allowDecimals: false };
      case 'VR':
        return { domain: [0, 'auto'], allowDecimals: false };
      case 'BIAS':
        return { domain: [-20, 20], allowDecimals: true };
      case 'BOLL':
        return { domain: [priceDomain[0], priceDomain[1]], allowDecimals: true };
      default:
        return { domain: ['auto', 'auto'], allowDecimals: true };
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
      <StockHoverCardHeader
        stock={stock}
        isLocked={isLocked}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
      />
      <StockHoverCardBars
        period={period}
        activeItem={activeItem}
        showMA={showMA}
        showChanStructure={showChanStructure}
        activeTech={activeTech}
        chanSummaryLabel={chanSummaryLabel}
        onSelectPeriod={(value) => {
          setPeriod(value);
          setIsLocked(false);
        }}
      />

      <StockHoverCardChartArea
        chartAreaRef={chartAreaRef}
        isDragging={isDragging.current}
        loading={loading}
        hasData={fullData.length > 0}
        displayData={displayData}
        activeItem={activeItem}
        activeTech={activeTech}
        showMA={showMA}
        showChanStructure={showChanStructure}
        layout={layout}
        priceDomain={priceDomain}
        techYAxisProps={techYAxisProps}
        chanAnalysis={chanAnalysis}
        chanBiPoints={chanBiPoints}
        crosshair={crosshair}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />

      <StockHoverCardTechTabs
        showMA={showMA}
        showChanStructure={showChanStructure}
        activeTech={activeTech}
        onToggleMA={() => setShowMA((prev) => !prev)}
        onToggleChanStructure={() => setShowChanStructure((prev) => !prev)}
        onSelectTech={(tab) => setActiveTech(tab)}
      />
      <StockHoverCardFooter
        onObserve={() => emitAIStockObservationRequest(stock.symbol, 'hover-card')}
      />
    </div>
  );
};

export default StockHoverCard;
