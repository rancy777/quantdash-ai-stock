import { useEffect, useState } from 'react';

import { MOCK_NEWS } from '../../../constants';
import { filterNewsByDate, getInfoGatheringNewsGroups } from '../../../services/newsService';
import type { NewsItem } from '../../../types';
import type { NewsSourceGroup } from '../types';

export default function useNewsWorkflow() {
  const [selectedNews, setSelectedNews] = useState<NewsItem>(MOCK_NEWS[0]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);
  const [rawNewsGroups, setRawNewsGroups] = useState<{ cls: NewsItem[]; external: NewsItem[]; merged: NewsItem[] }>({
    cls: [],
    external: [],
    merged: [],
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newsGroups, setNewsGroups] = useState<NewsSourceGroup[]>([
    { id: 'cls', title: '财联社新闻', description: '盘中电报与快讯', items: [] },
    { id: 'external', title: '外网新闻', description: '外媒与新闻聚合', items: [] },
  ]);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadNews = async () => {
      setLoadingNews(true);
      const grouped = await getInfoGatheringNewsGroups();
      if (!mounted) return;
      setRawNewsGroups(grouped);
      setLoadingNews(false);
    };

    void loadNews();
    const timer = window.setInterval(() => {
      void loadNews();
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const filteredCls = filterNewsByDate(rawNewsGroups.cls, selectedDate);
    const filteredExternal = filterNewsByDate(rawNewsGroups.external, selectedDate);
    const filteredMerged = filterNewsByDate(rawNewsGroups.merged, selectedDate);

    setNewsItems(filteredMerged);
    setNewsGroups([
      { id: 'cls', title: '财联社新闻', description: '盘中电报与快讯', items: filteredCls },
      { id: 'external', title: '外网新闻', description: '外媒与新闻聚合', items: filteredExternal },
    ]);
    setSelectedNews((prev) => filteredMerged.find((item) => item.id === prev.id) ?? filteredMerged[0] ?? MOCK_NEWS[0]);
  }, [rawNewsGroups, selectedDate]);

  return {
    loadingNews,
    newsItems,
    newsGroups,
    selectedDate,
    selectedNews,
    setSelectedDate,
    setSelectedNews,
  };
}
