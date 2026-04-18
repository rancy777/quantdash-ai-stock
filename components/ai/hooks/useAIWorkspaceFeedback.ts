import { useEffect, useState } from 'react';

import { copyPlainText, exportTextAsMarkdown } from '../../../services/aiOutputService';

type DocumentScope = 'AI 当日复盘' | 'AI 超短线深度分析' | '盘前计划' | '个股观察' | '次日校验';

export type DocumentActionFeedback = {
  scope: DocumentScope;
  message: string;
};

const useTimedFeedback = <T,>(value: T, onClear: () => void, delay: number) => {
  useEffect(() => {
    if (!value) return;
    const timer = window.setTimeout(onClear, delay);
    return () => window.clearTimeout(timer);
  }, [delay, onClear, value]);
};

export default function useAIWorkspaceFeedback() {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [planActionFeedback, setPlanActionFeedback] = useState('');
  const [documentActionFeedback, setDocumentActionFeedback] = useState<DocumentActionFeedback | null>(null);

  useTimedFeedback(copyFeedback, () => setCopyFeedback(''), 1800);
  useTimedFeedback(saveFeedback, () => setSaveFeedback(''), 1800);
  useTimedFeedback(planActionFeedback, () => setPlanActionFeedback(''), 2200);
  useTimedFeedback(documentActionFeedback, () => setDocumentActionFeedback(null), 2200);

  const copyToClipboard = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback(`${label} 已复制`);
    } catch (error) {
      console.warn(`Failed to copy ${label}`, error);
      setCopyFeedback(`复制 ${label} 失败`);
    }
  };

  const notifyDocumentSaved = (scope: DocumentScope) => {
    setDocumentActionFeedback({
      scope,
      message: '已保存当前 MD 内容',
    });
  };

  const handleCopyDocument = async (scope: DocumentScope, content: string) => {
    try {
      await copyPlainText(content);
      setDocumentActionFeedback({
        scope,
        message: `${scope} 复制成功`,
      });
    } catch (error) {
      console.warn(`Failed to copy ${scope}`, error);
      setDocumentActionFeedback({
        scope,
        message: `${scope} 复制失败`,
      });
    }
  };

  const handleExportMarkdown = (scope: DocumentScope, content: string, subtitle: string) => {
    try {
      exportTextAsMarkdown(scope, content, subtitle);
      setDocumentActionFeedback({
        scope,
        message: 'Markdown 文件已下载',
      });
    } catch (error) {
      console.warn(`Failed to export ${scope} as markdown`, error);
      setDocumentActionFeedback({
        scope,
        message: 'Markdown 下载失败',
      });
    }
  };

  return {
    copyFeedback,
    copyToClipboard,
    documentActionFeedback,
    handleCopyDocument,
    handleExportMarkdown,
    notifyDocumentSaved,
    planActionFeedback,
    saveFeedback,
    setPlanActionFeedback,
    setSaveFeedback,
  };
}
