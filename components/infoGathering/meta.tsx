import { FileText, FileImage, FileSpreadsheet, File as FileIcon, FileCode2, Presentation } from 'lucide-react';

import type { NewsItem, ResearchReportFile } from '../../types';

export const getReportFormatMeta = (report: Pick<ResearchReportFile, 'previewType' | 'extension'>) => {
  const normalizedExtension = report.extension.toLowerCase();
  if (report.previewType === 'pdf') {
    return {
      icon: FileText,
      label: 'PDF',
      iconClassName: 'text-rose-500',
      chipClassName: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    };
  }
  if (report.previewType === 'image') {
    return {
      icon: FileImage,
      label: '图片',
      iconClassName: 'text-emerald-500',
      chipClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  if (report.previewType === 'office') {
    if (normalizedExtension === 'doc' || normalizedExtension === 'docx') {
      return {
        icon: FileCode2,
        label: 'Word',
        iconClassName: 'text-blue-600',
        chipClassName: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
      };
    }
    if (normalizedExtension === 'xls' || normalizedExtension === 'xlsx') {
      return {
        icon: FileSpreadsheet,
        label: 'Excel',
        iconClassName: 'text-emerald-600',
        chipClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      };
    }
    if (normalizedExtension === 'ppt' || normalizedExtension === 'pptx') {
      return {
        icon: Presentation,
        label: 'PPT',
        iconClassName: 'text-orange-500',
        chipClassName: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
      };
    }
    return {
      icon: FileSpreadsheet,
      label: 'Office',
      iconClassName: 'text-sky-500',
      chipClassName: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    };
  }
  if (report.previewType === 'text') {
    return {
      icon: FileText,
      label: '文本',
      iconClassName: 'text-violet-500',
      chipClassName: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    };
  }
  return {
    icon: FileIcon,
    label: (report.extension || '文件').toUpperCase(),
    iconClassName: 'text-slate-500',
    chipClassName: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300',
  };
};

export const getSentimentBadgeMeta = (sentiment?: NewsItem['sentiment']) => {
  if (sentiment === 'bullish') {
    return { variant: 'red' as const, label: '利多' };
  }
  if (sentiment === 'bearish') {
    return { variant: 'green' as const, label: '利空' };
  }
  if (sentiment === 'neutral') {
    return { variant: 'default' as const, label: '中性' };
  }
  return null;
};
