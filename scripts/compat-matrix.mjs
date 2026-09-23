import { mkdtemp, cp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const version = process.argv[2]
if (!/^0\.1\.(1|5|7)-rc\.[123]$/.test(version ?? '')) throw new Error('Supply a supported DSH version')
const root = await mkdtemp(join(tmpdir(), `dsh-compat-${version}-`))
for (const path of ['index.js', 'lib', 'test']) await cp(resolve(path), join(root, path), { recursive: true })
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const dependencies = Object.fromEntries(['agent', 'goal', 'session', 'settings', 'session-persistence-jsonl']
  .map(name => [`@deepseek-ai/dsh-${name}`, version]))
dependencies['@deepseek-ai/cordis'] = { '0.1.1-rc.2': '4.0.1', '0.1.5-rc.3': '4.0.2', '0.1.7-rc.1': '4.0.4' }[version]
dependencies['@deepseek-ai/schemastery'] = { '0.1.1-rc.2': '3.18.1', '0.1.5-rc.3': '3.18.2', '0.1.7-rc.1': '3.18.4' }[version]
if (version === '0.1.5-rc.3') {
  dependencies['@deepseek-ai/cordis-plugin-loader'] = '1.0.3'
  dependencies['@deepseek-ai/cordis-plugin-include'] = '1.0.7'
}
await writeFile(join(root, 'package.json'), JSON.stringify({
  name: manifest.name, version: manifest.version, private: true, type: 'module', dependencies,
}))
console.log(`Compatibility workspace: ${root}`)
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'])
run(process.execPath, ['--test'])
