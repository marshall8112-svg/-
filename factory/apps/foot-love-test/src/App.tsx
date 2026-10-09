// 발가락 연애 테스트. 발 사진 + 발가락 모양 선택 → 가짜 분석 → 연애 스타일 결과.
// 사진은 기기 안에서 미리보기로만 쓰고 어디에도 보내지 않는다.
// 광고: "결과 보기"에서 showInterstitial(), 결과 화면에 AdBanner, 숨겨진 비밀은 RewardedButton.
import { useEffect, useRef, useState } from 'react';
import { showInterstitial } from './lib/ads';
import { AdBanner, RewardedButton } from './lib/AdSlots';
import { RESULTS, TYPE_ORDER, seedOf, statValue, type FootType } from './results';

type Step = 'home' | 'shape' | 'analyze' | 'result';

const SHAPES: { value: FootType | 'unknown'; label: string; hint: string }[] = [
  { value: 'egypt', label: '엄지발가락이 제일 길어요', hint: '계단처럼 내려가요' },
  { value: 'greek', label: '둘째 발가락이 제일 길어요', hint: '엄지보다 툭 튀어나와요' },
  { value: 'roman', label: '앞쪽 발가락 길이가 비슷해요', hint: '네모난 느낌이에요' },
  { value: 'unknown', label: '잘 모르겠어요', hint: '사진으로 대충 맞혀 볼게요' },
];

const ANALYZE_LINES = [
  '발가락 끝점 찾는 중…',
  '발가락 길이 비교 중…',
  '발톱 광택에서 설렘 지수 측정 중',
  '발냄새는 측정하지 않았어요 (다행)',
];
const LINE_MS = 900;

// 분석 연출용 발가락 끝점(사진 위 % 좌표). 실제 인식이 아니라 유형별 모양을 흉내 낸다.
const TOE_POINTS: Record<FootType, [number, number][]> = {
  egypt: [[26, 26], [40, 33], [53, 40], [65, 48], [76, 57]],
  greek: [[26, 34], [40, 24], [53, 35], [65, 45], [76, 55]],
  roman: [[26, 29], [40, 28], [53, 30], [65, 44], [76, 55]],
};
const MEASURE_LABEL: Record<FootType, string> = {
  egypt: '엄지 > 둘째 · 경사 23°',
  greek: '둘째 > 엄지 · +4.2mm',
  roman: '엄지 ≈ 둘째 ≈ 셋째',
};

function ScanOverlay({ type, done }: { type: FootType; done: boolean }) {
  const pts = TOE_POINTS[type];
  const top = Math.min(...pts.map(([, y]) => y));
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <div className={`scan-overlay ${done ? 'done' : ''}`} aria-hidden>
      <svg className="ref-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line className="ref-line" x1="10" x2="90" y1={top} y2={top} />
      </svg>
      <svg className="path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="toe-path" d={path} />
      </svg>
      {pts.map(([x, y], i) => (
        <span key={i} className="toe-dot" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.3 + i * 0.3}s` }} />
      ))}
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      {!done && <div className="scan-line" />}
      {done ? (
        <div className="detect-badge">{RESULTS[type].emoji} {RESULTS[type].name} 감지</div>
      ) : (
        <div className="measure-chip">{MEASURE_LABEL[type]}</div>
      )}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [type, setType] = useState<FootType>('egypt');
  const [seed, setSeed] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [secret, setSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  useEffect(() => {
    if (step !== 'analyze') return;
    setLineIdx(0);
    setDone(false);
    const tick = setInterval(() => setLineIdx((i) => Math.min(i + 1, ANALYZE_LINES.length - 1)), LINE_MS);
    const end = setTimeout(() => setDone(true), LINE_MS * ANALYZE_LINES.length);
    return () => { clearInterval(tick); clearTimeout(end); };
  }, [step]);

  function pickPhoto(f: File | undefined) {
    if (!f) return;
    if (photo) URL.revokeObjectURL(photo);
    setFile(f);
    setPhoto(URL.createObjectURL(f));
    setStep('shape');
  }

  function choose(value: FootType | 'unknown') {
    const s = seedOf(file);
    setSeed(s);
    setType(value === 'unknown' ? TYPE_ORDER[s % TYPE_ORDER.length] : value);
    setSecret(false);
    setStep('analyze');
  }

  function restart() {
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
    setFile(null);
    setStep('home');
  }

  const r = RESULTS[type];
  const title = r.titles[seed % r.titles.length];

  async function share() {
    const text = `내 발은 ${r.name}! "${title}" 🦶 발가락 연애 테스트로 확인해 봐요`;
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
    const match = RESULTS[r.match];
    return (
      <main className="page">
        <p className="eyebrow">당신의 발은</p>
        <h1 className="title">
          {r.emoji} {r.name}
          <br />
          <span className="brand">“{title}”</span>
        </h1>
        {photo && <img className="photo small" src={photo} alt="올린 발 사진" />}
        <p className="body">{r.desc}</p>

        <section className="card">
          <h2 className="card-title">연애 능력치</h2>
          {r.stats.map((s, i) => {
            const v = statValue(s.base, seed, i);
            return (
              <div key={s.label} className="stat">
                <div className="stat-row">
                  <span>{s.label}</span>
                  <b>{v}</b>
                </div>
                <div className="bar"><div className="bar-fill" style={{ width: `${v}%` }} /></div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2 className="card-title">찰떡궁합 발</h2>
          <p className="body">
            {match.emoji} <b className="text">{match.name}</b> — {match.shape}
          </p>
        </section>

        {secret ? (
          <section className="card highlight">
            <h2 className="card-title">🤫 숨겨진 연애 비밀</h2>
            <p className="body">{r.secret}</p>
          </section>
        ) : (
          <RewardedButton label="광고 보고 숨겨진 연애 비밀 보기" onReward={() => setSecret(true)} />
        )}

        <AdBanner />
        <p className="note">재미로 보는 테스트예요. 과학적 근거는 전혀 없어요.</p>

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

  if (step === 'analyze') {
    return (
      <main className="page center">
        {photo && (
          <div className="scan-wrap">
            <img className="photo" src={photo} alt="분석 중인 발 사진" />
            <ScanOverlay type={type} done={done} />
          </div>
        )}
        <div className="progress" aria-hidden>
          <div className="progress-fill" style={{ animationDuration: `${LINE_MS * ANALYZE_LINES.length}ms` }} />
        </div>
        <h1 className="title">{done ? '분석 완료!' : '발가락 정밀 분석 중'}</h1>
        <p className="body">{done ? '당신의 연애 스타일이 나왔어요.' : ANALYZE_LINES[lineIdx]}</p>
        <div className="bottom">
          <button
            className="btn"
            disabled={!done}
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

  if (step === 'shape') {
    return (
      <main className="page">
        {photo && <img className="photo" src={photo} alt="올린 발 사진" />}
        <h1 className="title">사진 속 발가락,<br />어떤 모양이에요?</h1>
        <div className="options">
          {SHAPES.map((s) => (
            <button key={s.value} className="option" onClick={() => choose(s.value)}>
              <span className="option-label">{s.label}</span>
              <span className="option-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="hero">🦶</div>
      <h1 className="title">발가락 연애 테스트</h1>
      <p className="body">
        발 사진 한 장이면 끝! 발가락 모양으로 당신의 연애 스타일과 찰떡궁합을 알려드려요.
      </p>
      <div className="card">
        <p className="body">📸 맨발을 위에서 찍어 주세요</p>
        <p className="body">🔒 사진은 휴대폰 밖으로 나가지 않아요</p>
        <p className="body">🎉 재미로 보는 테스트예요</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pickPhoto(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="bottom">
        <button className="btn" onClick={() => inputRef.current?.click()}>
          발 사진 올리기
        </button>
      </div>
    </main>
  );
}
