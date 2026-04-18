import type { RefObject } from 'react';
import { Link2, Tags, Trash2, Users } from 'lucide-react';

import Badge from '../ui/Badge';
import type { BigVReviewEntry } from './types';

type InfoGatheringBigVDetailProps = {
  bigVTagInput: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  formatAttachmentSize: (size: number) => string;
  onAddTag: () => void;
  onDeleteReview: () => void;
  onTagInputChange: (value: string) => void;
  selectedBigVReview: BigVReviewEntry | null;
  updateSelectedBigVReview: (updater: (entry: BigVReviewEntry) => BigVReviewEntry) => void;
};

const InfoGatheringBigVDetail = ({
  bigVTagInput,
  fileInputRef,
  formatAttachmentSize,
  onAddTag,
  onDeleteReview,
  onTagInputChange,
  selectedBigVReview,
  updateSelectedBigVReview,
}: InfoGatheringBigVDetailProps) => {
  if (!selectedBigVReview) {
    return <div className="h-full flex items-center justify-center text-slate-400">暂无大V复盘条目</div>;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <input
            value={selectedBigVReview.title}
            onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, title: e.target.value }))}
            placeholder="输入复盘标题，例如：某大V 3月27日午后复盘"
            className="w-full bg-transparent text-2xl font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
            <span>创建于 {new Date(selectedBigVReview.createdAt).toLocaleString('zh-CN')}</span>
            <span>更新于 {new Date(selectedBigVReview.updatedAt).toLocaleString('zh-CN')}</span>
            <Badge variant="outline">{selectedBigVReview.attachments.length} 个附件</Badge>
          </div>
        </div>
        <button
          onClick={onDeleteReview}
          className="px-3 py-2 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2"
        >
          <Trash2 size={14} /> 删除
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <Users size={12} /> 作者 / 大V
              </div>
              <input
                value={selectedBigVReview.author}
                onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, author: e.target.value }))}
                placeholder="例如：某财经博主、游资复盘号"
                className="w-full bg-transparent text-sm text-slate-700 dark:text-gray-200 outline-none"
              />
            </label>
            <label className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <Link2 size={12} /> 来源 / 链接备注
              </div>
              <input
                value={selectedBigVReview.source}
                onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, source: e.target.value }))}
                placeholder="例如：微博、公众号、群消息、语音转文字"
                className="w-full bg-transparent text-sm text-slate-700 dark:text-gray-200 outline-none"
              />
            </label>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Tags size={12} /> 标签
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={bigVTagInput}
                  onChange={(e) => onTagInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddTag();
                    }
                  }}
                  placeholder="输入标签后回车"
                  className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm outline-none"
                />
                <button
                  onClick={onAddTag}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm dark:bg-white dark:text-slate-900"
                >
                  添加
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedBigVReview.tags.length > 0 ? (
                selectedBigVReview.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      updateSelectedBigVReview((entry) => ({
                        ...entry,
                        tags: entry.tags.filter((item) => item !== tag),
                      }))
                    }
                    className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs dark:bg-cyan-500/10 dark:text-cyan-300"
                  >
                    {tag} ×
                  </button>
                ))
              ) : (
                <span className="text-sm text-slate-400">还没有标签，可按题材、情绪、风格分类。</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-gray-400">
              正文内容
            </div>
            <textarea
              value={selectedBigVReview.content}
              onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, content: e.target.value }))}
              placeholder="直接粘贴大V复盘文字，或者先点击左侧“导入”把 txt / md / csv 等文本文件灌进来。"
              className="w-full h-full min-h-[320px] resize-none bg-transparent px-4 py-4 text-sm leading-7 text-slate-700 dark:text-gray-200 outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 overflow-auto custom-scrollbar">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">导入附件</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs hover:bg-cyan-500 transition-colors"
            >
              继续导入
            </button>
          </div>
          <div className="space-y-3">
            {selectedBigVReview.attachments.length > 0 ? (
              selectedBigVReview.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 dark:text-gray-200 break-all">{attachment.name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {attachment.type || 'unknown'} · {formatAttachmentSize(attachment.size)}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSelectedBigVReview((entry) => ({
                          ...entry,
                          attachments: entry.attachments.filter((item) => item.id !== attachment.id),
                        }))
                      }
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {attachment.previewText && (
                    <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white dark:bg-slate-900 p-3 text-xs leading-6 text-slate-600 dark:text-gray-300 max-h-40 overflow-auto custom-scrollbar">
                      {attachment.previewText}
                    </pre>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-sm text-slate-400 text-center">
                还没有导入附件。
                <div className="mt-2 text-xs">文本文件会自动写入正文，图片/PDF 先记录文件信息，后续可以再接正式上传。</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoGatheringBigVDetail;
