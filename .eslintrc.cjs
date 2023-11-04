/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  extends: ['@remix-run/eslint-config', '@remix-run/eslint-config/node'],
  plugins: ['unicorn'],
  rules: {
    'unicorn/prefer-module': 'warn',
    'unicorn/prefer-node-protocol': 'warn',
  },
}

module.exports = config
