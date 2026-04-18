import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'fetch_market_core_snapshots.py');

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });

export const syncMarketCorePy = async () => {
  const attempts = [
    { command: 'python', args: [SCRIPT_PATH] },
    { command: 'py', args: ['-3', SCRIPT_PATH] },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await runCommand(attempt.command, attempt.args);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('No Python runtime available');
};

if (process.argv[1] === __filename) {
  syncMarketCorePy().catch((error) => {
    console.error('[market-core-py-sync] failed:', error);
    process.exitCode = 1;
  });
}
