import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  stdio: 'inherit',
  cwd: repoRoot,
  env: {
    ...process.env,
    VCANVAS_BASE: './',
    VCANVAS_DESKTOP: '1',
  },
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(result.signal ? 1 : 0)
