// 퇴사 디데이 계산기. 질문 10개 → 퇴사 지수·예상 퇴사일·칭호.
// 광고: "결과 보기"에서 showInterstitial(), 결과 화면에 AdBanner, 상사 대처 비법은 RewardedButton.
import { useState } from 'react';
import { showInterstitial } from './lib/ads';
import { AdBanner, RewardedButton } from './lib/AdSlots';
import { QUESTIONS, STAT_LABEL, quitDate, statScore, tierOf } from './quiz';

type Step = 'home' | 'quiz' | 'done' | 'result';

const fmt = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [answers, setAnswers] = useState<number[]>([]);
  const [secret, setSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const idx = answers.length;
  const score = Math.round((answers.reduce((s, a) => s + a, 0) / (QUESTIONS.length * 3)) * 100);
  const tier = tierOf(score);
  const { days, date } = quitDate(answers, tier);

  function answer(i: number) {
    const next = [...answers, i];
    setAnswers(next);
    if (next.length === QUESTIONS.length) setStep('done');
  }

  function restart() {
    setAnswers([]);
    setSecret(false);
    setCopied(false);
    setStep('home');
  }

  async function share() {
    const text = `내 퇴사 지수 ${score}%, 칭호는 "${tier.title}" ${tier.emoji} 퇴사까지 D-${days}래요. 퇴사 디데이 계산기로 확인해 봐요`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* 공유 취소 */
    }
  }

  if (step === 'result') {
    return (
      <main className="page">
        <p className="eyebrow">당신의 퇴사 지수</p>
        <div className="gauge" style={{ ['--p' as string]: score }}>
          <span className="gauge-value">{score}<small>%</small></span>
        </div>
        <h1 className="title center-text">
          {tier.emoji} {tier.title}
        </h1>
        <section className="card dday">
          <span className="dday-label">예상 퇴사일</span>
          <b className="dday-num">D-{days}</b>
          <span className="dday-date">{fmt(date)}</span>
        </section>
        <p className="body">{tier.desc}</p>

        <section className="card">
          <h2 className="card-title">직장인 상태 진단</h2>
          {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((k) => {
            const v = statScore(answers, k);
            return (
              <div key={k} className="stat">
                <div className="stat-row">
                  <span>{STAT_LABEL[k]}</span>
                  <b>{v}</b>
                </div>
                <div className="bar"><div className="bar-fill" style={{ width: `${Math.max(v, 4)}%` }} /></div>
              </div>
            );
          })}
          <p className="tip">{tier.tip}</p>
        </section>

        {secret ? (
          <section className="card highlight">
            <h2 className="card-title">🤫 상사 대처 비법</h2>
            <p className="body">{tier.secret}</p>
          </section>
        ) : (
          <RewardedButton label="광고 보고 상사 대처 비법 보기" onReward={() => setSecret(true)} />
        )}

        <AdBanner />
        <p className="note">재미로 보는 테스트예요. 실제 퇴사는 신중하게 결정하세요.</p>

        <div className="bottom row">
          <button className="btn btn-secondary" onClick={share}>
            {copied ? '복사했어요' : '친구에게 공유'}
          </button>
          <button className="btn" onClick={restart}>
            다시 하기
          </button>
        </div>
      </main>
    );
  }

  if (step === 'done') {
    return (
      <main className="page center">
        <div className="hero">📮</div>
        <h1 className="title">계산이 끝났어요</h1>
        <p className="body">당신의 퇴사 각이 나왔어요. 마음의 준비 되셨나요?</p>
        <div className="bottom">
          <button
            className="btn"
            onClick={async () => {
              await showInterstitial();
              setStep('result');
            }}
          >
            결과 보기
          </button>
        </div>
      </main>
    );
  }

  if (step === 'quiz') {
    const q = QUESTIONS[idx];
    return (
      <main className="page">
        <div className="progress-row">
          <div className="progress"><div className="progress-fill" style={{ width: `${(idx / QUESTIONS.length) * 100}%` }} /></div>
          <span className="progress-text">{idx + 1}/{QUESTIONS.length}</span>
        </div>
        <h1 className="title">{q.q}</h1>
        <div className="options">
          {q.options.map((o, i) => (
            <button key={o} className="option" onClick={() => answer(i)}>
              {o}
            </button>
          ))}
        </div>
        {idx > 0 && (
          <button className="link-btn" onClick={() => setAnswers(answers.slice(0, -1))}>
            ← 이전 질문
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <div className="hero">🚪</div>
      <h1 className="title">퇴사 디데이 계산기</h1>
      <p className="body">질문 10개에 솔직하게 답하면 퇴사 지수와 예상 퇴사일, 그리고 당신의 직장인 칭호를 알려드려요.</p>
      <div className="card">
        <p className="body">⏱️ 1분이면 끝나요</p>
        <p className="body">🔒 답변은 어디에도 저장되지 않아요</p>
        <p className="body">🎉 재미로 보는 테스트예요</p>
      </div>
      <div className="bottom">
        <button className="btn" onClick={() => setStep('quiz')}>
          시작하기
        </button>
      </div>
    </main>
  );
}
