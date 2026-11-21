import process from 'node:process'
import { ESLint } from 'eslint'
import pleaseai from '../../src/index'

// eslint-import-resolver-typescript finds the tsconfig from `process.cwd()` and caches it for the process,
// so each lint runs in a child process whose working directory is the fixture project.
async function main(file: string, canonicalPluginNames: boolean): Promise<void> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: await pleaseai({ strict: true, canonicalPluginNames }),
  })
  const [result] = await eslint.lintFiles([file])
  process.stdout.write(JSON.stringify(result!.messages.map(message => message.ruleId)))
}

const [file, mode] = process.argv.slice(2)
main(file!, mode === 'canonical').catch((error: unknown) => {
  process.stderr.write(String(error))
  process.exitCode = 1
})
