import {
  ChanAnalysisResult,
  ChanBi,
  ChanDirection,
  ChanFractal,
  ChanMergedKline,
  ChanPivotZone,
  ChanSegment,
  ChanPointType,
  KlineData,
} from '../types';

const getChanDirection = (
  prev: ChanMergedKline | null,
  current: Pick<ChanMergedKline, 'high' | 'low'>,
): ChanDirection => {
  if (!prev) return 'up';
  if (current.high > prev.high && current.low >= prev.low) return 'up';
  if (current.low < prev.low && current.high <= prev.high) return 'down';

  const currentMid = (current.high + current.low) / 2;
  const prevMid = (prev.high + prev.low) / 2;
  return currentMid >= prevMid ? 'up' : 'down';
};

export const mergeKlinesForChan = (
  data: Pick<KlineData, 'date' | 'high' | 'low'>[],
): ChanMergedKline[] => {
  if (!data.length) return [];

  const merged: ChanMergedKline[] = [
    {
      sourceIndex: 0,
      date: data[0].date,
      high: data[0].high,
      low: data[0].low,
    },
  ];

  for (let i = 1; i < data.length; i += 1) {
    const current = data[i];
    const last = merged[merged.length - 1];
    if (!current || !last) continue;

    const isInclusive =
      (current.high <= last.high && current.low >= last.low) ||
      (current.high >= last.high && current.low <= last.low);

    if (!isInclusive) {
      merged.push({
        sourceIndex: i,
        date: current.date,
        high: current.high,
        low: current.low,
      });
      continue;
    }

    const prev = merged.length >= 2 ? merged[merged.length - 2] : null;
    const direction = getChanDirection(prev, last);

    merged[merged.length - 1] = {
      sourceIndex: i,
      date: current.date,
      high: direction === 'up' ? Math.max(last.high, current.high) : Math.min(last.high, current.high),
      low: direction === 'up' ? Math.max(last.low, current.low) : Math.min(last.low, current.low),
    };
  }

  return merged;
};

export const findChanPivot = (
  prev: ChanMergedKline,
  current: ChanMergedKline,
  next: ChanMergedKline,
): ChanPointType | null => {
  const isTop =
    current.high >= prev.high &&
    current.high >= next.high &&
    current.low >= prev.low &&
    current.low >= next.low;
  if (isTop) return 'top';

  const isBottom =
    current.low <= prev.low &&
    current.low <= next.low &&
    current.high <= prev.high &&
    current.high <= next.high;
  if (isBottom) return 'bottom';

  return null;
};

export const buildChanFractals = (
  data: Pick<KlineData, 'date' | 'high' | 'low'>[],
): ChanFractal[] => {
  const merged = mergeKlinesForChan(data);
  if (merged.length < 3) return [];

  const fractals: ChanFractal[] = [];

  for (let i = 1; i < merged.length - 1; i += 1) {
    const prev = merged[i - 1];
    const current = merged[i];
    const next = merged[i + 1];
    if (!prev || !current || !next) continue;

    const pivotType = findChanPivot(prev, current, next);
    if (!pivotType) continue;

    fractals.push({
      index: current.sourceIndex,
      mergedIndex: i,
      price: pivotType === 'top' ? current.high : current.low,
      type: pivotType,
      date: current.date,
    });
  }

  return fractals;
};

export const buildChanBis = (
  data: Pick<KlineData, 'date' | 'high' | 'low'>[],
): ChanBi[] => {
  const rawFractals = buildChanFractals(data);
  if (rawFractals.length < 2) return [];

  const normalized: ChanFractal[] = [];

  for (const point of rawFractals) {
    const last = normalized[normalized.length - 1];
    if (!last) {
      normalized.push(point);
      continue;
    }

    if (last.type === point.type) {
      const shouldReplace =
        point.type === 'top' ? point.price >= last.price : point.price <= last.price;
      if (shouldReplace) normalized[normalized.length - 1] = point;
      continue;
    }

    if (point.mergedIndex - last.mergedIndex < 4) {
      const shouldReplace =
        point.type === 'top' ? point.price >= last.price : point.price <= last.price;
      if (shouldReplace) normalized[normalized.length - 1] = point;
      continue;
    }

    normalized.push(point);
  }

  const bis: ChanBi[] = [];
  for (let i = 1; i < normalized.length; i += 1) {
    const start = normalized[i - 1];
    const end = normalized[i];
    bis.push({
      id: `${start.date}-${end.date}-${i}`,
      direction: end.price >= start.price ? 'up' : 'down',
      start,
      end,
      high: Math.max(start.price, end.price),
      low: Math.min(start.price, end.price),
    });
  }

  return bis;
};

export const buildChanSegments = (bis: ChanBi[]): ChanSegment[] => {
  if (bis.length < 3) return [];

  const segments: ChanSegment[] = [];

  for (let i = 0; i <= bis.length - 3; i += 1) {
    const first = bis[i];
    const third = bis[i + 2];
    if (first.direction !== third.direction) continue;

    const candidate: ChanSegment = {
      id: `${first.start.date}-${third.end.date}-${i}`,
      direction: first.direction,
      start: first.start,
      end: third.end,
      high: Math.max(first.high, bis[i + 1].high, third.high),
      low: Math.min(first.low, bis[i + 1].low, third.low),
      biCount: 3,
    };

    const last = segments[segments.length - 1];
    if (
      last &&
      last.direction === candidate.direction &&
      candidate.start.index <= last.end.index &&
      candidate.high >= last.low &&
      candidate.low <= last.high
    ) {
      last.end = candidate.end;
      last.high = Math.max(last.high, candidate.high);
      last.low = Math.min(last.low, candidate.low);
      last.biCount += 1;
      continue;
    }

    segments.push(candidate);
  }

  return segments;
};

type ChanRangeLike = {
  id: string;
  start: { index: number; date: string };
  end: { index: number; date: string };
  high: number;
  low: number;
};

const buildPivotZonesFromRanges = (
  ranges: ChanRangeLike[],
  sourceLevel: 'bi' | 'segment',
): ChanPivotZone[] => {
  if (ranges.length < 3) return [];

  const zones: ChanPivotZone[] = [];

  for (let i = 0; i <= ranges.length - 3; i += 1) {
    const sample = [ranges[i], ranges[i + 1], ranges[i + 2]];
    const lower = Math.max(...sample.map((item) => item.low));
    const upper = Math.min(...sample.map((item) => item.high));
    if (lower >= upper) continue;

    const candidate: ChanPivotZone = {
      id: `${sample[0].start.date}-${sample[2].end.date}-${i}`,
      startIndex: sample[0].start.index,
      endIndex: sample[2].end.index,
      upper,
      lower,
      sourceLevel,
      overlapCount: 3,
    };

    const last = zones[zones.length - 1];
    if (
      last &&
      candidate.startIndex <= last.endIndex + 1 &&
      candidate.lower <= last.upper &&
      candidate.upper >= last.lower
    ) {
      last.endIndex = Math.max(last.endIndex, candidate.endIndex);
      last.upper = Math.min(last.upper, candidate.upper);
      last.lower = Math.max(last.lower, candidate.lower);
      last.overlapCount += 1;
      continue;
    }

    zones.push(candidate);
  }

  return zones;
};

export const buildChanPivotZones = (
  bis: ChanBi[],
  segments: ChanSegment[],
): ChanPivotZone[] => {
  const biZones = buildPivotZonesFromRanges(bis, 'bi');
  if (biZones.length > 0) return biZones;
  return buildPivotZonesFromRanges(segments, 'segment');
};

export const analyzeChanStructure = (
  data: Pick<KlineData, 'date' | 'high' | 'low'>[],
): ChanAnalysisResult => {
  const mergedKlines = mergeKlinesForChan(data);
  const fractals = buildChanFractals(data);
  const bis = buildChanBis(data);
  const segments = buildChanSegments(bis);
  const pivotZones = buildChanPivotZones(bis, segments);
  const latestDirection = segments[segments.length - 1]?.direction ?? bis[bis.length - 1]?.direction ?? null;

  return {
    mergedKlines,
    fractals,
    bis,
    segments,
    pivotZones,
    summary: {
      mergedCount: mergedKlines.length,
      fractalCount: fractals.length,
      biCount: bis.length,
      segmentCount: segments.length,
      pivotZoneCount: pivotZones.length,
      latestDirection,
    },
  };
};
