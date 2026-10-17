// Resolves the config in a process where `eslint-plugin-import` cannot be
// loaded. Pass `imports=false` to turn the import rules off.
import process from 'node:process'
import { plugin } from 'bun'

plugin({
  name: 'hide eslint-plugin-import',
  setup(build) {
    build.onLoad({ filter: /[\\/]eslint-plugin-import[\\/]lib[\\/]index\.js$/ }, () => {
      throw new Error('eslint-plugin-import is not installed')
    })
  },
})

async function main(): Promise<void> {
  // Imported after the plugin is registered, so the hook sees its loads.
  const { pleaseai } = await import('../../src/index')
  await pleaseai({ canonicalPluginNames: true, imports: process.argv[2] !== 'imports=false' })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
