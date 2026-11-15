import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the game at https://alicagriyildiz.github.io/sol-survivor/,
// so production builds (and `npm run preview`) use that sub-path. `npm run dev` serves from "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/sol-survivor/' : '/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
}));
