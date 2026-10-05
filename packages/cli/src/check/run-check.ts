import process from 'node:process'
import { parseArgs } from 'node:util'
import { t } from '../i18n.js'
import { checkCodeOrganization } from './check-code-organization.js'
import { formatText } from './format-text.js'

/**
 * `please-style check [path] [--json] [--strict] [--config <file>]`. Takes the
 * arguments after `check` and returns the exit code: 0 ok or warnings only,
 * 1 findings with `--strict`, 2 usage or config error or an unresolvable dependency.
 */
export function runCheck(argv: string[], version: () => string): number {
  const usage = t('checkUsage')
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
        // Global option, already applied by the entry point.
        lang: { type: 'string' },
      },
    })
  }
  catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${usage}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help === true) {
    process.stdout.write(usage)
    return 0
  }
  if (values.version === true) {
    process.stdout.write(`${version()}\n`)
    return 0
  }
  const [path, ...rest] = positionals
  if (rest.length > 0) {
    process.stderr.write(`${t('unexpectedArguments')(rest.join(' '))}\n\n${usage}`)
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
    process.stderr.write(`please-style check: ${err instanceof Error ? err.message : String(err)}\n`)
    return 2
  }
}
