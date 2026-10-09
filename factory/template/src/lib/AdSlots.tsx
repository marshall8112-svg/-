import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { hasAd, isReady, mountBanner, onAdStateChange, rewardInfo, showRewarded } from './ads';

/** 배너 광고 자리. 광고가 없거나 채워지지 않으면 자리를 차지하지 않는다. 콘텐츠 사이나 화면 아래쪽에 둔다. */
export function AdBanner({ variant = 'card' }: { variant?: 'card' | 'expanded' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(true);
  useEffect(() => (ref.current ? mountBanner(ref.current, { variant, onFill: setFilled }) : undefined), [variant]);
  if (!hasAd('banner')) return null;
  return <div ref={ref} className="ad-banner" hidden={!filled} />;
}

export function useRewardedReady(): boolean {
  return useSyncExternalStore(onAdStateChange, () => isReady('rewarded'));
}

/**
 * "광고 보고 ○○ 받기" 버튼. 끝까지 보면 onReward 를 부른다.
 * 광고가 준비되지 않았으면 버튼을 숨긴다 (누를 수 없는 버튼을 보여주지 않는다).
 */
export function RewardedButton({ label, onReward }: { label?: string; onReward: () => void }) {
  const ready = useRewardedReady();
  const [busy, setBusy] = useState(false);
  if (!hasAd('rewarded') || !ready) return null;
  const text = label ?? `광고 보고 ${rewardInfo.name || '보상'} 받기`;
  return (
    <button
      className="btn btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        if (await showRewarded()) onReward();
        setBusy(false);
      }}
    >
      {text}
    </button>
  );
}
