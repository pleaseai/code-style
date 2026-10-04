import type { CheckResult } from './types.js'

/** Human-readable report, one line per finding (`file:line: warning[slug] message`). */
export function formatText(result: CheckResult): string {
  const lines = result.findings.map((f) => {
    const location = f.line == null ? f.file : `${f.file}:${f.line}`
    return `${location}: warning[${f.slug}] ${f.message}`
  })
  for (const notice of result.notices) {
    lines.push(`notice: ${notice}`)
  }
  const count = result.findings.length
  lines.push(count === 0 ? 'No code-organization findings.' : `${count} code-organization warning${count === 1 ? '' : 's'}.`)
  return `${lines.join('\n')}\n`
}
