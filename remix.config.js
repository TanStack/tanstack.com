/**
 * @type {import('@remix-run/dev/config').AppConfig}
 */
module.exports = {
  // appDirectory: 'app',
  // browserBuildDirectory: 'public/build',
  // publicPath: '/build/',
  // serverBuildDirectory: '.vercel/output/functions/index.func/_build',
  devServerPort: 8002,
  serverDependenciesToBundle: [
    // /^rehype.*/,
    // /^remark.*/,
    // /^unified.*/,
    // '@sindresorhus/slugify',
  ],
}
