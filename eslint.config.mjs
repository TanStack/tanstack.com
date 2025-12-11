import js from '@eslint/js'
import * as tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ignores = [
  'node_modules',
  'dist',
  'build',
  '.content-collections',
  '.tanstack-start',
  '.netlify',
  'public',
  'convex/.temp',
]

export default [
  { ignores },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '(^_)|(^__+$)|(^e$)|(^error$)',
          varsIgnorePattern: '(^_)|(^__+$)|(^e$)|(^error$)',
          caughtErrorsIgnorePattern: '(^_)|(^__+$)|(^e$)|(^error$)',
        },
      ],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
    },
  },
]
