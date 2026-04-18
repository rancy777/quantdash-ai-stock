import { FolderOpen, Loader2 } from 'lucide-react';

import type { ResearchReportFile } from '../../types';

type InfoGatheringReportPreviewProps = {
  loadingReportPreview: boolean;
  selectedReport: ResearchReportFile | null;
  selectedReportText: string | null;
};

const InfoGatheringReportPreview = ({
  loadingReportPreview,
  selectedReport,
  selectedReportText,
}: InfoGatheringReportPreviewProps) => {
  if (!selectedReport) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        暂无研报文件
      </div>
    );
  }

  if (selectedReport.pdfLocalUrl) {
    return <iframe src={selectedReport.pdfLocalUrl} title={selectedReport.name} className="w-full h-full rounded-xl bg-white" />;
  }

  if (selectedReport.previewType === 'pdf') {
    return <iframe src={selectedReport.url} title={selectedReport.name} className="w-full h-full rounded-xl bg-white" />;
  }

  if (selectedReport.previewType === 'image') {
    return (
      <div className="h-full overflow-auto custom-scrollbar">
        <img src={selectedReport.url} alt={selectedReport.name} className="max-w-full rounded-xl mx-auto" />
      </div>
    );
  }

  if (selectedReport.previewType === 'text') {
    if (loadingReportPreview) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="animate-spin" /> 正在加载研报内容...
        </div>
      );
    }
    return (
      <pre className="h-full overflow-auto custom-scrollbar whitespace-pre-wrap break-words rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-sm leading-7 text-slate-700 dark:text-gray-300">
        {selectedReportText ?? '文件为空或无法读取文本内容'}
      </pre>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-gray-400 gap-4">
      <FolderOpen size={40} className="opacity-40" />
      <div>
        <div className="font-semibold text-slate-700 dark:text-gray-200">该格式暂不支持内嵌预览</div>
        <div className="text-sm mt-1">当前文件类型: .{selectedReport.extension}</div>
      </div>
      <a
        href={selectedReport.url}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors"
      >
        打开文件
      </a>
    </div>
  );
};

export default InfoGatheringReportPreview;
