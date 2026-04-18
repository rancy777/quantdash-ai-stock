import type { NewsItem } from '../../types';

export type InfoGatheringTabId = 'all' | 'notice' | 'news' | 'report' | 'expert' | 'review';
export type ReportFormat = 'all' | 'pdf' | 'image' | 'text' | 'office' | 'other';
export type ReportSort = 'updated_desc' | 'updated_asc' | 'name_asc';
export type ReportDateRange = 'all' | '7d' | '30d' | '90d';
export type ReportSourceOption = { id: string; label: string; count: number };

export type BigVAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  previewText?: string;
};

export type BigVReviewEntry = {
  id: string;
  title: string;
  author: string;
  source: string;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
  attachments: BigVAttachment[];
};

export type NewsSourceGroup = {
  id: 'cls' | 'external';
  title: string;
  description: string;
  items: NewsItem[];
};
