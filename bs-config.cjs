const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = {
  server: {
    baseDir: 'web',
    middleware: [
      createProxyMiddleware({
        target: 'https://wolfsbach.synology.me',
        pathFilter: ['/data', '/hist', '/live'],
        changeOrigin: true,
      }),
    ],
  },
  files: ['web/index.html', 'web/css/**/*.css', 'web/js/**/*.js', 'web/i18n/**/*.json'],
  open: false,
};
