import { defineConfig } from 'vite';
import aitDevtools from '@apps-in-toss/devtools/unplugin';

// devtools(mock SDK + 패널)는 개발 서버에서만 켜요. 배포 빌드에는 들어가지 않아요.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'serve' ? [aitDevtools.vite()] : [],
  build: { outDir: 'dist', target: 'es2020' },
  server: { host: true, port: 5173 },
}));
