const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const command = process.platform === 'win32' ? 'cmd.exe' : 'bash';
const args = process.platform === 'win32'
  ? ['/c', path.join(rootDir, 'stop_project.bat')]
  : [path.join(rootDir, 'stop_project.sh')];

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
  console.error('[stop-project] failed:', error);
  process.exit(1);
});
