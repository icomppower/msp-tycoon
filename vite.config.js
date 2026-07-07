import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3010,
    open: true,
  },
  build: {
    target: 'es2020',
  },
});
