/* 앱인토스 연결부: 폰트 · 저장소 · 방향 · 리워드 광고 → window.AIT 로 게임에 연결해요.
   SDK 함수 이름은 앱인토스 문서 기준이에요. 달라졌다면 아래 한 파일만 고치면 돼요. */
import '@fontsource/jua/400.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/900.css';
import * as SDK from '@apps-in-toss/web-framework';

const S: any = SDK;
const TEST_AD = 'ait-ad-test-rewarded-id';
const AD_GROUP = (import.meta as any).env?.VITE_AD_GROUP_ID || TEST_AD;
const KEYS = ['jjinaksi.v1', 'jjinaksi.rw', 'jjinaksi.q', 'jjinaksi.bgm', 'jjinaksi.mute', 'jjinaksi.stats'];

/* 1) 가로 화면 */
try {
  const setOrientation = S.Screen?.setOrientation ?? S.setDeviceOrientation;
  setOrientation?.({ type: 'landscape' })?.catch?.(() => {});
} catch (e) {}

/* 2) 저장소: 앱인토스 Storage ↔ localStorage 동기화 (앱을 지웠다 깔아도 기록 유지에 도움) */
async function restore() {
  const st = S.Storage; if (!st?.getItem) return;
  await Promise.all(KEYS.map(async k => { try { const v = await st.getItem(k); if (v != null && localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch (e) {} }));
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k: string, v: string) => { orig(k, v); if (k.startsWith('jjinaksi.')) { try { st.setItem(k, v)?.catch?.(() => {}); } catch (e) {} } };
}

/* 3) 리워드 광고: 미리 불러두기(preload) → 보여주기(show) → 끝까지 보면 true */
let loaded = false, loading = false;
function preloadAd(): Promise<void> {
  if (loaded || loading || !S.loadFullScreenAd?.isSupported?.()) return Promise.resolve();
  loading = true;
  return new Promise(res => {
    try {
      S.loadFullScreenAd({
        options: { adGroupId: AD_GROUP },
        onEvent: (e: any) => { if (e?.type === 'loaded') { loaded = true; loading = false; res(); } },
        onError: () => { loading = false; res(); },
      });
    } catch (e) { loading = false; res(); }
    setTimeout(() => { loading = false; res(); }, 15000);
  });
}
async function showAd(): Promise<boolean> {
  if (!S.showFullScreenAd?.isSupported?.()) return false;
  if (!loaded) await preloadAd();
  if (!loaded) return false;
  loaded = false;
  return new Promise(resolve => {
    let earned = false;
    try {
      S.showFullScreenAd({
        options: { adGroupId: AD_GROUP },
        onEvent: (e: any) => {
          if (e?.type === 'userEarnedReward') earned = true;
          if (e?.type === 'dismissed') resolve(earned);
          if (e?.type === 'failedToShow') resolve(false);
        },
        onError: () => resolve(false),
      });
    } catch (e) { resolve(false); }
  });
}
/* 5) 이용 통계: 앱인토스 분석 SDK가 있으면 전달 (함수 이름이 다르면 여기만 수정) */
function track(name: string, props: any) {
  try { S.Analytics?.log?.({ log_name: name, log_type: 'event', params: props || {} })?.catch?.(() => {}); } catch (e) {}
}
(window as any).AIT = { isToss: true, adGroupId: AD_GROUP, preloadAd, showAd, track };

/* 4) 저장 기록 복원 후 게임 시작 */
restore().finally(() => {
  const s = document.createElement('script'); s.src = './game.js'; document.body.appendChild(s);
});
