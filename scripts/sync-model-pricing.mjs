import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchRemotePricingCatalog,
  snapshotFromCatalog
} from '../src/lib/pricing-catalog.mjs'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const snapshotPath = join(rootDir, 'data', 'model-pricing.snapshot.json')
const catalog = await fetchRemotePricingCatalog({ timeoutMs: 30_000 })
const snapshot = snapshotFromCatalog(catalog)
const previous = await readFile(snapshotPath, 'utf8').then(JSON.parse).catch(() => null)

if (previous?.source?.sha256 === snapshot.source.sha256) {
  console.log(`价格快照已是最新：${snapshot.source.sha256.slice(0, 8)}`)
  process.exit(0)
}

await mkdir(dirname(snapshotPath), { recursive: true })
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
console.log(`价格快照已更新：${snapshot.source.sha256.slice(0, 8)}`)
