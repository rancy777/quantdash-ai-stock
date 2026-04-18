import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from 'recharts';
import { ChanFractal } from '../../types';
import { analyzeChanStructure } from '../../services/chanService';
import { MAIN_CHART_MARGIN, PRICE_AXIS_WIDTH } from './constants';
import { CandleStickShape } from './indicators';
import StockHoverCardCrosshairOverlay from './StockHoverCardCrosshairOverlay';
import {
  ActiveTech,
  CardLayoutPreset,
  CrosshairState,
  HoverCardDataPoint,
  TechYAxisProps,
} from './types';

type StockHoverCardChartAreaProps = {
  chartAreaRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  loading: boolean;
  hasData: boolean;
  displayData: HoverCardDataPoint[];
  activeItem: HoverCardDataPoint | null;
  activeTech: ActiveTech;
  showMA: boolean;
  showChanStructure: boolean;
  layout: CardLayoutPreset;
  priceDomain: [number, number];
  techYAxisProps: TechYAxisProps;
  chanAnalysis: ReturnType<typeof analyzeChanStructure>;
  chanBiPoints: ChanFractal[];
  crosshair: CrosshairState | null;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
};

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const formatNumber = (value: unknown, digits = 2): string => {
  const numericValue = asNumber(value);
  return numericValue === null ? '-' : numericValue.toFixed(digits);
};

function renderTechLegend(activeItem: HoverCardDataPoint, activeTech: ActiveTech) {
  switch (activeTech) {
    case 'MACD':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">DIF: {formatNumber(activeItem.dif, 3)}</span>
          <span className="text-[#3b82f6]">DEA: {formatNumber(activeItem.dea, 3)}</span>
          <span className={(asNumber(activeItem.macd) ?? 0) >= 0 ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>
            MACD: {formatNumber(activeItem.macd, 3)}
          </span>
        </div>
      );
    case 'KDJ':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">K: {formatNumber(activeItem.k)}</span>
          <span className="text-[#3b82f6]">D: {formatNumber(activeItem.d)}</span>
          <span className="text-[#a855f7]">J: {formatNumber(activeItem.j)}</span>
        </div>
      );
    case 'RSI':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">RSI14: {formatNumber(activeItem.rsi)}</span>
        </div>
      );
    case 'BIAS':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">BIAS6: {formatNumber(activeItem.bias6)}%</span>
          <span className="text-[#3b82f6]">BIAS12: {formatNumber(activeItem.bias12)}%</span>
          <span className="text-[#a855f7]">BIAS24: {formatNumber(activeItem.bias24)}%</span>
        </div>
      );
    case 'WR':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">WR14: {formatNumber(activeItem.wr)}</span>
        </div>
      );
    case 'VR':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#f0b90b]">VR26: {formatNumber(activeItem.vr)}</span>
        </div>
      );
    case 'BOLL':
      return (
        <div className="absolute top-1 left-2 flex gap-3 text-[10px] z-10 font-mono">
          <span className="text-[#fb7185]">UP: {formatNumber(activeItem.bollUpper)}</span>
          <span className="text-[#f0b90b]">MID: {formatNumber(activeItem.bollMiddle)}</span>
          <span className="text-[#38bdf8]">LOW: {formatNumber(activeItem.bollLower)}</span>
        </div>
      );
    default:
      return null;
  }
}

export default function StockHoverCardChartArea({
  chartAreaRef,
  isDragging,
  loading,
  hasData,
  displayData,
  activeItem,
  activeTech,
  showMA,
  showChanStructure,
  layout,
  priceDomain,
  techYAxisProps,
  chanAnalysis,
  chanBiPoints,
  crosshair,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onWheel,
}: StockHoverCardChartAreaProps) {
  return (
    <div
      className={`flex-1 flex flex-col bg-white dark:bg-[#161a25] relative select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-crosshair'
      }`}
      ref={chartAreaRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
    >
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-[#161a25]/80">
          <Loader2 className="animate-spin text-slate-400 dark:text-[#848e9c]" />
        </div>
      )}

      {!loading && !hasData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center text-slate-400 dark:text-[#848e9c]">
          暂无数据
        </div>
      )}

      <div className="flex flex-col h-full w-full pointer-events-none">
        <div className="w-full relative" style={{ height: layout.main }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayData} margin={MAIN_CHART_MARGIN}>
              <YAxis
                domain={priceDomain}
                orientation="right"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickCount={6}
                axisLine={false}
                tickLine={false}
                width={40}
              />
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
                left: MAIN_CHART_MARGIN.left,
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
                      {index > 0 &&
                        (() => {
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

        <div className="w-full border-t border-slate-200 dark:border-slate-800 relative" style={{ height: layout.volume }}>
          <div className="absolute top-1 left-2 text-[10px] text-slate-400 dark:text-[#848e9c]">
            VOL: {activeItem ? activeItem.volume : ''}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
              <YAxis
                orientation="right"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickCount={3}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Bar dataKey="volume" isAnimationActive={false}>
                {displayData.map((entry, index) => (
                  <Cell key={`volume-cell-${index}`} fill={entry.isUp ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full border-t border-slate-200 dark:border-slate-800 relative" style={{ height: layout.tech }}>
          {activeItem ? renderTechLegend(activeItem, activeTech) : null}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayData} margin={{ top: 20, right: 0, left: 0, bottom: 5 }}>
              <YAxis
                orientation="right"
                domain={techYAxisProps.domain}
                tick={{ fontSize: 10, fill: '#64748b' }}
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
                      <Cell key={`macd-cell-${index}`} fill={(asNumber(entry.macd) ?? 0) >= 0 ? '#ef4444' : '#10b981'} />
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

      {crosshair && (
        <StockHoverCardCrosshairOverlay
          crosshair={crosshair}
          activeDate={activeItem?.date}
          mainChartHeight={layout.main}
        />
      )}
    </div>
  );
}
