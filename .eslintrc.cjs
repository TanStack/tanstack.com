/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  extends: ['@remix-run/eslint-config', '@remix-run/eslint-config/node'],
  plugins: ['unicorn'],
  rules: {
    'unicorn/prefer-module': ['error'],
    'unicorn/prefer-node-protocol': ['error'],
  },
}

module.exports = config
