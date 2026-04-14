import path from 'path';
import { fileURLToPath } from 'url';
import { syncSentimentCycleSnapshotsPy } from './syncSentimentCycleSnapshotsPy.js';

const __filename = fileURLToPath(import.meta.url);

export const syncSentimentCycleSnapshots = async () => {
  console.warn('[sentiment-cycle] fetchSentimentCycleSnapshots.js is now a compatibility shim. Delegating to Python collector.');
  await syncSentimentCycleSnapshotsPy();
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncSentimentCycleSnapshots().catch((error) => {
    console.error('[sentiment-cycle] failed:', error);
    process.exitCode = 1;
  });
}
