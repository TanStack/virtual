// Regenerates the committed .d.marko files from the tag sources via
// @marko/type-check (mtc). Manual, on-demand: run `pnpm types:generate` after
// changing a tag's Input or return surface. CI never generates — it only
// VERIFIES (test:types) that the committed .d.marko still agree with the tags.
//
// Pipeline:
//   1. mtc checker must pass on the current sources (don't generate from
//      broken types).
//   2. Back up and delete the existing .d.marko (mtc prefers them as input when
//      present — leaving them would regenerate from the old files, not the
//      tags). The backups are restored automatically on any failure.
//   3. Emit via tsconfig.emit.json (output captured; only shown on failure).
//   4. Locate the emitted index.d.marko for each tag by searching the emit
//      directory (output layout depends on TypeScript's rootDir handling, so
//      search rather than hardcode), copy them back beside their sources, and
//      remove the emit directory.
//   5. mtc checker must pass again with the regenerated files in place.
import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const emitDir = join(pkgRoot, '.d-marko-emit')
const tags = ['virtualizer', 'window-virtualizer']
const dMarkoPath = (tag) => join(pkgRoot, 'src/tags', tag, 'index.d.marko')

const backupDir = mkdtempSync(join(tmpdir(), 'd-marko-backup-'))

const restoreBackups = () => {
  for (const tag of tags) {
    const backup = join(backupDir, `${tag}.d.marko`)
    if (existsSync(backup)) cpSync(backup, dMarkoPath(tag))
  }
}

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const fail = (message, emitOutput) => {
  console.error(`\n[types:generate] FAILED: ${message}`)
  if (existsSync(emitDir)) {
    const files = walk(emitDir).map((f) => `  ${relative(pkgRoot, f)}`)
    console.error(
      files.length
        ? `Emit directory contents:\n${files.join('\n')}`
        : 'Emit directory is EMPTY.',
    )
  } else {
    console.error('Emit directory was never created.')
  }
  if (emitOutput?.trim()) console.error(`\nEmit output:\n${emitOutput}`)
  console.error('\nThe previous .d.marko files have been restored.')
  restoreBackups()
  rmSync(emitDir, { recursive: true, force: true })
  rmSync(backupDir, { recursive: true, force: true })
  process.exit(1)
}

const run = (cmd) => execSync(cmd, { cwd: pkgRoot, stdio: 'inherit' })

const check = (label) => {
  console.log(`\n[types:generate] ${label}`)
  try {
    run('mtc -p tsconfig.typecheck.json')
  } catch {
    fail(`type check failed (${label}) — see output above.`)
  }
}

check('1/5 verifying current sources type-check')

console.log(
  '\n[types:generate] 2/5 backing up and removing existing .d.marko (mtc would prefer them as input)',
)
for (const tag of tags) {
  if (existsSync(dMarkoPath(tag))) {
    cpSync(dMarkoPath(tag), join(backupDir, `${tag}.d.marko`))
    rmSync(dMarkoPath(tag))
  }
}

console.log('\n[types:generate] 3/5 emitting')
rmSync(emitDir, { recursive: true, force: true })
let emitOutput = ''
try {
  // Captured, not streamed: benign config-shape complaints in emit mode read
  // like failures. Real problems are caught by the emitted-file search below
  // and the re-verification in step 5; the captured output is printed then.
  emitOutput = execSync('mtc -p tsconfig.emit.json', {
    cwd: pkgRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
} catch (err) {
  emitOutput = `${err.stdout ?? ''}${err.stderr ?? ''}`
}

console.log('\n[types:generate] 4/5 copying generated files back')
if (!existsSync(emitDir)) fail('nothing was emitted.', emitOutput)
const emittedFiles = walk(emitDir)
for (const tag of tags) {
  // The emitted path mirrors TypeScript's rootDir handling, which can differ
  // by environment — search for the file rather than hardcoding its depth.
  const suffix = join('tags', tag, 'index.d.marko')
  const emitted = emittedFiles.find((f) => f.endsWith(suffix))
  if (!emitted) fail(`no emitted index.d.marko for "${tag}".`, emitOutput)
  cpSync(emitted, dMarkoPath(tag))
  console.log(`  ${tag}/index.d.marko regenerated`)
}
rmSync(emitDir, { recursive: true, force: true })
rmSync(backupDir, { recursive: true, force: true })

check('5/5 verifying the regenerated files')
console.log('\n[types:generate] done — review the diff and commit.')
