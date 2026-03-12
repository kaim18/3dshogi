import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/3dshogi/',
  resolve: {
    alias: { '@core': path.resolve(__dirname, 'src/core') },
  },
});
