// Claude로 릴스 기획안(대본·자막·캡션)을 만든다.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const TEMPLATES = {
  empathy: '공감형: 누구나 겪는 상황/감정으로 시작 → 앱이 그걸 웃기게 해결',
  demo: '시연형: 실제 사용 흐름을 빠르게 보여주고 결과로 끝냄',
  result_reveal: '결과공개형: "내 결과 뭐 나왔게?" 식으로 궁금증 → 마지막에 공개',
  pov: 'POV 밈형: "POV: ~할 때" 상황극 자막',
  challenge: '도전형: 시청자에게 해보라고 도발 ("너는 몇 점 나올 듯?")'
};

const Plan = z.object({
  template: z.enum(Object.keys(TEMPLATES)),
  hook: z.string().describe('첫 1~2초 화면 중앙에 크게 뜨는 문구. 18자 이내. 스크롤을 멈추게 하는 한 줄'),
  scenes: z
    .array(
      z.object({
        text: z.string().describe('화면 자막. 20자 이내, 줄바꿈은 \\n 으로 최대 2줄. 강조할 단어 하나는 *별표* 로 감싸도 됨'),
        seconds: z.number().describe('이 자막이 떠 있는 시간(초). 1.5~4')
      })
    )
    .describe('hook 다음에 이어지는 자막 3~5개'),
  cta: z.string().describe('마지막 화면 행동 유도 문구. 16자 이내. 예: 토스에서 "앱이름" 검색'),
  caption: z.string().describe('인스타 본문. 2~4줄, 이모지 약간, 해시태그 제외'),
  hashtags: z.array(z.string()).describe('# 없이 5~10개. 한국어 위주, 너무 일반적인 태그만 쓰지 말 것')
});

export async function makePlan({ app, account, template, recent = [] }) {
  const client = new Anthropic();
  const system = [
    '너는 한국 인스타그램 릴스 숏폼 기획자다. 토스 앱 안의 미니앱(앱인토스)을 홍보하는 12~18초짜리 세로 영상의 자막 대본을 쓴다.',
    `계정 말투: ${account.voice}`,
    '규칙:',
    '- 첫 문구(hook)에서 1초 안에 궁금하게 만들 것. "안녕하세요", 앱 소개로 시작 금지.',
    '- 자막은 짧고 리듬감 있게. 광고 티 나는 표현(최고의, 혁신적인, 지금 바로 다운로드) 금지.',
    '- 앱에 없는 기능을 지어내지 말 것. 설명에 있는 것만 사용.',
    '- 토스 공식 계정인 척하지 말 것. 개인 개발자가 만든 재미있는 앱 톤.',
    '- 최근에 쓴 hook과 겹치지 않게 새 각도를 찾을 것.'
  ].join('\n');

  const user = [
    `앱 이름: ${app.name}`,
    `한 줄 소개: ${app.tagline}`,
    `기능 설명: ${app.description}`,
    `타깃: ${app.audience}`,
    `토스 검색어: ${app.keyword} (${account.searchHint})`,
    `이번 템플릿: ${template} — ${TEMPLATES[template]}`,
    app.url ? '배경에는 실제 앱 화면 녹화가 깔린다. 자막은 화면을 설명하기보다 감정/상황을 말할 것.' : '배경은 단색 그라데이션과 큰 이모지뿐이다. 자막만으로 이야기가 전달돼야 한다.',
    recent.length ? `최근에 쓴 hook(피할 것):\n- ${recent.join('\n- ')}` : ''
  ].join('\n');

  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(Plan) },
    system,
    messages: [{ role: 'user', content: user }]
  });

  if (response.stop_reason === 'refusal') throw new Error(`Claude가 기획을 거절했어요: ${JSON.stringify(response.stop_details)}`);
  const plan = response.parsed_output;
  if (!plan) throw new Error(`기획안 파싱 실패 (stop_reason=${response.stop_reason})`);
  plan.template = template;
  plan.scenes = plan.scenes.slice(0, 5).map((s) => ({ ...s, seconds: Math.min(4, Math.max(1.5, s.seconds)) }));
  plan.hashtags = plan.hashtags.map((t) => t.replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 10);
  return plan;
}

export function buildCaption(plan, app, account) {
  // 앱인토스 외부 광고 가이드 권장 태그: #서비스명 #토스미니앱 #토스에서만나보세요
  const tags = [...plan.hashtags, app.keyword.replace(/\s+/g, ''), '토스미니앱', '토스에서만나보세요'].filter((t, i, a) => a.indexOf(t) === i);
  return `${plan.caption}\n\n👉 ${account.searchHint}: ${app.keyword}\n\n${tags.map((t) => `#${t}`).join(' ')}`;
}
