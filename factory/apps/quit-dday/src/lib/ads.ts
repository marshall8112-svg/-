// 앱인토스 인앱 광고 (배너 · 전면형 · 보상형).
// 광고 그룹 ID는 src/ad-config.json 에서 읽는다. 공장 스크립트(set-ads)가 채운다.
// - 토스 앱 밖(일반 브라우저)에서는 isSupported()가 false라 조용히 아무것도 안 한다.
// - 개발 서버(npm run dev)에서는 devtools mock SDK가 붙으므로, ID가 비어 있어도 mock ID로 흐름을 확인할 수 있다.
import { TossAds, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import config from '../ad-config.json';

type FullScreenKind = 'interstitial' | 'rewarded';
type AdKind = 'banner' | FullScreenKind;

function adGroupId(kind: AdKind): string {
  const id = String(config[kind] ?? '').trim();
  if (id) return id;
  return import.meta.env.DEV ? `dev-mock-${kind}` : '';
}

function supported(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}

export const rewardInfo = config.reward;
export const hasAd = (kind: AdKind) => adGroupId(kind) !== '';

// ---------------------------------------------------------------- 배너

let bannerReady: Promise<boolean> | null = null;

function initBanner(): Promise<boolean> {
  if (bannerReady) return bannerReady;
  bannerReady = new Promise((resolve) => {
    if (!hasAd('banner') || !supported(() => TossAds.initialize.isSupported())) return resolve(false);
    TossAds.initialize({
      callbacks: {
        onInitialized: () => resolve(true),
        onInitializationFailed: (e) => {
          console.warn('[ads] banner init failed', e);
          resolve(false);
        },
      },
    });
  });
  return bannerReady;
}

/** 배너를 target 요소에 붙인다. 반환된 함수로 정리한다. */
export function mountBanner(
  target: HTMLElement,
  opts: { variant?: 'card' | 'expanded'; onFill?: (filled: boolean) => void } = {},
): () => void {
  let destroy: (() => void) | null = null;
  let cancelled = false;
  initBanner().then((ok) => {
    if (!ok || cancelled) return opts.onFill?.(false);
    destroy = TossAds.attachBanner(adGroupId('banner'), target, {
      theme: 'auto',
      variant: opts.variant ?? 'card',
      callbacks: {
        onAdRendered: () => opts.onFill?.(true),
        onNoFill: () => opts.onFill?.(false),
        onAdFailedToRender: () => opts.onFill?.(false),
      },
    }).destroy;
  });
  return () => {
    cancelled = true;
    destroy?.();
  };
}

// ---------------------------------------------------------------- 전면형 · 보상형

const state: Record<FullScreenKind, 'idle' | 'loading' | 'ready'> = { interstitial: 'idle', rewarded: 'idle' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** 광고 준비 상태가 바뀔 때 호출된다 (보상형 버튼 활성화 등). */
export function onAdStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isReady = (kind: FullScreenKind) => state[kind] === 'ready';

function preload(kind: FullScreenKind) {
  const id = adGroupId(kind);
  if (!id || state[kind] !== 'idle' || !supported(() => loadFullScreenAd.isSupported())) return;
  state[kind] = 'loading';
  loadFullScreenAd({
    options: { adGroupId: id },
    onEvent: (e) => {
      if (e.type === 'loaded') {
        state[kind] = 'ready';
        emit();
      }
    },
    onError: (e) => {
      console.warn(`[ads] ${kind} load failed`, e);
      state[kind] = 'idle';
      emit();
    },
  });
}

function show(kind: FullScreenKind): Promise<{ shown: boolean; rewarded: boolean }> {
  const id = adGroupId(kind);
  if (!id || state[kind] !== 'ready' || !supported(() => showFullScreenAd.isSupported())) {
    preload(kind);
    return Promise.resolve({ shown: false, rewarded: false });
  }
  state[kind] = 'idle';
  emit();
  return new Promise((resolve) => {
    let shown = false;
    let rewarded = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      preload(kind); // 다음 노출을 위해 바로 다시 불러 둔다
      resolve({ shown, rewarded });
    };
    showFullScreenAd({
      options: { adGroupId: id },
      onEvent: (e) => {
        if (e.type === 'show' || e.type === 'impression') shown = true;
        else if (e.type === 'userEarnedReward') rewarded = true;
        else if (e.type === 'failedToShow') finish();
        else if (e.type === 'dismissed') {
          shown = true;
          // 보상 이벤트가 닫힘 직후에 도착하는 경우를 위해 잠깐 기다린다.
          setTimeout(finish, kind === 'rewarded' ? 300 : 0);
        }
      },
      onError: (e) => {
        console.warn(`[ads] ${kind} show failed`, e);
        finish();
      },
    });
  });
}

/** 앱 시작 시 한 번 호출: 배너 SDK 초기화와 전면형·보상형 미리 불러오기. */
export function initAds() {
  void initBanner();
  preload('interstitial');
  preload('rewarded');
}

// 전면 광고 빈도 제한: 최소 간격 + N번에 한 번.
const INTERSTITIAL_MIN_INTERVAL_MS = 60_000;
let lastInterstitialAt = 0;
let breakCount = 0;

/**
 * 자연스러운 쉬는 지점(결과 화면으로 넘어갈 때, 한 판이 끝났을 때)에서만 호출한다.
 * 첫 진입·일반 탭·스크롤 중에는 호출하지 않는다. 광고가 없거나 빈도 제한에 걸리면 바로 끝난다.
 */
export async function showInterstitial({ every = 1 }: { every?: number } = {}): Promise<boolean> {
  breakCount += 1;
  if (breakCount % every !== 0) return false;
  if (Date.now() - lastInterstitialAt < INTERSTITIAL_MIN_INTERVAL_MS) return false;
  const { shown } = await show('interstitial');
  if (shown) lastInterstitialAt = Date.now();
  return shown;
}

/** 보상형 광고. 끝까지 봐서 보상 이벤트가 왔을 때만 true. 보상은 true일 때만 지급한다. */
export async function showRewarded(): Promise<boolean> {
  const { rewarded } = await show('rewarded');
  return rewarded;
}
