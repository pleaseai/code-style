#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { runDoctor, runInit, runUpdate } from './commands.js'
import { detectLocale, setLocale, t } from './i18n.js'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    yes: { type: 'boolean', short: 'y' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
    lang: { type: 'string' },
  },
})

setLocale(detectLocale(typeof values.lang === 'string' ? values.lang : undefined))

if (values.help === true) {
  process.stdout.write(`${t('usage')}\n`)
  process.exit(0)
}

if (values.version === true) {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
  process.stdout.write(`${pkg.version}\n`)
  process.exit(0)
}

const command = positionals[0] ?? 'init'
const autoAccept = values.yes === true
const cwd = process.cwd()

try {
  switch (command) {
    case 'init':
      await runInit({ cwd, autoAccept })
      break
    case 'update':
      await runUpdate({ cwd, autoAccept })
      break
    case 'doctor':
      runDoctor({ cwd, autoAccept })
      break
    case 'help':
      process.stdout.write(`${t('usage')}\n`)
      break
    default:
      process.stderr.write(`${t('unknownCommand')(command)}\n\n${t('usage')}\n`)
      process.exit(1)
  }
}
catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
