import React from 'react';
import { HoverCardDataPoint } from './types';

type CandleStickShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: HoverCardDataPoint | null;
};

const getNumericValue = (entry: HoverCardDataPoint, key: string): number =>
  typeof entry[key] === 'number' ? (entry[key] as number) : 0;

export const CandleStickShape = (props: CandleStickShapeProps) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload?.candleBody) return null;

  const color = payload.isUp ? '#ef4444' : '#10b981';
  const [minBody, maxBody] = payload.candleBody;
  const bodyRange = maxBody - minBody;
  const ratio = bodyRange === 0 ? 0 : height / bodyRange;

  const yHigh = y - (payload.high - maxBody) * ratio;
  const yLow = y + height + (minBody - payload.low) * ratio;
  const center = x + width / 2;

  return (
    <g>
      <line
        x1={center}
        y1={Number.isNaN(yHigh) ? y : yHigh}
        x2={center}
        y2={Number.isNaN(yLow) ? y + height : yLow}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(1, height)}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

const calcMA = (data: HoverCardDataPoint[], n: number): HoverCardDataPoint[] => {
  if (!data.length) return [];
  return data.map((entry, index) => {
    if (index < n - 1) return { ...entry, [`MA${n}`]: null };
    const sum = data
      .slice(index - n + 1, index + 1)
      .reduce((acc, curr) => acc + curr.close, 0);
    return { ...entry, [`MA${n}`]: sum / n };
  });
};

const calcEMA = (
  data: HoverCardDataPoint[],
  n: number,
  key = 'close'
): HoverCardDataPoint[] => {
  if (!data.length) return [];
  const k = 2 / (n + 1);
  let ema = getNumericValue(data[0], key);
  return data.map((entry, index) => {
    if (index === 0) return { ...entry, [`ema${n}`]: ema };
    ema = getNumericValue(entry, key) * k + ema * (1 - k);
    return { ...entry, [`ema${n}`]: ema };
  });
};

const calcRSI = (data: HoverCardDataPoint[], n = 14): HoverCardDataPoint[] => {
  if (!data.length) return [];
  let gains = 0;
  let losses = 0;
  return data.map((entry, index) => {
    if (index < n) return { ...entry, rsi: null };
    if (index === n) {
      for (let offset = 1; offset <= n; offset += 1) {
        const current = data[offset];
        const previous = data[offset - 1];
        if (!current || !previous) continue;
        const change = current.close - previous.close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      gains /= n;
      losses /= n;
    } else {
      const previous = data[index - 1];
      if (previous) {
        const change = entry.close - previous.close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        gains = (gains * (n - 1) + gain) / n;
        losses = (losses * (n - 1) + loss) / n;
      }
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - 100 / (1 + rs);
    return { ...entry, rsi };
  });
};

const calcKDJ = (data: HoverCardDataPoint[]): HoverCardDataPoint[] => {
  if (!data.length) return [];
  let k = 50;
  let d = 50;
  return data.map((entry, index) => {
    if (index < 8) return { ...entry, k: 50, d: 50, j: 50 };
    const slice = data.slice(index - 8, index + 1);
    const low9 = Math.min(...slice.map((item) => item.low));
    const high9 = Math.max(...slice.map((item) => item.high));
    const rsv = high9 === low9 ? 50 : ((entry.close - low9) / (high9 - low9)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    const j = 3 * k - 2 * d;
    return { ...entry, k, d, j };
  });
};

const calcBOLL = (
  data: HoverCardDataPoint[],
  period = 20,
  multiplier = 2
): HoverCardDataPoint[] => {
  if (!data.length) return [];
  return data.map((entry, index) => {
    if (index < period - 1) {
      return { ...entry, bollUpper: null, bollMiddle: null, bollLower: null };
    }
    const slice = data.slice(index - period + 1, index + 1);
    const mean = slice.reduce((acc, curr) => acc + curr.close, 0) / period;
    const variance =
      slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      ...entry,
      bollUpper: mean + multiplier * std,
      bollMiddle: mean,
      bollLower: mean - multiplier * std,
    };
  });
};

const calcBIAS = (
  data: HoverCardDataPoint[],
  periods: number[] = [6, 12, 24]
): HoverCardDataPoint[] => {
  if (!data.length) return [];
  return data.map((entry, index) => {
    const next: HoverCardDataPoint = { ...entry };
    periods.forEach((period) => {
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

const calcWR = (data: HoverCardDataPoint[], period = 14): HoverCardDataPoint[] => {
  if (!data.length) return [];
  return data.map((entry, index) => {
    if (index < period - 1) return { ...entry, wr: null };
    const slice = data.slice(index - period + 1, index + 1);
    const high = Math.max(...slice.map((item) => item.high));
    const low = Math.min(...slice.map((item) => item.low));
    if (high === low) return { ...entry, wr: null };
    const wr = ((high - entry.close) / (high - low)) * -100;
    return { ...entry, wr };
  });
};

const calcVR = (data: HoverCardDataPoint[], period = 26): HoverCardDataPoint[] => {
  if (!data.length) return [];
  return data.map((entry, index) => {
    if (index < period) return { ...entry, vr: null };
    let av = 0;
    let bv = 0;
    let cv = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const current = data[cursor];
      const previous = data[cursor - 1] ?? current;
      if (!previous) continue;
      if (current.close > previous.close) av += current.volume;
      else if (current.close < previous.close) bv += current.volume;
      else cv += current.volume;
    }
    const base = bv * 2 + cv || 1;
    return { ...entry, vr: ((av * 2 + cv) / base) * 100 };
  });
};

export const processHoverCardData = <
  T extends {
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  },
>(
  rawKlines: T[]
): HoverCardDataPoint[] => {
  const baseData = rawKlines.map((entry) => {
    const open = Number(entry.open ?? 0);
    const close = Number(entry.close ?? 0);
    return {
      ...entry,
      date: String(entry.date ?? ''),
      open,
      close,
      high: Number(entry.high ?? 0),
      low: Number(entry.low ?? 0),
      volume: Number(entry.volume ?? 0),
      isUp: close >= open,
      candleBody: [Math.min(open, close), Math.max(open, close)] as [number, number],
      change: close - open,
      changePercent: open === 0 ? 0 : ((close - open) / open) * 100,
    } satisfies HoverCardDataPoint;
  });

  let processed = calcMA(baseData, 5);
  processed = calcMA(processed, 10);
  processed = calcMA(processed, 30);
  processed = calcMA(processed, 60);
  processed = calcBOLL(processed);
  processed = calcBIAS(processed);
  processed = calcWR(processed);
  processed = calcVR(processed);
  processed = calcRSI(processed);
  processed = calcKDJ(processed);

  let emaData = calcEMA(processed, 12);
  if (!emaData.length) return [];
  emaData = calcEMA(emaData, 26);
  let dea = getNumericValue(emaData[0], 'ema12') - getNumericValue(emaData[0], 'ema26');

  return emaData.map((entry, index) => {
    const dif = getNumericValue(entry, 'ema12') - getNumericValue(entry, 'ema26');
    if (index > 0) dea = dea * 0.8 + dif * 0.2;
    return {
      ...entry,
      dif,
      dea,
      macd: (dif - dea) * 2,
    };
  });
};
