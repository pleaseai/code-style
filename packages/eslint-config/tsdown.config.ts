import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/package-json.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  unbundle: true,
})
