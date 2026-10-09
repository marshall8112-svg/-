// 질문·결과 데이터. 재미용이며 화면에도 그렇게 밝힌다.
export interface Question {
  q: string;
  options: string[]; // 0점 → 3점 순서
  stat: 'monday' | 'burnout' | 'escape';
}

export const QUESTIONS: Question[] = [
  { q: '월요일 아침 알람이 울리면?', stat: 'monday', options: ['상쾌하게 기상!', '5분만… 한 번만 더', '알람을 세 번 끈다', '오늘 아프기로 마음먹는다'] },
  { q: '회의 중 내 표정은?', stat: 'burnout', options: ['메모하며 끄덕끄덕', '적당히 영혼 반쯤', '눈 뜨고 자는 중', '이 회의의 존재 이유를 고민 중'] },
  { q: '점심시간이 끝나갈 때 나는?', stat: 'monday', options: ['오후 일 생각에 설렘', '커피 하나 더 사 간다', '시계를 보며 한숨', '이대로 집에 가는 상상'] },
  { q: '상사가 "잠깐 얘기 좀 할까?" 하면?', stat: 'burnout', options: ['네! 바로 갈게요', '무슨 일이지… 살짝 긴장', '머릿속으로 변명 3개 준비', '드디어 그날이 왔구나'] },
  { q: '내 메신저 상태 메시지는?', stat: 'escape', options: ['오늘도 파이팅!', '비워 둠', '…', '자유를 향해'] },
  { q: '월급날 통장을 보면?', stat: 'escape', options: ['든든하다', '카드값 빠지면 끝', '스쳐 지나가는 손님', '이 돈 받고 이걸 한다고?'] },
  { q: '퇴근 10분 전 업무 요청이 오면?', stat: 'burnout', options: ['기꺼이 처리', '내일 아침에 할게요', '못 본 척 노트북 덮기', '조용히 이직 앱을 연다'] },
  { q: '요즘 몰래 검색해 본 건?', stat: 'escape', options: ['업무 관련 공부', '주말 맛집', '한 달 살기 비용', '사직서 양식'] },
  { q: '동료가 퇴사한다고 하면?', stat: 'escape', options: ['아쉽다, 잘 가', '어디로 가는지 궁금', '부럽다…', '나도 데려가 줘'] },
  { q: '지금 회사를 한 단어로 표현하면?', stat: 'monday', options: ['성장', '밥벌이', '정거장', '탈출 게임'] },
];

export const STAT_LABEL = { monday: '월요병 지수', burnout: '번아웃 게이지', escape: '탈출 욕구' } as const;

export interface Tier {
  min: number; // 퇴사 지수(%) 하한
  emoji: string;
  title: string;
  desc: string;
  days: [number, number]; // 예상 퇴사일까지 남은 날 범위
  tip: string;
  secret: string; // 보상형 광고로 여는 '상사 대처 비법'
}

export const TIERS: Tier[] = [
  {
    min: 81, emoji: '🚀', title: '퇴사 카운트다운 돌입', days: [7, 45],
    desc: '이미 마음은 회사 밖에 있어요. 출근길 지하철에서 사직서 문구를 다듬고 있진 않나요? 떠나기 전에 다음 계획부터 챙겨 두면 완벽해요.',
    tip: '오늘의 생존 팁: 퇴근 후 이력서 한 줄만 고쳐 보기',
    secret: '상사가 말을 걸면 "네, 확인해 보겠습니다"를 무한 반복하세요. 확인은 마음속으로만 합니다.',
  },
  {
    min: 61, emoji: '📝', title: '사직서 초안 작성자', days: [46, 120],
    desc: '서랍 어딘가에 사직서 초안이 있을 확률 높음. 아직 버티는 이유가 있다면 그게 월급인지 사람인지 한 번 적어 보세요.',
    tip: '오늘의 생존 팁: 점심은 꼭 맛있는 걸로',
    secret: '회의에서 "좋은 의견이네요, 정리해서 공유드릴게요"라고 하면 회의가 10분 빨리 끝납니다.',
  },
  {
    min: 41, emoji: '👀', title: '이직 사이트 눈팅러', days: [121, 300],
    desc: '당장 나가진 않지만 채용 공고 알림은 켜 둔 상태. 반은 버티고 반은 둘러보는, 가장 현명한 직장인 모드예요.',
    tip: '오늘의 생존 팁: 퇴근 시간 알람을 미리 맞춰 두기',
    secret: '보고는 결론부터. "결론은 ○○입니다"로 시작하면 상사의 질문이 절반으로 줄어요.',
  },
  {
    min: 21, emoji: '🧱', title: '존버 장인', days: [301, 700],
    desc: '힘들어도 묵묵히 버티는 타입. 회사가 당신 덕분에 돌아가고 있을지도 몰라요. 가끔은 연차도 꼭 쓰세요.',
    tip: '오늘의 생존 팁: 이번 달 연차 날짜 찍어 두기',
    secret: '상사 기분이 안 좋아 보이면 보고를 30분 미루세요. 타이밍이 실력입니다.',
  },
  {
    min: 0, emoji: '🏠', title: '회사가 집인 사람', days: [701, 1500],
    desc: '혹시 회사 대표님이세요? 지금 회사가 잘 맞는 행운아예요. 이 테스트를 친구에게 보내 위로해 주세요.',
    tip: '오늘의 생존 팁: 힘들어하는 동료에게 커피 한 잔',
    secret: '상사에게 먼저 "요즘 바쁘시죠?"라고 말 걸기. 생각보다 많은 걸 얻을 수 있어요.',
  },
];

export function tierOf(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

/** 같은 답이면 같은 날짜가 나오도록 답안으로 날짜를 정한다 */
export function quitDate(answers: number[], tier: Tier, today = new Date()): { days: number; date: Date } {
  let h = 7;
  for (const a of answers) h = (h * 31 + a + 1) % 100003;
  const [lo, hi] = tier.days;
  const days = lo + (h % (hi - lo + 1));
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return { days, date };
}

export function statScore(answers: number[], stat: Question['stat']): number {
  const idx = QUESTIONS.map((q, i) => (q.stat === stat ? i : -1)).filter((i) => i >= 0);
  const sum = idx.reduce((s, i) => s + (answers[i] ?? 0), 0);
  return Math.round((sum / (idx.length * 3)) * 100);
}
