import type { Linter } from 'eslint'
import packageJson from 'eslint-plugin-package-json'

export const recommended: Linter.Config = packageJson.configs['recommended-publishable']
export const stylistic: Linter.Config = packageJson.configs.stylistic

export default recommended
