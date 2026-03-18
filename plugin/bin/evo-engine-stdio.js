#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function canRun(command, args) {
  try {
    const res = spawnSync(command, args, { stdio: 'ignore' });
    return res.status === 0;
  } catch (_) {
    return false;
  }
}

function pickPython() {
  const envPython = process.env.PYTHON;
  if (envPython && canRun(envPython, ['--version'])) {
    return { command: envPython, extraArgs: [] };
  }

  if (process.platform === 'win32') {
    if (canRun('python', ['--version'])) {
      return { command: 'python', extraArgs: [] };
    }
    if (canRun('py', ['-3', '--version'])) {
      return { command: 'py', extraArgs: ['-3'] };
    }
  } else {
    if (canRun('python3', ['--version'])) {
      return { command: 'python3', extraArgs: [] };
    }
    if (canRun('python', ['--version'])) {
      return { command: 'python', extraArgs: [] };
    }
  }

  return null;
}

const pluginRoot = path.resolve(__dirname, '..');
const serverPath = path.join(pluginRoot, 'evo-engine', 'server.py');

if (!fs.existsSync(serverPath)) {
  process.stderr.write(`evo-engine server not found: ${serverPath}\n`);
  process.exit(1);
}

const python = pickPython();
if (!python) {
  process.stderr.write('Python >= 3.11 not found in PATH.\n');
  process.exit(1);
}

const child = spawn(
  python.command,
  [...python.extraArgs, serverPath, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
