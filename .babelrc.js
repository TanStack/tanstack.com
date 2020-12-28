module.exports = {
  presets: [['next/babel', { 'preset-react': { runtime: 'automatic' } }]],
  plugins: [
    'babel-plugin-macros',
    '@babel/plugin-transform-react-jsx',
    ['styled-components', { ssr: true }],
  ],
}
