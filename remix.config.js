/**
 * @type {import('@remix-run/dev/config').AppConfig}
 */
module.exports = {
  appDirectory: 'app',
  browserBuildDirectory: 'public/build',
  publicPath: '/build/',
  serverBuildDirectory: 'api/_build',
  devServerPort: 8002,
  serverDependenciesToBundle: [
    /^rehype.*/,
    /^remark.*/,
    /^unified.*/,
    // '@sindresorhus/slugify',
  ],
}
