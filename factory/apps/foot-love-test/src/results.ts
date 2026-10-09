// 발 모양 유형별 결과. 재미용 문구이며 근거 없음을 화면에도 밝힌다.
export type FootType = 'egypt' | 'greek' | 'roman';

export interface FootResult {
  type: FootType;
  name: string;
  emoji: string;
  shape: string;
  titles: string[]; // 사진마다 하나가 골라진다
  desc: string;
  stats: { label: string; base: number }[];
  match: FootType;
  secret: string;
}

export const RESULTS: Record<FootType, FootResult> = {
  egypt: {
    type: 'egypt',
    name: '이집트형 발',
    emoji: '🏺',
    shape: '엄지발가락이 제일 길고 계단처럼 내려가는 발',
    titles: ['스핑크스급 신비주의 연애러', '피라미드처럼 묵직한 순정파', '밀당 파라오'],
    desc:
      '쉽게 마음을 열지 않지만 한번 열리면 미라처럼 오래 가요. 답장은 느린데 내용은 길고, 기념일은 절대 안 까먹는 타입. 상대가 먼저 다가와 주길 3000년째 기다리는 중이에요.',
    stats: [
      { label: '밀당력', base: 82 },
      { label: '직진력', base: 41 },
      { label: '질투 지수', base: 67 },
      { label: '발냄새 관용도', base: 55 },
    ],
    match: 'roman',
    secret: '사실 상대 SNS를 하루에 몇 번씩 들어가 봐요. 좋아요는 절대 안 누르고요.',
  },
  greek: {
    type: 'greek',
    name: '그리스형 발',
    emoji: '🏛️',
    shape: '둘째 발가락이 엄지보다 긴 발',
    titles: ['올림포스 직진 장인', '고백 먼저 하는 영웅', '사랑의 마라톤 완주자'],
    desc:
      '좋으면 좋다고 바로 말하는 직진형이에요. 데이트 코스는 이미 엑셀로 짜 두었고, 리액션은 그리스 비극 배우급. 열정이 넘쳐 가끔 상대가 숨이 차요.',
    stats: [
      { label: '밀당력', base: 23 },
      { label: '직진력', base: 94 },
      { label: '질투 지수', base: 58 },
      { label: '발냄새 관용도', base: 71 },
    ],
    match: 'egypt',
    secret: '고백 멘트를 미리 연습해요. 거울 앞에서 최소 다섯 번은요.',
  },
  roman: {
    type: 'roman',
    name: '로마형 발',
    emoji: '🛡️',
    shape: '엄지·둘째·셋째 발가락 길이가 비슷한 네모난 발',
    titles: ['모든 길은 나에게로, 든든 연애러', '콜로세움급 안정감', '연애계의 로마 도로'],
    desc:
      '흔들림 없는 안정형이에요. 싸워도 다음 날 아무렇지 않게 밥 먹자고 하고, 약속 시간은 칼같이 지켜요. 연애가 곧 생활이라 설렘보다 편안함으로 승부해요.',
    stats: [
      { label: '밀당력', base: 38 },
      { label: '직진력', base: 66 },
      { label: '질투 지수', base: 29 },
      { label: '발냄새 관용도', base: 96 },
    ],
    match: 'greek',
    secret: '겉으로는 쿨하지만 상대 생일 선물은 두 달 전부터 고민해요.',
  },
};

export const TYPE_ORDER: FootType[] = ['egypt', 'greek', 'roman'];

/** 사진(또는 선택)마다 다르지만 같은 사진이면 같은 결과가 나오도록 하는 시드 */
export function seedOf(file: File | null): number {
  const key = file ? `${file.name}|${file.size}|${file.lastModified}` : `${Date.now()}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function statValue(base: number, seed: number, i: number): number {
  const jitter = ((seed >> (i * 5)) % 21) - 10; // -10 ~ +10
  return Math.max(5, Math.min(99, base + jitter));
}
