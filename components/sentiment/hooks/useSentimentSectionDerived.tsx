import {
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';

import { EmotionIndicatorEntry } from '../../../types';

import useSentimentMetricCalculations from './useSentimentMetricCalculations';
import { SentimentSectionSharedState } from './types';

type UseSentimentSectionDerivedOptions = SentimentSectionSharedState & {
  selectedEmotionSeries: string[];
  selectedHistoricalDate: string;
  selectedIndexFuturesCode: 'IF' | 'IC' | 'IH' | 'IM';
  selectedSeries: string[];
  setSelectedEmotionSeries: Dispatch<SetStateAction<string[]>>;
  setSelectedSeries: Dispatch<SetStateAction<string[]>>;
};

export default function useSentimentSectionDerived(options: UseSentimentSectionDerivedOptions) {
  const [selectedBoardStock, setSelectedBoardStock] = useState<string | null>(null);
  const [isBoardHeightDragging, setIsBoardHeightDragging] = useState(false);
  const boardHeightScrollRef = useRef<HTMLDivElement | null>(null);
  const boardHeightDragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const calculations = useSentimentMetricCalculations(options);

  const handleBoardHeightMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !boardHeightScrollRef.current) return;
    boardHeightDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: boardHeightScrollRef.current.scrollLeft,
    };
    setIsBoardHeightDragging(true);
  };

  const handleBoardHeightMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!boardHeightDragRef.current.active || !boardHeightScrollRef.current) return;
    const deltaX = event.clientX - boardHeightDragRef.current.startX;
    boardHeightScrollRef.current.scrollLeft = boardHeightDragRef.current.startScrollLeft - deltaX;
  };

  const stopBoardHeightDrag = () => {
    boardHeightDragRef.current.active = false;
    setIsBoardHeightDragging(false);
  };

  const formatBoardNames = (names: string[], symbols: string[]) => {
    if (!names.length) return '—';
    return names.map((name, index) => `${name}${symbols[index] ? `(${symbols[index]})` : ''}`).join('、');
  };

  const renderBoardHeightDot =
    (
      field: 'mainBoardHighestNames' | 'mainBoardSecondHighestNames' | 'chinextHighestNames',
      color: string,
      dy: number,
      lane: 'left' | 'center' | 'right',
    ) =>
    (props: any) => {
      const { cx, cy, payload, value } = props;
      if (typeof cx !== 'number' || typeof cy !== 'number' || typeof value !== 'number' || value <= 0 || !payload) {
        return null;
      }

      const row = payload;
      const names = (row[field] ?? []).filter(Boolean);
      if (!names.length) {
        return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.4} />;
      }

      const badgeHeight = 20;
      const badgeGap = 6;
      const stackHeight = names.length * badgeHeight + Math.max(0, names.length - 1) * badgeGap;
      const startY = dy < 0 ? cy + dy - stackHeight + badgeHeight : cy + dy;
      const getBadgeWidth = (name: string) => Math.max(56, name.length * 12 + 22);
      const dateIndex = calculations.boardHeightDateIndexMap.get(row.fullDate ?? row.date) ?? 0;
      const laneOffset = lane === 'left' ? -84 : lane === 'right' ? 84 : dateIndex % 2 === 0 ? -12 : 12;
      const dayWaveOffset = (dateIndex % 3) * 8 - 8;

      return (
        <g>
          <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
          {names.map((name: string, index: number) => {
            const width = getBadgeWidth(name);
            const y = startY + index * (badgeHeight + badgeGap);
            const isSelected = selectedBoardStock === name;
            const x =
              lane === 'left'
                ? cx - width - 10 + dayWaveOffset
                : lane === 'right'
                  ? cx + 10 + dayWaveOffset
                  : cx - width / 2 + laneOffset + dayWaveOffset;

            return (
              <g
                key={`${field}-dot-${name}-${index}`}
                transform={`translate(${x}, ${y - 15})`}
                onClick={() => setSelectedBoardStock((current) => (current === name ? null : name))}
                className="cursor-pointer"
              >
                <rect
                  x={0}
                  y={0}
                  rx={8}
                  ry={8}
                  width={width}
                  height={badgeHeight}
                  fill={isSelected ? color : 'rgba(255,255,255,0.96)'}
                  stroke={isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.28)'}
                  strokeWidth={1}
                />
                {isSelected ? (
                  <rect
                    x={-2}
                    y={-2}
                    rx={10}
                    ry={10}
                    width={width + 4}
                    height={badgeHeight + 4}
                    fill="none"
                    stroke={color}
                    strokeOpacity={0.28}
                    strokeWidth={3}
                  />
                ) : (
                  <rect
                    x={1}
                    y={1}
                    rx={7}
                    ry={7}
                    width={width - 2}
                    height={badgeHeight - 2}
                    fill="none"
                    stroke={color}
                    strokeOpacity={0.22}
                    strokeWidth={1}
                  />
                )}
                <text
                  x={width / 2}
                  y={13}
                  fill={isSelected ? '#ffffff' : color}
                  fontSize={11}
                  fontWeight={isSelected ? 700 : 600}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {name}
                </text>
              </g>
            );
          })}
        </g>
      );
    };

  return {
    ...calculations,
    boardHeightScrollRef,
    formatBoardNames,
    handleBoardHeightMouseDown,
    handleBoardHeightMouseMove,
    isBoardHeightDragging,
    renderBoardHeightDot,
    stopBoardHeightDrag,
  };
}
