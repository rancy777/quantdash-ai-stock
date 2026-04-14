import { ResearchReportFile } from '../types';

const DB_NAME = 'quantdash-research-reports';
const STORE_NAME = 'uploaded-reports';
const DB_VERSION = 1;

type StoredUploadedResearchReport = ResearchReportFile & {
  dataUrl: string;
  textContent: string | null;
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log']);
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

const isBrowserReady = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const inferPreviewType = (extension: string): ResearchReportFile['previewType'] => {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  if (normalized === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(normalized)) return 'image';
  if (TEXT_EXTENSIONS.has(normalized)) return 'text';
  if (OFFICE_EXTENSIONS.has(normalized)) return 'office';
  return 'other';
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open report upload database'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    executor(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error ?? new Error('Research report upload transaction failed'));
    transaction.oncomplete = () => db.close();
  });
};

export const listUploadedResearchReports = async (): Promise<ResearchReportFile[]> => {
  if (!isBrowserReady()) return [];
  const rows = await withStore<StoredUploadedResearchReport[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredUploadedResearchReport[]) ?? []);
  });

  return rows
    .map<ResearchReportFile>(({ dataUrl: _dataUrl, textContent: _textContent, ...item }) => item)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

export const loadUploadedResearchReportText = async (reportId: string): Promise<string | null> => {
  if (!isBrowserReady()) return null;
  const row = await withStore<StoredUploadedResearchReport | null>('readonly', (store, resolve, reject) => {
    const request = store.get(reportId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredUploadedResearchReport | undefined) ?? null);
  });
  return row?.textContent ?? null;
};

export const saveUploadedResearchReportFiles = async (files: File[]): Promise<ResearchReportFile[]> => {
  if (!isBrowserReady() || files.length === 0) return [];

  const records = await Promise.all(
    files.map(async (file) => {
      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? 'unknown' : 'unknown';
      const previewType = inferPreviewType(extension);
      const updatedAt = new Date().toISOString();

      const record: StoredUploadedResearchReport = {
        id: `upload:${file.name}:${file.lastModified}:${file.size}`,
        name: file.name,
        title: file.name.replace(/\.[^.]+$/, ''),
        relativePath: `手动上传/${file.name}`,
        url: await readFileAsDataUrl(file),
        originUrl: undefined,
        pdfUrl: undefined,
        pdfLocalUrl: undefined,
        pdfLocalPath: undefined,
        extension,
        size: file.size,
        sizeLabel: formatBytes(file.size),
        updatedAt,
        publishedAt: updatedAt,
        previewType,
        sourceType: 'upload',
        sourceLabel: '手动上传',
        sourceKey: 'manual-upload',
        category: 'manual-upload',
        reportKind: 'upload',
        stockCode: undefined,
        stockName: undefined,
        orgName: undefined,
        rating: undefined,
        researcher: undefined,
        industryName: undefined,
        tags: ['手动上传'],
        summary: `用户手动上传的${previewType === 'pdf' ? 'PDF' : previewType === 'image' ? '图片' : previewType === 'text' ? '文本' : '文件'}研报`,
        dataUrl: '',
        textContent: previewType === 'text' ? await file.text() : null,
      };

      record.dataUrl = record.url;
      return record;
    }),
  );

  await withStore<void>('readwrite', (store, resolve, reject) => {
    if (records.length === 0) {
      resolve();
      return;
    }
    let pending = records.length;
    for (const item of records) {
      const request = store.put(item);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        pending -= 1;
        if (pending === 0) resolve();
      };
    }
  });

  return records.map<ResearchReportFile>(({ dataUrl: _dataUrl, textContent: _textContent, ...item }) => item);
};

export const removeUploadedResearchReport = async (reportId: string): Promise<void> => {
  if (!isBrowserReady()) return;
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(reportId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
