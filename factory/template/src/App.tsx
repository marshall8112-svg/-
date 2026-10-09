// 공장 템플릿의 기본 화면. 새 앱을 만들 때 이 파일을 아이디어에 맞게 다시 쓴다.
// 광고 배치 패턴: 결과로 넘어갈 때 showInterstitial(), 결과 화면에 AdBanner, 추가 혜택은 RewardedButton.
import { useState } from 'react';
import { showInterstitial } from './lib/ads';
import { AdBanner, RewardedButton } from './lib/AdSlots';

export default function App() {
  const [step, setStep] = useState<'home' | 'result'>('home');
  const [bonus, setBonus] = useState(false);

  if (step === 'result') {
    return (
      <main className="page">
        <h1 className="title">결과</h1>
        <p className="body">여기에 결과를 보여줘요.</p>
        {bonus && <p className="body">추가 결과가 열렸어요.</p>}
        <RewardedButton label="광고 보고 추가 결과 보기" onReward={() => setBonus(true)} />
        <AdBanner />
        <div className="bottom">
          <button className="btn" onClick={() => setStep('home')}>
            다시 하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="title">__TITLE__</h1>
      <p className="body">__TAGLINE__</p>
      <div className="bottom">
        <button
          className="btn"
          onClick={async () => {
            await showInterstitial();
            setStep('result');
          }}
        >
          시작하기
        </button>
      </div>
    </main>
  );
}
