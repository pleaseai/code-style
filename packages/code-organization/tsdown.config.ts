import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  target: 'node22',
  platform: 'node',
  // Keep one dist file per source module so `import.meta.url` in
  // `ast-grep.ts` resolves `extract/` the same way from `src/` and `dist/`.
  unbundle: true,
  // Pin output extensions so the build always matches the `.mjs` / `.d.mts`
  // paths declared in package.json `exports` and `bin` (see eslint-config).
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
})
