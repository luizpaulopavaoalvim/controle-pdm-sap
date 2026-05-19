import { spawn, spawnSync } from 'child_process';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'npm.cmd run dev' : 'npm';
const args = isWindows ? [] : ['run', 'dev'];
const dev = spawn(command, args, {
  cwd: process.cwd(),
  shell: isWindows,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
dev.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
dev.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // server not ready yet
    }
    await delay(750);
  }
  throw new Error(`Timeout aguardando ${url}\n\n${output}`);
}

async function login(username, password) {
  const response = await fetch('http://127.0.0.1:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) {
    throw new Error(`Login falhou para ${username}: HTTP ${response.status}\n\n${output}`);
  }
  const data = await response.json();
  if (!data.user?.username || !data.user?.role) {
    throw new Error(`Login sem usuario valido para ${username}`);
  }
  return data.user;
}

async function stopTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawnSync('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // already stopped
  }
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');

  const users = [
    await login('admin', '123456')
  ];

  console.log(JSON.stringify({
    ok: true,
    backend: 'http://127.0.0.1:4000',
    frontend: 'http://127.0.0.1:5173',
    users: users.map((user) => ({ username: user.username, role: user.role }))
  }, null, 2));
  await stopTree(dev.pid);
  process.exit(0);
} catch (error) {
  await stopTree(dev.pid);
  console.error(error);
  process.exit(1);
} finally {
  dev.stdout.destroy();
  dev.stderr.destroy();
}
