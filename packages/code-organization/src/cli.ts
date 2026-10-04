#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { PACKAGE_ROOT } from './ast-grep.js'
import { checkCodeOrganization } from './check-code-organization.js'
import { formatText } from './format-text.js'

const USAGE = `Usage:
  please-code-org check [path] [options]

Checks file names, test locations, and shared test helpers against the
ADR-0022 code-organization standard (layer 3). Structural rules (layer 2) run
separately with \`ast-grep scan\`.

Options:
  --json             Print findings as JSON
  --strict           Exit 1 when there is any finding (default: warn only, exit 0)
  --config <file>    Config file (default: <path>/code-organization.json)
  --help, -h         Show this message
  --version, -v      Print version

Exit codes: 0 ok or warnings only, 1 findings with --strict, 2 usage or config error.
`

function main(argv: string[]): number {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean' },
        strict: { type: 'boolean' },
        config: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  }
  catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help === true) {
    process.stdout.write(USAGE)
    return 0
  }
  if (values.version === true) {
    const pkg = JSON.parse(readFileSync(`${PACKAGE_ROOT}/package.json`, 'utf-8')) as { version: string }
    process.stdout.write(`${pkg.version}\n`)
    return 0
  }
  const [command, path, ...rest] = positionals
  if (command !== 'check' || rest.length > 0) {
    process.stderr.write(command == null ? USAGE : `Unknown command: ${[command, path, ...rest].join(' ')}\n\n${USAGE}`)
    return 2
  }
  try {
    const result = checkCodeOrganization({ root: path, configPath: values.config })
    process.stdout.write(values.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatText(result))
    if (values.json === true) {
      for (const notice of result.notices) {
        process.stderr.write(`notice: ${notice}\n`)
      }
    }
    return values.strict === true && result.findings.length > 0 ? 1 : 0
  }
  catch (err) {
    process.stderr.write(`please-code-org: ${err instanceof Error ? err.message : String(err)}\n`)
    return 2
  }
}

process.exitCode = main(process.argv.slice(2))
