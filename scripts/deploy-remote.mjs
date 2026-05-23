import { mkdtempSync, rmSync, cpSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, process.platform === 'win32' ? '' : '/')), '..')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = 'true'
      continue
    }
    args[key] = next
    i += 1
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const host = args.host || process.env.VCANVAS_DEPLOY_HOST
const user = args.user || process.env.VCANVAS_DEPLOY_USER || 'root'
const remoteRoot = args.remoteRoot || process.env.VCANVAS_DEPLOY_ROOT || '/opt/vcanvas'
const proxyPort = args.proxyPort || process.env.VCANVAS_PROXY_PORT || '8765'
const sshPassword = args.password || process.env.VCANVAS_DEPLOY_PASSWORD

if (!host) {
  console.error('Missing --host or VCANVAS_DEPLOY_HOST')
  process.exit(1)
}

if (!sshPassword) {
  console.error('Missing --password or VCANVAS_DEPLOY_PASSWORD')
  process.exit(1)
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function runWithInput(command, commandArgs, input, options = {}) {
  const result = spawnSync(command, commandArgs, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'vcanvas-deploy-'))
const payloadRoot = path.join(tmpRoot, 'payload')
const distTarget = path.join(payloadRoot, 'dist')
const scriptsTarget = path.join(payloadRoot, 'scripts')

try {
  run(process.execPath, [path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: repoRoot })

  mkdirSync(payloadRoot, { recursive: true })
  mkdirSync(scriptsTarget, { recursive: true })

  cpSync(path.join(repoRoot, 'dist'), distTarget, { recursive: true })
  cpSync(path.join(repoRoot, 'scripts', 'custom-openai-proxy.mjs'), path.join(scriptsTarget, 'custom-openai-proxy.mjs'), { recursive: false, force: true })
  cpSync(path.join(repoRoot, 'scripts', 'serve-vcanvas.mjs'), path.join(scriptsTarget, 'serve-vcanvas.mjs'), { recursive: false, force: true })

  const archiveBase = path.join(tmpRoot, 'vcanvas-payload')
  run(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-czf', `${archiveBase}.tar.gz`, '-C', payloadRoot, '.'])

  const archivePath = `${archiveBase}.tar.gz`
  const remoteArchive = '/root/vcanvas-payload.tar.gz'
  const remoteProxyService = '/etc/systemd/system/vcanvas-proxy.service'
  const remoteAppService = '/etc/systemd/system/vcanvas.service'
  const appServiceBody = `[Unit]\nDescription=VCanvas unified web server\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${remoteRoot}\nEnvironment=VCANVAS_HOST=0.0.0.0\nEnvironment=VCANVAS_PORT=18087\nEnvironment=VCANVAS_STATIC_DIR=${remoteRoot}/dist\nExecStart=/usr/bin/node ${remoteRoot}/scripts/serve-vcanvas.mjs\nRestart=always\nRestartSec=3\nUser=root\n\n[Install]\nWantedBy=multi-user.target\n`

  const pythonScript = `
import os
import paramiko

host = ${JSON.stringify(host)}
port = 22
username = ${JSON.stringify(user)}
password = ${JSON.stringify(sshPassword)}
local_file = ${JSON.stringify(archivePath.replace(/\\/g, '\\\\'))}
remote_file = ${JSON.stringify(remoteArchive)}

transport = paramiko.Transport((host, port))
transport.connect(username=username, password=password)
sftp = paramiko.SFTPClient.from_transport(transport)
sftp.put(local_file, remote_file)
sftp.close()
transport.close()
print(remote_file)
`
  runWithInput('python', ['-'], pythonScript)

  const remoteScript = `set -e
REMOTE_ROOT=${remoteRoot}
REMOTE_ARCHIVE=${remoteArchive}
PROXY_PORT=${proxyPort}
REMOTE_APP_SERVICE=${remoteAppService}
REMOTE_PROXY_SERVICE=${remoteProxyService}
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$REMOTE_ROOT/backups" "$REMOTE_ROOT/scripts"
if [ -d "$REMOTE_ROOT/dist" ]; then
  mv "$REMOTE_ROOT/dist" "$REMOTE_ROOT/backups/dist-$TS"
fi
mkdir -p "$REMOTE_ROOT/dist"
tar -xzf "$REMOTE_ARCHIVE" -C "$REMOTE_ROOT"
if [ -d "$REMOTE_ROOT/payload/dist" ]; then
  rm -rf "$REMOTE_ROOT/dist"
  mv "$REMOTE_ROOT/payload/dist" "$REMOTE_ROOT/dist"
fi
if [ -d "$REMOTE_ROOT/payload/scripts" ]; then
  mkdir -p "$REMOTE_ROOT/scripts"
  cp -f "$REMOTE_ROOT/payload/scripts/"* "$REMOTE_ROOT/scripts/"
fi
rm -rf "$REMOTE_ROOT/payload"
cat > "$REMOTE_APP_SERVICE" <<'EOF'
${appServiceBody}EOF
systemctl daemon-reload
if systemctl list-unit-files | grep -q '^vcanvas-proxy.service'; then
  systemctl disable --now vcanvas-proxy.service || true
fi
rm -f "$REMOTE_PROXY_SERVICE"
systemctl daemon-reload
systemctl enable --now vcanvas.service
systemctl restart vcanvas.service
sleep 2
systemctl is-active vcanvas.service
curl -s http://127.0.0.1:18087/health
`

  const remoteExecScript = `
import paramiko
import shlex
import sys

host = ${JSON.stringify(host)}
port = 22
username = ${JSON.stringify(user)}
password = ${JSON.stringify(sshPassword)}
remote_script = ${JSON.stringify(remoteScript)}

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=username, password=password, timeout=15)
stdin, stdout, stderr = client.exec_command(f"bash -lc {shlex.quote(remote_script)}", timeout=300)
sys.stdout.write(stdout.read().decode('utf-8', 'ignore'))
sys.stderr.write(stderr.read().decode('utf-8', 'ignore'))
exit_code = stdout.channel.recv_exit_status()
client.close()
sys.exit(exit_code)
`
  runWithInput('python', ['-'], remoteExecScript)
} finally {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}
