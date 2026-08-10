import js from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore SolarLog FTP-pushed data files — everything at the root except config files
  {
    ignores: [
      '*.js',        // root-level data files (base_vars.js, days.js, min*.js, etc.)
      'WR*/**',      // per-inverter data subdirectories pushed by the device
      'web/data/**', // SolarLog device-pushed data files, new source since 2026-07-29
      'web/hist/**', // frozen historical SolarLog data, through 2026-07-28
      'web/vendor/**', // vendored third-party build (ApexCharts)
      'node_modules/**',
      '.specify/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
  },
  {
    files: ['web/js/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        getComputedStyle: 'readonly',
        localStorage: 'readonly',
        matchMedia: 'readonly',
        Date: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
];
