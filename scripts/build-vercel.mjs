import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const outputDir = join(rootDir, 'dist')
const lucideSource = join(rootDir, 'node_modules', 'lucide', 'dist', 'umd', 'lucide.js')
const lucideTarget = join(outputDir, 'vendor', 'lucide.js')

await rm(outputDir, { recursive: true, force: true })
await cp(join(rootDir, 'public'), outputDir, { recursive: true })
await mkdir(dirname(lucideTarget), { recursive: true })
await copyFile(lucideSource, lucideTarget)

console.log('Vercel 静态资源已生成到 dist/')
