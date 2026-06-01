import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/package-json.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  unbundle: true,
  // Pin output extensions so the build always matches the `.mjs` / `.d.mts`
  // paths declared in package.json `exports`. tsdown's default ESM extension
  // for a `"type": "module"` package varies across versions (it emitted `.js`
  // up to ~0.21.5 and `.mjs` afterwards); without this, a tsdown bump silently
  // produces files the `exports` map doesn't point at, shipping a package whose
  // entry points 404 (ERR_PACKAGE_PATH_NOT_EXPORTED).
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
})
