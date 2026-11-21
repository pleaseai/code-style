import path from 'node:path'
import process from 'node:process'
import { ESLint } from 'eslint'
import pleaseai from '../../src/index'

// eslint-import-resolver-typescript finds the tsconfig from `process.cwd()` and caches it for the process,
// so each mode lints in a child process whose working directory is the fixture project.
async function main(canonicalPluginNames: boolean, files: string[]): Promise<void> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: await pleaseai({ strict: true, canonicalPluginNames }),
  })
  const results = await eslint.lintFiles(files)
  const ruleIdsByFile = Object.fromEntries(results.map(result => [path.basename(result.filePath), result.messages.map(message => message.ruleId)]))
  process.stdout.write(JSON.stringify(ruleIdsByFile))
}

const [mode, ...files] = process.argv.slice(2)
main(mode === 'canonical', files).catch((error: unknown) => {
  process.stderr.write(String(error))
  process.exitCode = 1
})
