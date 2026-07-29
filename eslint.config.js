import js from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore SolarLog FTP-pushed data files — everything at the root except config files
  {
    ignores: [
      '*.js',        // root-level data files (base_vars.js, days.js, min*.js, etc.)
      'WR*/**',      // per-inverter data subdirectories pushed by the device
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
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
];
