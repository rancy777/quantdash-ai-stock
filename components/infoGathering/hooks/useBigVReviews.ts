import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { BigVAttachment, BigVReviewEntry } from '../types';

const BIG_V_REVIEWS_STORAGE_KEY = 'quantdash:big-v-reviews';

const createEmptyBigVReview = (): BigVReviewEntry => {
  const now = new Date().toISOString();
  return {
    id: `bigv-${now}`,
    title: '未命名复盘',
    author: '',
    source: '',
    tags: [],
    content: '',
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
};

export default function useBigVReviews() {
  const [bigVReviews, setBigVReviews] = useState<BigVReviewEntry[]>([]);
  const [selectedBigVReviewId, setSelectedBigVReviewId] = useState<string | null>(null);
  const [bigVTagInput, setBigVTagInput] = useState('');

  useEffect(() => {
    const raw = window.localStorage.getItem(BIG_V_REVIEWS_STORAGE_KEY);
    if (!raw) {
      const initial = createEmptyBigVReview();
      setBigVReviews([initial]);
      setSelectedBigVReviewId(initial.id);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as BigVReviewEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setBigVReviews(parsed);
        setSelectedBigVReviewId(parsed[0].id);
        return;
      }
    } catch (error) {
      console.warn('Failed to parse big-v reviews from localStorage', error);
    }

    const fallback = createEmptyBigVReview();
    setBigVReviews([fallback]);
    setSelectedBigVReviewId(fallback.id);
  }, []);

  useEffect(() => {
    if (bigVReviews.length === 0) return;
    window.localStorage.setItem(BIG_V_REVIEWS_STORAGE_KEY, JSON.stringify(bigVReviews));
  }, [bigVReviews]);

  const selectedBigVReview = useMemo(
    () => bigVReviews.find((item) => item.id === selectedBigVReviewId) ?? null,
    [bigVReviews, selectedBigVReviewId],
  );

  const updateSelectedBigVReview = (updater: (entry: BigVReviewEntry) => BigVReviewEntry) => {
    if (!selectedBigVReviewId) return;
    setBigVReviews((prev) =>
      prev.map((entry) =>
        entry.id === selectedBigVReviewId
          ? updater({
              ...entry,
              updatedAt: new Date().toISOString(),
            })
          : entry,
      ),
    );
  };

  const handleCreateBigVReview = () => {
    const next = createEmptyBigVReview();
    setBigVReviews((prev) => [next, ...prev]);
    setSelectedBigVReviewId(next.id);
    setBigVTagInput('');
  };

  const handleDeleteBigVReview = () => {
    if (!selectedBigVReviewId) return;
    const remaining = bigVReviews.filter((item) => item.id !== selectedBigVReviewId);
    if (remaining.length === 0) {
      const fallback = createEmptyBigVReview();
      setBigVReviews([fallback]);
      setSelectedBigVReviewId(fallback.id);
      setBigVTagInput('');
      return;
    }
    setBigVReviews(remaining);
    setSelectedBigVReviewId(remaining[0].id);
    setBigVTagInput('');
  };

  const handleImportBigVFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files ?? []);
    if (files.length === 0 || !selectedBigVReviewId) return;

    const nextAttachments = await Promise.all(
      files.map(async (file) => {
        const isTextLike =
          file.type.startsWith('text/') ||
          /\.(txt|md|markdown|json|csv|log)$/i.test(file.name);

        let previewText: string | undefined;
        if (isTextLike) {
          try {
            previewText = (await file.text()).slice(0, 2000);
          } catch (error) {
            console.warn('Failed to read uploaded file', file.name, error);
          }
        }

        return {
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          previewText,
        } satisfies BigVAttachment;
      }),
    );

    updateSelectedBigVReview((entry) => {
      const mergedContent = nextAttachments
        .filter((item) => item.previewText)
        .map((item) => `\n\n[导入文件] ${item.name}\n${item.previewText}`)
        .join('');

      return {
        ...entry,
        content: `${entry.content}${mergedContent}`.trim(),
        attachments: [...nextAttachments, ...entry.attachments],
      };
    });

    event.target.value = '';
  };

  const handleResetBigVReviews = () => {
    const fallback = createEmptyBigVReview();
    setBigVReviews([fallback]);
    setSelectedBigVReviewId(fallback.id);
    setBigVTagInput('');
    window.localStorage.setItem(BIG_V_REVIEWS_STORAGE_KEY, JSON.stringify([fallback]));
  };

  const handleAddBigVTag = () => {
    const nextTag = bigVTagInput.trim();
    if (!nextTag || !selectedBigVReview) return;
    if (selectedBigVReview.tags.includes(nextTag)) {
      setBigVTagInput('');
      return;
    }
    updateSelectedBigVReview((entry) => ({
      ...entry,
      tags: [...entry.tags, nextTag],
    }));
    setBigVTagInput('');
  };

  const formatAttachmentSize = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  };

  const selectBigVReview = (reviewId: string) => {
    setSelectedBigVReviewId(reviewId);
    setBigVTagInput('');
  };

  return {
    bigVReviews,
    bigVTagInput,
    formatAttachmentSize,
    handleAddBigVTag,
    handleCreateBigVReview,
    handleDeleteBigVReview,
    handleImportBigVFiles,
    handleResetBigVReviews,
    selectBigVReview,
    selectedBigVReview,
    selectedBigVReviewId,
    setBigVTagInput,
    updateSelectedBigVReview,
  };
}
