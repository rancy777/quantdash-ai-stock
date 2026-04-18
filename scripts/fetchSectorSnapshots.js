import path from 'path';
import { fileURLToPath } from 'url';
import { syncSectorSnapshotsPy } from './syncSectorSnapshotsPy.js';

const __filename = fileURLToPath(import.meta.url);

export const syncSectorSnapshots = async () => {
  console.warn('[sector] fetchSectorSnapshots.js is now a compatibility shim. Delegating to Python collector.');
  await syncSectorSnapshotsPy();
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncSectorSnapshots().catch((error) => {
    console.error('[sector] failed:', error);
    process.exitCode = 1;
  });
}
