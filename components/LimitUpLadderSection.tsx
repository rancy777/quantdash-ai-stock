import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

import GlassCard from './ui/GlassCard';
import DataFreshnessBadge from './ui/DataFreshnessBadge';
import LimitUpLadderComparisonView from './limitUpLadder/LimitUpLadderComparisonView';
import LimitUpLadderConceptStats from './limitUpLadder/LimitUpLadderConceptStats';
import LimitUpLadderHoverCard from './limitUpLadder/LimitUpLadderHoverCard';
import LimitUpLadderSingleDayView from './limitUpLadder/LimitUpLadderSingleDayView';
import LimitUpLadderTableView from './limitUpLadder/LimitUpLadderTableView';
import LimitUpLadderToolbar from './limitUpLadder/LimitUpLadderToolbar';
import { LadderComparisonPair, LadderStockGroup, LadderTodayBoardEntry } from './limitUpLadder/types';
import useLimitUpLadderHoverCard from './limitUpLadder/useLimitUpLadderHoverCard';
import { DataFreshnessMeta, LadderData, Stock } from '../types';
import { getLimitUpLadderData, getLimitUpLadderDataFreshness } from '../services/stockService';
import { getSingleDayCloseChange } from '../services/quotesService';

const LimitUpLadderSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ladderData, setLadderData] = useState<LadderData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSingleDayView, setIsSingleDayView] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showColorChain, setShowColorChain] = useState(false);
  const [singleDayCloseMap, setSingleDayCloseMap] = useState<Record<string, number>>({});
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
  const [dataFreshness, setDataFreshness] = useState<DataFreshnessMeta | null>(null);
  const {
    hoveredStock,
    cardPos,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    startCloseTimer,
    closeHoverInstant,
    clearCloseTimer,
    handleSizeChange,
  } = useLimitUpLadderHoverCard();

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getLimitUpLadderData(selectedDate);
        if (!mounted) return;
        setLadderData(data);
        setDataFreshness(getLimitUpLadderDataFreshness());
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

  const selectedDateLabel = useMemo(() => selectedDate.slice(5), [selectedDate]);

  const conceptStats = useMemo(() => {
    if (!ladderData) return [] as [string, number][];
    const stats: Record<string, number> = {};

    ladderData.boardCounts.forEach((row) => {
      const stocks = row.data[selectedDateLabel] || [];
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
  }, [ladderData, selectedDateLabel]);

  const singleDayRows = useMemo(() => {
    if (!ladderData) return [] as LadderStockGroup[];
    return ladderData.boardCounts
      .map((row) => ({
        label: row.label,
        count: row.count,
        stocks: row.data[selectedDateLabel] || [],
      }))
      .filter((group) => group.stocks.length > 0);
  }, [ladderData, selectedDateLabel]);

  const previousDayData = useMemo(() => {
    if (!ladderData) return null;
    const index = ladderData.dates.findIndex((date) => date === selectedDateLabel);
    if (index === -1 || index + 1 >= ladderData.dates.length) return null;
    return { label: ladderData.dates[index + 1] };
  }, [ladderData, selectedDateLabel]);

  const currentDayStockMap = useMemo(() => {
    if (!ladderData) return new Map<string, LadderTodayBoardEntry>();
    const map = new Map<string, LadderTodayBoardEntry>();

    ladderData.boardCounts.forEach((row) => {
      (row.data[selectedDateLabel] || []).forEach((stock) => {
        map.set(stock.symbol, { stock, boardLabel: row.label });
      });
    });

    return map;
  }, [ladderData, selectedDateLabel]);

  const comparisonPairs = useMemo(() => {
    if (!ladderData || !previousDayData) return [] as LadderComparisonPair[];

    return ladderData.boardCounts
      .map((row) => {
        const prevStocks = row.data[previousDayData.label] || [];
        const upgradeTarget = row.count >= 7 ? row.count : row.count + 1;
        const targetRow = ladderData.boardCounts.find((candidate) => candidate.count === upgradeTarget);
        const currStocks = targetRow ? targetRow.data[selectedDateLabel] || [] : [];

        if (prevStocks.length === 0 && currStocks.length === 0) {
          return null;
        }

        const currentMap = new Map<string, Stock>(
          currStocks.map((stock): [string, Stock] => [stock.symbol, stock]),
        );
        const rows: LadderComparisonPair['rows'] = [];
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
              today: currentDayStockMap.get(stock.symbol) ?? {
                stock,
                boardLabel: targetRow ? targetRow.label : row.label,
              },
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
      .filter((item): item is LadderComparisonPair => Boolean(item));
  }, [ladderData, previousDayData, selectedDateLabel, currentDayStockMap]);

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
  }, [pendingCloseSymbols, selectedDate, showComparison]);

  const handleDateChange = (amount: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + amount);
    setSelectedDate(nextDate.toISOString().split('T')[0]);
  };

  const toggleSelectedStock = useCallback((symbol: string) => {
    setSelectedStockSymbol((prev) => (prev === symbol ? null : symbol));
  }, []);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <GlassCard className="flex-1 min-h-0 flex flex-col overflow-visible" noPadding>
        <div className="px-6 pt-4">
          <DataFreshnessBadge meta={dataFreshness} />
        </div>
        <LimitUpLadderToolbar
          selectedDate={selectedDate}
          showColorChain={showColorChain}
          isSingleDayView={isSingleDayView}
          showComparison={showComparison}
          comparisonEnabled={isSingleDayView && comparisonPairs.length > 0}
          disableNextDate={selectedDate >= today}
          onToggleColorChain={() => setShowColorChain((prev) => !prev)}
          onDateChange={handleDateChange}
          onSelectedDateChange={setSelectedDate}
          onToggleSingleDayView={() => setIsSingleDayView((prev) => !prev)}
          onToggleComparison={() => setShowComparison((prev) => !prev)}
        />

        {isSingleDayView && !showComparison && !loading && ladderData && conceptStats.length > 0 && (
          <LimitUpLadderConceptStats selectedDate={selectedDate} conceptStats={conceptStats} />
        )}

        {loading || !ladderData ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
            <Loader2 className="animate-spin" /> {loading ? '加载中...' : '暂无数据'}
          </div>
        ) : isSingleDayView ? (
          showComparison && comparisonPairs.length > 0 && previousDayData ? (
            <LimitUpLadderComparisonView
              previousDayLabel={previousDayData.label}
              selectedDateLabel={selectedDateLabel}
              comparisonPairs={comparisonPairs}
              singleDayCloseMap={singleDayCloseMap}
              missingSymbolsSet={missingSymbolsSet}
            />
          ) : (
            <LimitUpLadderSingleDayView
              selectedDate={selectedDate}
              selectedStockSymbol={selectedStockSymbol}
              showColorChain={showColorChain}
              rows={singleDayRows}
              getStockStyle={getStockStyle}
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onToggleSelectedStock={toggleSelectedStock}
            />
          )
        ) : (
          <LimitUpLadderTableView
            ladderData={ladderData}
            selectedDateLabel={selectedDateLabel}
            selectedStockSymbol={selectedStockSymbol}
            showColorChain={showColorChain}
            getStockStyle={getStockStyle}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onToggleSelectedStock={toggleSelectedStock}
          />
        )}
      </GlassCard>

      {hoveredStock && (
        <LimitUpLadderHoverCard
          stock={hoveredStock}
          position={cardPos}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={startCloseTimer}
          onClose={closeHoverInstant}
          onSizeChange={handleSizeChange}
        />
      )}
    </div>
  );
};

export default LimitUpLadderSection;
