import { MOCK_NEWS } from '../constants';
import { NewsItem } from '../types';
import { loadLocalJsonFile } from './localDataService';

const NEWS_FILES = ['news_cls.json', 'news_newsfilter.json'] as const;
const CLS_NEWS_FILE = 'news_cls.json';
const EXTERNAL_NEWS_FILE = 'news_newsfilter.json';

const newsSortValue = (item: NewsItem) => {
  const createdAt = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

const normalizeNewsItems = (items: NewsItem[]): NewsItem[] =>
  items
    .filter((item): item is NewsItem => Boolean(item?.id && item?.title))
    .sort((a, b) => newsSortValue(b) - newsSortValue(a));

export type InfoGatheringNewsGroups = {
  cls: NewsItem[];
  external: NewsItem[];
  merged: NewsItem[];
};

export const getInfoGatheringNewsGroups = async (): Promise<InfoGatheringNewsGroups> => {
  const loaded = await Promise.all(
    NEWS_FILES.map(async (fileName) => {
      const payload = await loadLocalJsonFile<NewsItem[]>(fileName);
      return {
        fileName,
        items: Array.isArray(payload) ? normalizeNewsItems(payload) : [],
      };
    }),
  );

  const cls = loaded.find((entry) => entry.fileName === CLS_NEWS_FILE)?.items ?? [];
  const external = loaded.find((entry) => entry.fileName === EXTERNAL_NEWS_FILE)?.items ?? [];
  const merged = normalizeNewsItems([...cls, ...external]);

  if (merged.length > 0) {
    return { cls, external, merged };
  }

  const fallback = normalizeNewsItems(MOCK_NEWS);
  return {
    cls: fallback.filter((item) => item.source === '财联社'),
    external: fallback.filter((item) => item.source !== '财联社'),
    merged: fallback,
  };
};

export const filterNewsByDate = (items: NewsItem[], date: Date): NewsItem[] => {
  const targetDateStr = date.toISOString().split('T')[0];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  return items.filter(item => {
    if (item.createdAt) {
      const itemDateStr = item.createdAt.split('T')[0];
      return itemDateStr === targetDateStr;
    }
    // 如果没有 createdAt 字段，根据 time 字段判断（处理模拟数据）
    if (targetDateStr === todayStr) {
      return item.time !== 'Yesterday';
    }
    if (targetDateStr === yesterdayStr) {
      return item.time === 'Yesterday';
    }
    // 其他日期暂时显示所有
    return true;
  });
};

export const getInfoGatheringNews = async (): Promise<NewsItem[]> => {
  const groups = await getInfoGatheringNewsGroups();
  return groups.merged;
};
