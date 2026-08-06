module.exports = {
  server: { baseDir: 'web', routes: { '/legacy-site': 'legacy-site' } },
  files: [
    'legacy-site/**/*.{html,css,js}',
    'web/index.html',
    'web/css/**/*.css',
    'web/js/**/*.js',
    'web/i18n/**/*.json',
  ],
  open: false,
};
