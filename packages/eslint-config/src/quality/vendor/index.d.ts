import type { Plugin } from '@oxlint/plugins'
import type { ESLint } from 'eslint'

/**
 * The rules ship only Oxlint's `createOnce`. `../index.ts` passes this object
 * to `eslintCompatPlugin()`, which adds the `create` method ESLint calls, in
 * place, before ESLint sees it.
 */
declare const plugin: Plugin & ESLint.Plugin
export default plugin
