import { SectorBoardType, SectorCycleData, SectorPersistenceData, SectorPersistenceEntry } from '../types';
import {
  getDataFreshnessMeta,
  mergeDataFreshnessMeta,
  requestEastmoneyAction,
  setDataFreshnessMeta,
} from './eastmoneyService';
import { loadLocalJsonFile } from './localDataService';

type SectorBoardSnapshot = {
  code: string;
  name: string;
  pctChange: number;
  date: string;
};

const SECTOR_BOARD_CONFIG: Record<SectorBoardType, { fs: string; label: string }> = {
  concept: { fs: 'm:90+t:2+f:!50', label: '概念板块' },
  industry: { fs: 'm:90+t:3+f:!50', label: '行业板块' },
};

const SECTOR_HISTORY_CACHE = new Map<SectorBoardType, { timestamp: number; rows: SectorBoardSnapshot[] }>();
const SECTOR_META_KEY = (boardType: SectorBoardType) => `sector-cycle:${boardType}`;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchSectorBoardList = async (boardType: SectorBoardType) => {
  const res = await requestEastmoneyAction<any>(
    'sector_board_list',
    { boardType },
    { metaKey: `sector-board-list:${boardType}`, preferSnapshot: true },
  );
  const diff = res?.data?.diff;
  return Array.isArray(diff) ? diff : [];
};

const fetchSectorBoardHistory = async (code: string): Promise<SectorBoardSnapshot[]> => {
  const res = await requestEastmoneyAction<any>(
    'sector_board_history',
    { code },
    { metaKey: `sector-board-history:${code}`, preferSnapshot: true, timeout: 5000 },
  );
  const klines = res?.data?.klines;
  const name = res?.data?.name || code;
  if (!Array.isArray(klines)) return [];

  return klines
    .map((line: string) => {
      const parts = String(line).split(',');
      const date = parts[0];
      const pctChange = Number(parts[8]);
      if (!date || Number.isNaN(pctChange)) return null;
      return { code, name, pctChange, date };
    })
    .filter((item): item is SectorBoardSnapshot => Boolean(item));
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const collectSectorHistoryRows = async (boardType: SectorBoardType): Promise<SectorBoardSnapshot[]> => {
  const cached = SECTOR_HISTORY_CACHE.get(boardType);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.rows;
  }

  const sectorList = await fetchSectorBoardList(boardType);
  if (!sectorList.length) {
    return [];
  }

  const candidates = sectorList.slice(0, 24);
  const historyRows: SectorBoardSnapshot[] = [];

  for (const chunk of chunkArray(candidates, 6)) {
    const results = await Promise.all(
      chunk.map(async (item: any) => {
        try {
          return await fetchSectorBoardHistory(String(item.f12));
        } catch {
          return [];
        }
      }),
    );
    results.forEach((rows) => historyRows.push(...rows));
    await delay(50);
  }

  setDataFreshnessMeta(
    SECTOR_META_KEY(boardType),
    mergeDataFreshnessMeta([
      getDataFreshnessMeta(`sector-board-list:${boardType}`),
      ...candidates.map((item: any) => getDataFreshnessMeta(`sector-board-history:${String(item.f12)}`)),
    ]),
  );
  SECTOR_HISTORY_CACHE.set(boardType, { timestamp: Date.now(), rows: historyRows });
  return historyRows;
};

export const getSectorDataFreshness = (boardType: SectorBoardType) => getDataFreshnessMeta(SECTOR_META_KEY(boardType));

export const getSectorRotationData = async (
  boardType: SectorBoardType = 'concept',
): Promise<SectorCycleData> => {
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8];

  const localRotation = await loadLocalJsonFile<SectorCycleData>(`sector_rotation_${boardType}.json`);
  if (localRotation?.dates?.length) {
    setDataFreshnessMeta(SECTOR_META_KEY(boardType), {
      detail: `${SECTOR_BOARD_CONFIG[boardType].label}本地快照`,
      source: 'local',
      updatedAt: null,
    });
    return localRotation;
  }

  try {
    const historyRows = await collectSectorHistoryRows(boardType);
    if (!historyRows.length) {
      return { dates: [], ranks, data: {} };
    }

    const groupedByDate = new Map<string, SectorBoardSnapshot[]>();
    historyRows.forEach((row) => {
      if (!groupedByDate.has(row.date)) {
        groupedByDate.set(row.date, []);
      }
      groupedByDate.get(row.date)!.push(row);
    });

    const sortedDates = [...groupedByDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 5);
    const dates = sortedDates.map((date) => date.slice(5));
    const data: SectorCycleData['data'] = {};

    sortedDates.forEach((fullDate, dateIndex) => {
      const dateLabel = dates[dateIndex];
      const rankedBoards = (groupedByDate.get(fullDate) || [])
        .sort((a, b) => {
          if (b.pctChange !== a.pctChange) {
            return b.pctChange - a.pctChange;
          }
          return a.name.localeCompare(b.name, 'zh-CN');
        })
        .slice(0, ranks.length);

      data[dateLabel] = {};
      rankedBoards.forEach((item, index) => {
        const rank = index + 1;
        data[dateLabel][rank] = {
          code: item.code,
          name: item.name,
          pctChange: Number(item.pctChange.toFixed(2)),
          rank,
        };
      });
    });

    if (dates.length) {
      return { dates, ranks, data };
    }
  } catch (e) {
    console.warn(`Failed to fetch ${SECTOR_BOARD_CONFIG[boardType].label} rotation data`, e);
  }

  return { dates: [], ranks, data: {} };
};

export const getSectorPersistenceData = async (
  boardType: SectorBoardType = 'concept',
): Promise<SectorPersistenceData | null> => {
  const localPersistence = await loadLocalJsonFile<SectorPersistenceData>(`sector_persistence_${boardType}.json`);
  if (localPersistence?.entries?.length) {
    setDataFreshnessMeta(SECTOR_META_KEY(boardType), {
      detail: `${SECTOR_BOARD_CONFIG[boardType].label}本地快照`,
      source: 'local',
      updatedAt: null,
    });
    return localPersistence;
  }

  try {
    const historyRows = await collectSectorHistoryRows(boardType);
    if (!historyRows.length) {
      return null;
    }

    const groupedByDate = new Map<string, SectorBoardSnapshot[]>();
    historyRows.forEach((row) => {
      if (!groupedByDate.has(row.date)) {
        groupedByDate.set(row.date, []);
      }
      groupedByDate.get(row.date)!.push(row);
    });

    const sortedDates = [...groupedByDate.keys()].sort((a, b) => a.localeCompare(b)).slice(-5);
    if (!sortedDates.length) {
      return null;
    }

    const rankedByDate = sortedDates
      .map((fullDate) => {
        const rankedBoards = (groupedByDate.get(fullDate) || []).sort((a, b) => {
          if (b.pctChange !== a.pctChange) return b.pctChange - a.pctChange;
          return a.name.localeCompare(b.name, 'zh-CN');
        });
        return {
          fullDate,
          rankedBoards,
          leader: rankedBoards[0] ?? null,
        };
      })
      .filter(
        (item): item is { fullDate: string; rankedBoards: SectorBoardSnapshot[]; leader: SectorBoardSnapshot } =>
          Boolean(item.leader),
      );

    if (!rankedByDate.length) {
      return null;
    }

    const topThreeCountMap = new Map<string, number>();
    rankedByDate.forEach(({ rankedBoards }) => {
      rankedBoards.slice(0, 3).forEach((item) => {
        topThreeCountMap.set(item.name, (topThreeCountMap.get(item.name) ?? 0) + 1);
      });
    });

    const entries: SectorPersistenceEntry[] = rankedByDate.map((item, index) => {
      const leader = item.leader;
      let streakDays = 1;
      for (let cursor = index - 1; cursor >= 0; cursor--) {
        if (rankedByDate[cursor].leader.name === leader.name) {
          streakDays++;
        } else {
          break;
        }
      }

      const prevLeader = index > 0 ? rankedByDate[index - 1].leader : null;
      const strengthDelta =
        prevLeader && prevLeader.name === leader.name
          ? Number((leader.pctChange - prevLeader.pctChange).toFixed(2))
          : null;

      return {
        date: item.fullDate.slice(5),
        leaderName: leader.name,
        leaderCode: leader.code,
        leaderPctChange: Number(leader.pctChange.toFixed(2)),
        streakDays,
        topThreeAppearances: topThreeCountMap.get(leader.name) ?? 1,
        strengthDelta,
      };
    });

    const currentEntry = entries[entries.length - 1];
    const strongestRepeat = [...topThreeCountMap.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'zh-CN');
    })[0];

    return {
      boardType,
      currentLeaderName: currentEntry.leaderName,
      currentLeaderCode: currentEntry.leaderCode,
      currentLeaderPctChange: currentEntry.leaderPctChange,
      currentStreakDays: currentEntry.streakDays,
      currentTopThreeAppearances: currentEntry.topThreeAppearances,
      strongestRepeatName: strongestRepeat?.[0] ?? currentEntry.leaderName,
      strongestRepeatCount: strongestRepeat?.[1] ?? currentEntry.topThreeAppearances,
      entries,
    };
  } catch (e) {
    console.warn(`Failed to build ${SECTOR_BOARD_CONFIG[boardType].label} persistence data`, e);
    return null;
  }
};
