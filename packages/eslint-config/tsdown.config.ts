import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/package-json.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  unbundle: true,
  // Pin the extensions to the `.mjs` / `.d.mts` paths in package.json
  // `exports`. tsdown's default changed from `.js` to `.mjs` around 0.21.5, so
  // a tsdown bump could otherwise ship entry points the `exports` map misses
  // (ERR_PACKAGE_PATH_NOT_EXPORTED).
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
  copy: [{ from: 'src/quality/vendor/LICENSE', to: 'dist/quality/vendor' }],
})
