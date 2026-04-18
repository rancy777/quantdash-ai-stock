import { useEffect, useState } from 'react';

import { loadFeishuBotConfig, saveFeishuBotConfig, testFeishuBotConfig } from '../../../services/feishuIntegrationService';
import { FeishuBotConfig, FeishuBotConfigTestResult } from '../../../types';

const EMPTY_FEISHU_CONFIG: FeishuBotConfig = {
  appId: '',
  appSecret: '',
  verificationToken: '',
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',
};

export default function useAIFeishuConfigWorkflow() {
  const [feishuConfig, setFeishuConfig] = useState<FeishuBotConfig>(EMPTY_FEISHU_CONFIG);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuSaving, setFeishuSaving] = useState(false);
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuFeedback, setFeishuFeedback] = useState('');
  const [feishuError, setFeishuError] = useState('');
  const [feishuTestResult, setFeishuTestResult] = useState<FeishuBotConfigTestResult | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      setFeishuLoading(true);
      setFeishuError('');
      try {
        const config = await loadFeishuBotConfig();
        setFeishuConfig(config);
      } catch (error) {
        setFeishuError(error instanceof Error ? error.message : '读取飞书配置失败');
      } finally {
        setFeishuLoading(false);
      }
    };
    void loadConfig();
  }, []);

  useEffect(() => {
    if (!feishuFeedback) return;
    const timer = window.setTimeout(() => setFeishuFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [feishuFeedback]);

  const updateFeishuConfig = (key: keyof FeishuBotConfig, value: string) => {
    setFeishuConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveFeishuConfig = async () => {
    setFeishuSaving(true);
    setFeishuError('');
    try {
      const saved = await saveFeishuBotConfig(feishuConfig);
      setFeishuConfig(saved);
      setFeishuFeedback('飞书配置已写入 .env.local');
    } catch (error) {
      setFeishuError(error instanceof Error ? error.message : '保存飞书配置失败');
    } finally {
      setFeishuSaving(false);
    }
  };

  const handleTestFeishuConfig = async () => {
    setFeishuTesting(true);
    setFeishuError('');
    try {
      const result = await testFeishuBotConfig(feishuConfig);
      setFeishuTestResult(result);
    } catch (error) {
      setFeishuError(error instanceof Error ? error.message : '测试飞书配置失败');
    } finally {
      setFeishuTesting(false);
    }
  };

  return {
    feishuConfig,
    feishuError,
    feishuFeedback,
    feishuLoading,
    feishuSaving,
    feishuTestResult,
    feishuTesting,
    handleSaveFeishuConfig,
    handleTestFeishuConfig,
    updateFeishuConfig,
  };
}
