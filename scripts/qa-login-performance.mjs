import { spawn, spawnSync } from 'child_process';

const isWindows = process.platform === 'win32';
const dev = spawn(isWindows ? 'npm.cmd run dev' : 'npm', isWindows ? [] : ['run', 'dev'], {
  cwd: process.cwd(),
  shell: isWindows,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
dev.stdout.on('data', (chunk) => { output += chunk.toString(); });
dev.stderr.on('data', (chunk) => { output += chunk.toString(); });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawnSync('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { process.kill(-pid, 'SIGTERM'); } catch {}
}

async function waitFor(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timeout aguardando ${url}\n\n${output}`);
}

async function timedLogin(username, password) {
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const elapsedMs = Math.round(performance.now() - start);
  let payload = {};
  try { payload = await response.json(); } catch {}
  return { status: response.status, elapsedMs, payload };
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:4000/api${pathname}`, options);
  if (!response.ok) throw new Error(`${pathname} falhou: HTTP ${response.status} ${await response.text()}`);
  return response;
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');

  const suffix = String(Date.now()).slice(-6);
  const name = `Usuario Login ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(name)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: `login.${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });

  const adminRuns = [];
  for (let index = 0; index < 5; index += 1) {
    adminRuns.push(await timedLogin('admin', '123456'));
  }
  const consultantLogin = await timedLogin(suggestion.username, '654321');
  const invalidPassword = await timedLogin('admin', '111111');
  const unknownUser = await timedLogin(`naoexiste${suffix}`, '123456');
  const multiClick = await Promise.all([
    timedLogin('admin', '123456'),
    timedLogin('admin', '123456'),
    timedLogin('admin', '123456')
  ]);
  const successful = [...adminRuns, consultantLogin, ...multiClick].filter((item) => item.status === 200);
  const averageMs = Math.round(successful.reduce((sum, item) => sum + item.elapsedMs, 0) / successful.length);
  const maxMs = Math.max(...successful.map((item) => item.elapsedMs));
  if (successful.some((item) => item.elapsedMs > 2000)) {
    throw new Error(`Login acima de 2s: ${JSON.stringify(successful)}`);
  }
  if (invalidPassword.status !== 401 || unknownUser.status !== 401) {
    throw new Error(`Falhas de login retornaram status inesperado: invalid=${invalidPassword.status}, unknown=${unknownUser.status}`);
  }

  console.log(JSON.stringify({
    ok: true,
    averageMs,
    maxMs,
    adminRuns,
    consultantLogin: { status: consultantLogin.status, elapsedMs: consultantLogin.elapsedMs, username: suggestion.username },
    invalidPassword: { status: invalidPassword.status, elapsedMs: invalidPassword.elapsedMs },
    unknownUser: { status: unknownUser.status, elapsedMs: unknownUser.elapsedMs },
    multiClick: multiClick.map((item) => ({ status: item.status, elapsedMs: item.elapsedMs }))
  }, null, 2));
} catch (error) {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
} finally {
  await stopTree(dev.pid);
  dev.stdout.destroy();
  dev.stderr.destroy();
  process.exit(process.exitCode || 0);
}
