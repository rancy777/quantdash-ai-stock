import { useEffect, useState } from 'react';

import { getExpertHoldingSnapshots } from '../../../services/expertService';
import type { ExpertHoldingSnapshot } from '../../../types';

export default function useExpertSnapshots() {
  const [expertSnapshots, setExpertSnapshots] = useState<ExpertHoldingSnapshot[]>([]);
  const [selectedExpertSnapshot, setSelectedExpertSnapshot] = useState<ExpertHoldingSnapshot | null>(null);
  const [loadingExperts, setLoadingExperts] = useState(true);
  const [syncingExperts, setSyncingExperts] = useState(false);
  const [expertSyncMessage, setExpertSyncMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadExperts = async () => {
      setLoadingExperts(true);
      const items = await getExpertHoldingSnapshots();
      if (!mounted) return;
      setExpertSnapshots(items);
      setSelectedExpertSnapshot((prev) => {
        if (prev) {
          const matched = items.find((item) => item.id === prev.id);
          if (matched) return matched;
        }
        return items[0] ?? null;
      });
      setLoadingExperts(false);
    };

    void loadExperts();
    const timer = window.setInterval(() => {
      void loadExperts();
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleSyncExperts = async () => {
    setSyncingExperts(true);
    setExpertSyncMessage('');
    try {
      const items = await getExpertHoldingSnapshots();
      setExpertSnapshots(items);
      setSelectedExpertSnapshot((prev) => {
        if (prev) {
          const matched = items.find((item) => item.id === prev.id);
          if (matched) return matched;
        }
        return items[0] ?? null;
      });
      setExpertSyncMessage(
        items.length > 0
          ? '已刷新本地缓存。如需抓取最新高手 CSV，请先在终端运行 npm run sync:experts。'
          : '当前未发现本地高手数据。请先在终端运行 npm run sync:experts，再回到页面刷新。',
      );
    } catch (error) {
      console.error('同步高手数据失败:', error);
      setExpertSyncMessage('读取本地高手数据失败，请检查本地 data 文件或先运行 npm run sync:experts。');
    } finally {
      setSyncingExperts(false);
    }
  };

  return {
    expertSnapshots,
    expertSyncMessage,
    handleSyncExperts,
    loadingExperts,
    selectedExpertSnapshot,
    setSelectedExpertSnapshot,
    syncingExperts,
  };
}
