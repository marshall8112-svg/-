import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'fishing-game',            // 앱인토스 콘솔에 등록한 앱 영문 이름과 똑같이 맞춰주세요 (딥링크 intoss://fishing-game)
  brand: {
    displayName: '바다 찌낚시',
    primaryColor: '#14596B',
    icon: '',                          // 콘솔에 올린 앱 아이콘(600x600) 이미지 URL
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: { dev: 'vite --host', build: 'vite build' },
  },
  permissions: [],
  outdir: 'dist',
  webViewProps: { type: 'game' },      // 게임용 웹뷰
});
