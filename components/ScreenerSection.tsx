import React, { useEffect, useMemo, useState } from 'react';

import { getScreenerStrategyTagText, mapStrategyCatalogToOptions } from './screener/config';
import ScreenerHoverCard from './screener/ScreenerHoverCard';
import ScreenerResultsPane from './screener/ScreenerResultsPane';
import ScreenerStrategyPanel from './screener/ScreenerStrategyPanel';
import useScreenerHoverCard from './screener/useScreenerHoverCard';
import useScreenerScanWorkflow from './screener/useScreenerScanWorkflow';
import { fetchScreenerStrategyCatalog } from '../services/screenerStrategyService';


const ScreenerSection: React.FC = () => {
  const [strategyOptions, setStrategyOptions] = useState(() =>
    mapStrategyCatalogToOptions([
      {
        id: 'pywencai',
        name: 'pywencai一句话选股',
        desc: '直接输入自然语言条件，让 pywencai 返回符合条件的股票列表，适合快速试错和盘前盘后临时筛选。',
        badge: '问财',
        iconKey: 'search-check',
        tagText: 'pywencai结果',
        matcher: null,
      },
    ]),
  );
  const {
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
  } = useScreenerScanWorkflow();
  useEffect(() => {
    let cancelled = false;
    const loadStrategyCatalog = async () => {
      const entries = await fetchScreenerStrategyCatalog();
      if (!cancelled && entries.length) {
        setStrategyOptions(mapStrategyCatalogToOptions(entries));
      }
    };
    void loadStrategyCatalog();
    return () => {
      cancelled = true;
    };
  }, []);
  const {
    hoveredStock,
    cardStyle,
    handleCardMouseEnter,
    handleCardMouseLeave,
    handleCardSizeChange,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
  } = useScreenerHoverCard();
  const strategyTagText = useMemo(
    () => getScreenerStrategyTagText(strategyOptions, activeStrategy),
    [strategyOptions, activeStrategy],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      <ScreenerStrategyPanel
        activeStrategy={activeStrategy}
        actionLabel={actionLabel}
        hiddenStrategyCards={hiddenStrategyCards}
        isPywencaiMode={isPywencaiMode}
        isScanning={isScanning}
        scanError={scanError}
        stockQuery={stockQuery}
        strategies={strategyOptions}
        onSelectStrategy={selectStrategy}
        onStartScan={() => handleStartScan(strategyOptions)}
        onStockQueryChange={setStockQuery}
        onToggleStrategyCardVisibility={toggleStrategyCardVisibility}
      />

      <ScreenerResultsPane
        conceptStats={conceptStats}
        idleHint={idleHint}
        isPywencaiMode={isPywencaiMode}
        isScanning={isScanning}
        results={results}
        scanError={scanError}
        scanProgress={scanProgress}
        scanStatus={scanStatus}
        strategyTagText={strategyTagText}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {hoveredStock && (
        <ScreenerHoverCard
          stock={hoveredStock}
          style={cardStyle()}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          onSizeChange={handleCardSizeChange}
        />
      )}
    </div>
  );
};

export default ScreenerSection;
