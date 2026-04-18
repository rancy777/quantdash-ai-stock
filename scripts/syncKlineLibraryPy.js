import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PYTHON_SCRIPT = path.resolve(__dirname, 'fetch_kline_library.py');

const runPython = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
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

export const syncKlineLibraryPy = async () => {
  try {
    await runPython('python', [PYTHON_SCRIPT]);
  } catch (error) {
    console.warn('[kline-py-sync] python failed, trying py -3...', error.message);
    await runPython('py', ['-3', PYTHON_SCRIPT]);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncKlineLibraryPy().catch((error) => {
    console.error('[kline-py-sync] failed:', error);
    process.exitCode = 1;
  });
}
