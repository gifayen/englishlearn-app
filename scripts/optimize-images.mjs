// scripts/optimize-images.mjs
import fg from 'fast-glob'
import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'

const ROOT = process.cwd()
const INPUT_GLOB = 'public/pics-reader/**/*.{png,jpg,jpeg}'
const WIDTHS = [800, 1200, 1600]

function outName(fp, w) {
  const ext = path.extname(fp) // .png
  const base = fp.slice(0, -ext.length) // .../dialog-01
  return `${base}-w${w}.webp`
}

async function needBuild(src, out) {
  try {
    const [si, so] = await Promise.all([fs.stat(src), fs.stat(out)])
    // 若 output 比 input 新，略過
    return so.mtimeMs < si.mtimeMs
  } catch {
    // 沒有 output → 需要
    return true
  }
}

async function run() {
  const files = await fg(INPUT_GLOB, { cwd: ROOT, absolute: true })
  if (!files.length) {
    console.log('No input images found.')
    return
  }
  console.log(`Found ${files.length} source images.`)

  let built = 0
  for (const fp of files) {
    for (const w of WIDTHS) {
      const out = outName(fp, w)
      if (!(await needBuild(fp, out))) continue
      await sharp(fp).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out)
      built++
      console.log('✓', path.relative(ROOT, out))
    }
  }
  console.log(built ? `Done. Generated ${built} files.` : 'All up to date.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
