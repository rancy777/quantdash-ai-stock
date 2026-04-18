import path from 'path';
import { fileURLToPath } from 'url';
import { syncStockSnapshotsPy } from './syncStockSnapshotsPy.js';

const __filename = fileURLToPath(import.meta.url);

export const syncStockSnapshots = async () => {
  console.warn('[stocks] fetchStockSnapshots.js is now a compatibility shim. Delegating to Python collector.');
  await syncStockSnapshotsPy();
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncStockSnapshots().catch((error) => {
    console.error('[stocks] failed:', error);
    process.exitCode = 1;
  });
}
