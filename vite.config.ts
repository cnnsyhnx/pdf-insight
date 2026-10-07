import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from https://<user>.github.io/<repo>/, so every asset URL needs the repo prefix.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      // Added after minification, so the deployed code still says whose it is.
      output: {
        postBanner:
          '/*! PDF Insight. Copyright (c) 2026 Can Seyhan (Jan). All rights reserved. See LICENSE. */',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
