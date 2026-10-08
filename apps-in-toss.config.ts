import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 앱인토스 콘솔에 등록한 앱 영문 이름과 똑같이 맞춰주세요 (딥링크 intoss://fishing-game)
  // 표시 이름(바다 찌낚시)·앱 아이콘·게임 유형은 SDK 3.x부터 콘솔에서 설정해요.
  appName: 'fishing-game',

  brand: {
    primaryColor: '#14596B'
  },

  permissions: [],
  webBundleDir: 'dist',

  // 게임 화면: 스크롤 튕김·당겨서 새로고침·스와이프 뒤로가기를 꺼서 조작 중 화면이 흔들리지 않게 해요
  webView: {
    allowsInlineMediaPlayback: true,
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false
  }
});
