import type { ChangeEvent, RefObject } from 'react';
import { Calendar, Plus, Upload } from 'lucide-react';

import Badge from '../ui/Badge';
import type { BigVReviewEntry } from './types';

type InfoGatheringBigVSidebarProps = {
  bigVReviews: BigVReviewEntry[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCreateReview: () => void;
  onImportFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetReviews: () => void;
  onSelectReview: (reviewId: string) => void;
  selectedBigVReviewId: string | null;
};

const InfoGatheringBigVSidebar = ({
  bigVReviews,
  fileInputRef,
  onCreateReview,
  onImportFiles,
  onResetReviews,
  onSelectReview,
  selectedBigVReviewId,
}: InfoGatheringBigVSidebarProps) => {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateReview}
            className="flex-1 px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> 新建复盘
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Upload size={14} /> 导入
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>支持粘贴内容，文本文件会自动导入正文</span>
          <button
            onClick={onResetReviews}
            className="hover:text-rose-500 transition-colors"
          >
            重置本地
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onImportFiles}
          className="hidden"
        />
      </div>
      <div className="overflow-y-auto p-4 space-y-3 h-full custom-scrollbar">
        {bigVReviews.map((entry) => (
          <div
            key={entry.id}
            onClick={() => onSelectReview(entry.id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedBigVReviewId === entry.id
                ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md'
                : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex justify-between items-start gap-3 mb-2">
              <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                <Calendar size={10} /> {new Date(entry.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge variant="outline">{entry.attachments.length} 附件</Badge>
            </div>
            <h4 className={`text-sm font-medium leading-relaxed ${selectedBigVReviewId === entry.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
              {entry.title || '未命名复盘'}
            </h4>
            <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between gap-2">
              <span>{entry.author || '未填写作者'}</span>
              <span>{entry.tags.length > 0 ? entry.tags.join(' / ') : '无标签'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfoGatheringBigVSidebar;
