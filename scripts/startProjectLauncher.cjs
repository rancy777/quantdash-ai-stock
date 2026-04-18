const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const command = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const args = process.platform === 'win32'
  ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(rootDir, 'start_project.ps1')]
  : [path.join(rootDir, 'start_project.sh')];

const child = spawn(command, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('[start-project] failed:', error);
  process.exit(1);
});
