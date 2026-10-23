/**
 * Rules that eslint-config configures under one name and `bun lint` runs
 * natively under another: source id -> native target id.
 */
export const RULE_MAP: Record<string, string> = {
  'test/consistent-test-it': 'vitest/consistent-test-it',
  'test/no-identical-title': 'vitest/no-identical-title',
  'test/no-import-node-test': 'vitest/no-import-node-test',
  'test/no-only-tests': 'vitest/no-focused-tests',
  'test/prefer-hooks-in-order': 'vitest/prefer-hooks-in-order',
  'test/prefer-lowercase-title': 'vitest/prefer-lowercase-title',

  'unused-imports/no-unused-vars': '@typescript-eslint/no-unused-vars',

  'style/jsx-closing-bracket-location': 'react/jsx-closing-bracket-location',
  'style/jsx-closing-tag-location': 'react/jsx-closing-tag-location',
  'style/jsx-curly-brace-presence': 'react/jsx-curly-brace-presence',
  'style/jsx-curly-newline': 'react/jsx-curly-newline',
  'style/jsx-curly-spacing': 'react/jsx-curly-spacing',
  'style/jsx-equals-spacing': 'react/jsx-equals-spacing',
  'style/jsx-first-prop-new-line': 'react/jsx-first-prop-new-line',
  'style/jsx-indent-props': 'react/jsx-indent-props',
  'style/jsx-max-props-per-line': 'react/jsx-max-props-per-line',
  'style/jsx-one-expression-per-line': 'react/jsx-one-expression-per-line',
  'style/jsx-tag-spacing': 'react/jsx-tag-spacing',

  'antfu/no-top-level-await': 'n/no-top-level-await',

  'e18e/prefer-array-some': 'unicorn/prefer-array-some',
  'e18e/prefer-date-now': 'unicorn/prefer-date-now',
  'e18e/prefer-regex-test': 'unicorn/prefer-regexp-test',
  'e18e/prefer-object-has-own': 'prefer-object-has-own',
}
