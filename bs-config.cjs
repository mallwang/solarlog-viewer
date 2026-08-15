const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = {
  server: {
    baseDir: 'web',
    routes: { '/legacy-site': 'legacy-site' },
    middleware: [
      createProxyMiddleware({
        target: 'https://wolfsbach.synology.me',
        pathFilter: ['/data', '/hist'],
        changeOrigin: true,
      }),
    ],
  },
  files: [
    'legacy-site/**/*.{html,css,js}',
    'web/index.html',
    'web/css/**/*.css',
    'web/js/**/*.js',
    'web/i18n/**/*.json',
  ],
  open: false,
};
