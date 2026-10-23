#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { runCheck } from './check/run-check.js'
import { runDoctor, runInit, runUpdate } from './commands.js'
import { resolveLocaleFlags, setLocale, t } from './i18n.js'
import { parseLangFlag } from './languages.js'

const GLOBAL_OPTIONS = {
  yes: { type: 'boolean', short: 'y' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  locale: { type: 'string' },
  lang: { type: 'string' },
} as const

const argv = process.argv.slice(2)
const { values: allValues, positionals, tokens } = parseArgs({
  args: argv,
  allowPositionals: true,
  strict: false,
  tokens: true,
  options: GLOBAL_OPTIONS,
})

const localeFlags = resolveLocaleFlags({ locale: allValues.locale, lang: allValues.lang })
setLocale(localeFlags.locale)
if (localeFlags.kind === 'invalid') {
  process.stderr.write(`${t('invalidLocaleFlag')(localeFlags.value)}\n`)
  process.exit(1)
}
else if (localeFlags.langWarning !== undefined) {
  const { kind, locale } = localeFlags.langWarning
  process.stderr.write(`${t(kind === 'deprecated' ? 'deprecatedLangFlag' : 'ignoredLangFlag')(locale)}\n`)
}

const langFlag = parseLangFlag(allValues.lang)
if (langFlag.kind === 'invalid') {
  process.stderr.write(`${t('invalidLangFlag')(langFlag.value)}\n`)
  process.exit(1)
}
const languages = langFlag.kind === 'languages' ? langFlag.languages : undefined

const command = positionals[0] ?? 'init'
// `check` parses its own flags strictly, so only what precedes it is global
// (`please-style check -h` shows the check usage, not the global one).
const commandIndex = tokens.find(token => token.kind === 'positional')?.index ?? argv.length
const values = command === 'check'
  ? parseArgs({ args: argv.slice(0, commandIndex), strict: false, options: GLOBAL_OPTIONS }).values
  : allValues

// A check option before `check` (`please-style --strict check`) would be dropped silently; reject it.
const misplaced = command === 'check'
  ? tokens.find(token => token.kind === 'option' && token.index < commandIndex && !Object.hasOwn(GLOBAL_OPTIONS, token.name))
  : undefined
if (misplaced?.kind === 'option') {
  process.stderr.write(`${t('optionBeforeCheck')(misplaced.rawName)}\n\n${t('checkUsage')}`)
  process.exit(2)
}

function readVersion(): string {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
  return pkg.version
}

if (values.help === true) {
  process.stdout.write(`${t('usage')}\n`)
  process.exit(0)
}

if (values.version === true) {
  process.stdout.write(`${readVersion()}\n`)
  process.exit(0)
}

const autoAccept = values.yes === true
const cwd = process.cwd()

try {
  switch (command) {
    case 'init':
      await runInit({ cwd, autoAccept, languages })
      break
    case 'update':
      await runUpdate({ cwd, autoAccept, languages })
      break
    case 'doctor':
      runDoctor({ cwd, autoAccept, languages })
      break
    case 'check':
      // exitCode, not exit(): a large --json report must flush before exiting.
      process.exitCode = runCheck(argv.slice(commandIndex + 1), readVersion)
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
