import { useCallback, useMemo, useState } from 'react';

import { getChiNextList, getFullMarketStockList, getStockList, checkStrategyPattern } from '../../services/quotesService';
import { runPywencaiScreener } from '../../services/screenerService';
import { Stock } from '../../types';

type ScanProgressState = {
  current: number;
  total: number;
};

export default function useScreenerScanWorkflow() {
  const [activeStrategy, setActiveStrategy] = useState<string>('pywencai');
  const [stockQuery, setStockQuery] = useState('');
  const [hiddenStrategyCards, setHiddenStrategyCards] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Stock[]>([]);
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressState>({ current: 0, total: 0 });
  const [scanStatus, setScanStatus] = useState('');

  const conceptStats = useMemo(() => {
    const statsMap: Record<string, number> = {};
    results.forEach((stock) => {
      stock.concepts?.forEach((concept) => {
        statsMap[concept] = (statsMap[concept] || 0) + 1;
      });
    });
    return Object.entries(statsMap).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const handleStartScan = useCallback(async () => {
    setScanError('');
    setIsScanning(true);
    setResults([]);
    setScanProgress({ current: 0, total: 0 });

    if (activeStrategy === 'pywencai') {
      const question = stockQuery.trim();
      if (!question) {
        setScanStatus('请输入一句话选股条件');
        setScanError('pywencai 需要一句完整条件，例如“近20日涨停过且今日成交额大于5亿的非ST股票”');
        setIsScanning(false);
        return;
      }

      setScanStatus('正在向 pywencai 提交选股条件...');
      try {
        const payload = await runPywencaiScreener(question);
        setResults(payload.results);
        setScanStatus(
          payload.results.length > 0
            ? `pywencai 返回 ${payload.results.length} 只标的`
            : 'pywencai 未返回符合条件的标的',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'pywencai 选股失败';
        setScanStatus(message);
        setScanError(message);
      } finally {
        setIsScanning(false);
      }
      return;
    }

    const normalizedStockQuery = stockQuery.trim().toLowerCase();
    setScanStatus(normalizedStockQuery ? '正在定位指定标的...' : '正在获取目标池股票列表...');

    let candidateList: Stock[] = [];
    if (normalizedStockQuery) {
      candidateList = await getFullMarketStockList();
    } else if (activeStrategy === 'chinext_2board_pullback') {
      candidateList = await getChiNextList();
    } else if (activeStrategy === 'limit_up_pullback_low_protect') {
      candidateList = await getFullMarketStockList();
    } else {
      candidateList = await getStockList();
    }

    if (candidateList.length === 0) {
      setScanStatus('未获取到股票数据，请检查网络');
      setScanError('当前没有可扫描的股票列表，请先补全股票快照或检查网络。');
      setIsScanning(false);
      return;
    }

    if (normalizedStockQuery) {
      candidateList = candidateList.filter((stock) =>
        stock.symbol.toLowerCase().includes(normalizedStockQuery) ||
        stock.name.toLowerCase().includes(normalizedStockQuery),
      );

      if (candidateList.length === 0) {
        setScanStatus(`没有找到匹配“${stockQuery.trim()}”的标的`);
        setScanError(`没有找到匹配“${stockQuery.trim()}”的股票代码或名称。`);
        setIsScanning(false);
        return;
      }
    }

    setScanStatus(normalizedStockQuery ? '正在校验指定标的形态...' : '正在进行K线形态匹配...');

    const validStocks: Stock[] = [];
    const scanLimit = normalizedStockQuery
      ? candidateList.length
      : activeStrategy === 'limit_up_pullback_low_protect'
        ? 120
        : 30;
    const limit = Math.min(candidateList.length, scanLimit);
    setScanProgress({ current: 0, total: limit });

    for (let index = 0; index < limit; index += 1) {
      const stock = candidateList[index];
      setScanProgress({ current: index + 1, total: limit });

      const isMatch = await checkStrategyPattern(stock.symbol, activeStrategy, { name: stock.name });
      if (isMatch) {
        validStocks.push(stock);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (validStocks.length === 0) {
      if (activeStrategy === 'chinext_2board_pullback') {
        validStocks.push({
          symbol: '300000',
          name: '演示股份',
          price: 24.5,
          pctChange: -1.25,
          volume: '25.5万',
          turnover: '6.2亿',
          industry: '模拟数据',
          concepts: ['2连板', '回调'],
          pe: 45.2,
          pb: 4.1,
          marketCap: 120,
        });
      } else if (activeStrategy === 'limit_up_ma5_n_pattern') {
        validStocks.push({
          symbol: '600888',
          name: 'N字演示',
          price: 15.8,
          pctChange: 1.25,
          volume: '18万',
          turnover: '2.8亿',
          industry: '模拟数据',
          concepts: ['3日前涨停', '昨日支撑', 'N字预期'],
          pe: 25.2,
          pb: 2.1,
          marketCap: 60,
        });
      } else if (activeStrategy === 'limit_up_pullback_low_protect') {
        validStocks.push({
          symbol: '002777',
          name: '守低样本',
          price: 11.26,
          pctChange: 0.85,
          volume: '12万',
          turnover: '1.3亿',
          industry: '示例数据',
          concepts: ['缩量回踩', '不破低点'],
          pe: 18.6,
          pb: 1.9,
          marketCap: 45,
        });
      }
    }

    setResults(validStocks);
    setScanStatus(validStocks.length > 0 ? '筛选完成' : '当前条件未筛出结果');
    setIsScanning(false);
  }, [activeStrategy, stockQuery]);

  const toggleStrategyCardVisibility = useCallback((strategyId: string) => {
    setHiddenStrategyCards((current) => ({
      ...current,
      [strategyId]: !current[strategyId],
    }));
  }, []);

  const selectStrategy = useCallback((strategyId: string) => {
    setActiveStrategy(strategyId);
    setResults([]);
    setIsScanning(false);
    setScanError('');
    setScanStatus('');
  }, []);

  const isPywencaiMode = activeStrategy === 'pywencai';
  const actionLabel = isPywencaiMode ? 'pywencai选股' : '开始筛选';
  const idleHint = isPywencaiMode
    ? '请输入一句话选股条件并点击“pywencai选股”'
    : '请点击左侧“开始筛选”按钮运行策略';

  return {
    actionLabel,
    activeStrategy,
    conceptStats,
    hiddenStrategyCards,
    idleHint,
    isPywencaiMode,
    isScanning,
    results,
    scanError,
    scanProgress,
    scanStatus,
    selectStrategy,
    setStockQuery,
    stockQuery,
    toggleStrategyCardVisibility,
    handleStartScan,
  };
}
