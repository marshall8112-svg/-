// 기획안 + (있으면) 앱 화면 녹화를 1080x1920 릴스 영상으로 합성한다.
// 레이어(아래→위): 천천히 흐르는 배경 · 폰 그림자 · 둥근 모서리 앱 화면 · 베젤 · 자막(슬라이드+페이드) · 진행 바
// 글자·장식 레이어는 HTML을 투명 PNG로 찍고, 움직임은 FFmpeg 표현식으로 준다.
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, ffmpeg } from './capture.mjs';

const W = 1080;
const H = 1920;
export const HOOK_SEC = 2.2;
export const CTA_SEC = 3;
const LANDSCAPE_CROP = 0.62;
const DRIFT = 1.1; // 배경을 10% 크게 찍어 천천히 이동
const RADIUS = 46; // 앱 화면 모서리
const IN = 0.38; // 자막 등장 시간
const BADGE_W = 520; // 토스 미니앱 배지 폭(px). 원본 비율 그대로
const BADGE_Y = 1530; // 마지막 화면에서 주요 메시지 아래
const OUT = 0.22; // 자막 퇴장 시간
const FONT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&display=block');`;
const FONT_STACK = `'Noto Sans KR', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', 'WenQuanYi Zen Hei', sans-serif`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/\\n|\n/g, '<br>');
// *강조* → 형광펜 밑줄 (앱 강조색)
const mark = (s, accent) => esc(s).replace(/\*(.+?)\*/g, `<span style="background:linear-gradient(transparent 58%, ${accent}cc 58%, ${accent}cc 92%, transparent 92%);padding:0 .08em">$1</span>`);

function page(body, { w = W, h = H, bg = 'transparent' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden;font-family:${FONT_STACK};word-break:keep-all;-webkit-font-smoothing:antialiased}
  </style></head><body>${body}</body></html>`;
}

// 배경: 그라데이션 + 빛 번짐 + 큰 이모지 (DRIFT 배 크기로 찍어서 영상에서 천천히 움직인다)
function bgHtml(app) {
  const { bg1, bg2, accent } = app.theme;
  const bw = Math.round(W * DRIFT);
  const bh = Math.round(H * DRIFT);
  return page(
    `<div style="position:absolute;inset:0;background:linear-gradient(165deg,${bg1} 0%,${bg2} 100%)"></div>
     <div style="position:absolute;left:-220px;top:-160px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,${accent}38,transparent 65%)"></div>
     <div style="position:absolute;right:-260px;bottom:180px;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(circle,${bg2}aa,transparent 60%)"></div>
     <div style="position:absolute;right:-60px;bottom:220px;font-size:560px;opacity:.10;transform:rotate(-14deg)">${app.emoji}</div>
     <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,0,.35))"></div>`,
    { w: bw, h: bh }
  );
}

// 폰 그림자 + 하단 계정명 (움직이지 않는 층)
function underHtml(account, slot) {
  const shadow = slot
    ? `<div style="position:absolute;left:${slot.x}px;top:${slot.y}px;width:${slot.w}px;height:${slot.h}px;border-radius:${RADIUS + 10}px;box-shadow:0 40px 90px rgba(0,0,0,.55),0 8px 24px rgba(0,0,0,.35)"></div>`
    : '';
  return page(
    `${shadow}
     <div style="position:absolute;bottom:58px;width:100%;text-align:center;color:rgba(255,255,255,.6);font-size:32px;font-weight:700;letter-spacing:.5px">${esc(account.handle)}</div>`
  );
}

// 앱 화면 위에 얹는 베젤 (가운데는 투명)
function bezelHtml(slot) {
  const b = 12;
  return page(
    `<div style="position:absolute;left:${slot.x - b}px;top:${slot.y - b}px;width:${slot.w}px;height:${slot.h}px;border:${b}px solid #0d0d10;border-radius:${RADIUS + b}px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.06),0 0 0 2px rgba(255,255,255,.14)"></div>`
  );
}

// 앱 화면 둥근 모서리 마스크 (흰색 = 보임)
function maskHtml(slot) {
  return page(`<div style="width:${slot.w}px;height:${slot.h}px;border-radius:${RADIUS}px;background:#fff"></div>`, { w: slot.w, h: slot.h, bg: '#000' });
}

// 첫 문구: 브랜드색 화면을 덮고 있다가 걷히면서 앱 화면이 드러난다
function hookHtml(text, app) {
  const { bg1, bg2, accent } = app.theme;
  return page(
    `<div style="position:absolute;inset:0;background:linear-gradient(165deg,${bg1}f7,${bg2}f2)"></div>
     <div style="position:absolute;left:50%;top:50%;width:1100px;height:1100px;margin:-550px 0 0 -550px;border-radius:50%;background:radial-gradient(circle,${accent}26,transparent 62%)"></div>
     <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 64px">
      <div style="text-align:center">
        <div style="display:inline-block;margin-bottom:28px;padding:10px 26px;border-radius:999px;background:${accent};color:#111;font-size:36px;font-weight:900">${app.emoji} ${esc(app.name)}</div>
        <div style="color:#fff;font-family:'Black Han Sans',${FONT_STACK};font-size:112px;line-height:1.16;letter-spacing:-1px;text-shadow:0 6px 30px rgba(0,0,0,.55),0 2px 0 rgba(0,0,0,.35)">${mark(text, accent)}</div>
      </div></div>`
  );
}

function sceneHtml(text, app, hasCapture) {
  const { accent } = app.theme;
  const pos = hasCapture ? 'top:96px' : 'top:0;bottom:0';
  return page(
    `<div style="position:absolute;left:0;right:0;${pos};display:flex;align-items:center;justify-content:center;padding:0 56px">
      <div style="background:rgba(255,255,255,.97);color:#111;border-radius:30px;padding:28px 42px 30px;font-weight:900;font-size:${hasCapture ? 64 : 84}px;line-height:1.3;letter-spacing:-.5px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)">
        ${mark(text, accent)}
      </div></div>`
  );
}

function ctaHtml(plan, app, account) {
  const { bg1, bg2, accent } = app.theme;
  return page(
    `<div style="position:absolute;inset:0;background:linear-gradient(165deg,${bg1}f5,${bg2}f5)"></div>
     <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:0 80px">
      <div style="width:240px;height:240px;border-radius:64px;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:150px;box-shadow:0 20px 60px rgba(0,0,0,.3)">${app.emoji}</div>
      <div style="font-family:'Black Han Sans',${FONT_STACK};font-size:112px;margin-top:44px;letter-spacing:-1px">${esc(app.name)}</div>
      <div style="font-size:46px;font-weight:700;opacity:.82;margin-top:14px">${esc(app.tagline)}</div>
      <div style="margin-top:84px;background:#fff;color:#191f28;border-radius:999px;padding:28px 54px;font-size:52px;font-weight:900;display:flex;align-items:center;gap:18px;box-shadow:0 16px 40px rgba(0,0,0,.25)">
        <span style="font-size:44px">🔍</span>${esc(app.keyword)}
      </div>
      <div style="margin-top:38px;font-size:48px;font-weight:900;color:${accent}">${esc(plan.cta)}</div>
      <div style="margin-top:16px;font-size:34px;opacity:.7">${esc(account.searchHint)}</div>
    </div>`
  );
}

async function shoot(browser, html, file, { w = W, h = H, transparent = true } = {}) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: transparent });
  await p.close();
}

/** assets/bgm 의 음원 하나. 같은 이름의 .json 에 {"start": 초} 가 있으면 그 지점부터 쓴다 */
async function pickBgm(assetsDir) {
  const files = (await readdir(assetsDir).catch(() => [])).filter((f) => /\.(mp3|m4a|wav|aac)$/i.test(f));
  if (!files.length) return null;
  const file = path.join(assetsDir, files[Math.floor(Math.random() * files.length)]);
  const side = JSON.parse(await readFile(file.replace(/\.[^.]+$/, '.json'), 'utf8').catch(() => '{}'));
  return { file, start: Number(side.start) || 0, volume: Number(side.volume) || 0.85 };
}

export function timeline(plan) {
  // 나레이션이 길면 fitPlan() 이 hookSeconds·ctaSeconds 를 늘려 둔다
  const hookSec = plan.hookSeconds ?? HOOK_SEC;
  const ctaSec = plan.ctaSeconds ?? CTA_SEC;
  const items = [{ kind: 'hook', text: plan.hook, start: 0, end: hookSec }];
  let t = hookSec;
  for (const s of plan.scenes) {
    items.push({ kind: 'scene', text: s.text, start: t, end: t + s.seconds });
    t += s.seconds;
  }
  items.push({ kind: 'cta', start: t, end: t + ctaSec });
  return { items, total: t + ctaSec };
}

export async function renderReel({ plan, app, account, capture, outDir, bgmDir, narration = null }) {
  const { items, total } = timeline(plan);
  const T = total.toFixed(3);
  let slot = null;
  if (capture) {
    // 가로 화면은 가운데 62%만 잘라서 세로 영상에 크게 넣는다
    slot = capture.landscape ? { w: 1000, h: Math.round((1000 * 390) / (844 * LANDSCAPE_CROP)), crop: LANDSCAPE_CROP } : { h: 1340, w: Math.round((1340 * 390) / 844), crop: 1 };
    slot.w -= slot.w % 2;
    slot.h -= slot.h % 2;
    slot.x = Math.round((W - slot.w) / 2);
    slot.y = capture.landscape ? 600 : 400;
  }

  const P = (n) => path.join(outDir, n);
  const browser = await launchBrowser();
  try {
    await shoot(browser, bgHtml(app), P('bg.png'), { w: Math.round(W * DRIFT), h: Math.round(H * DRIFT), transparent: false });
    await shoot(browser, underHtml(account, slot), P('under.png'));
    if (slot) {
      await shoot(browser, bezelHtml(slot), P('bezel.png'));
      await shoot(browser, maskHtml(slot), P('mask.png'), { w: slot.w, h: slot.h, transparent: false });
    }
    for (const [i, it] of items.entries()) {
      it.png = P(`ov_${i}.png`);
      const html = it.kind === 'hook' ? hookHtml(it.text, app) : it.kind === 'cta' ? ctaHtml(plan, app, account) : sceneHtml(it.text, app, !!slot);
      await shoot(browser, html, it.png);
    }
  } finally {
    await browser.close();
  }

  // ── 입력
  const args = ['-y'];
  let n = 0;
  const input = (...a) => (args.push(...a), n++);
  const bgIdx = input('-loop', '1', '-t', T, '-i', P('bg.png'));
  const underIdx = input('-loop', '1', '-t', T, '-i', P('under.png'));
  let capIdx, maskIdx, bezelIdx;
  if (slot) {
    capIdx = input('-stream_loop', '-1', '-i', capture.file);
    maskIdx = input('-loop', '1', '-t', T, '-i', P('mask.png'));
    bezelIdx = input('-loop', '1', '-t', T, '-i', P('bezel.png'));
  }
  const ovIdx = items.map((it) => input('-loop', '1', '-t', T, '-i', it.png));
  // 토스 미니앱 배지 (외부 광고 가이드: 영상당 1개, 메시지 아래, 수정·애니메이션 금지)
  const badgeFile = path.join(bgmDir, '..', 'badge', 'toss-miniapp-badge-black.png');
  const hasBadge = await access(badgeFile).then(() => true, () => false);
  const badgeIdx = hasBadge ? input('-loop', '1', '-t', T, '-i', badgeFile) : null;
  const barIdx = input('-f', 'lavfi', '-t', T, '-i', `color=c=${app.theme.accent}:s=${W}x8:r=30`);
  const bgm = await pickBgm(bgmDir);
  const audioIdx = bgm
    ? input('-ss', `${bgm.start}`, '-stream_loop', '-1', '-i', bgm.file)
    : input('-f', 'lavfi', '-t', T, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  const voiceIdx = narration ? input('-i', narration) : null;

  // ── 영상 필터
  const f = [];
  const dx = Math.round(W * (DRIFT - 1));
  const dy = Math.round(H * (DRIFT - 1));
  // 배경: 오른쪽 아래에서 왼쪽 위로 천천히 흐름
  f.push(`[${bgIdx}:v]fps=30,crop=${W}:${H}:x='${dx}*(1-t/${T})':y='${dy}*(1-t/${T})',format=rgba[bg]`);
  f.push(`[bg][${underIdx}:v]overlay=0:0[b0]`);
  let last = '[b0]';
  if (slot) {
    f.push(`[${capIdx}:v]trim=start=0.4,setpts=PTS-STARTPTS,crop=iw*${slot.crop}:ih,scale=${slot.w}:${slot.h},fps=30,format=rgba[capr]`);
    f.push(`[${maskIdx}:v]format=gray,scale=${slot.w}:${slot.h}[mk]`);
    f.push(`[capr][mk]alphamerge[cap]`);
    f.push(`${last}[cap]overlay=${slot.x}:${slot.y}:shortest=0[b1]`);
    f.push(`[b1][${bezelIdx}:v]overlay=0:0[b2]`);
    last = '[b2]';
  }
  items.forEach((it, i) => {
    const s = it.start.toFixed(3);
    const e = it.end.toFixed(3);
    const isCta = it.kind === 'cta';
    // 첫 문구는 첫 프레임부터 보여야 스크롤이 멈춘다 → 움직임 없이 바로. 나머지는 아래에서 올라오며 등장
    const rise = isCta ? 40 : it.kind === 'hook' ? 0 : 46;
    const fadeIn = isCta ? 0.5 : it.kind === 'hook' ? 0.04 : IN;
    let chain = `[${ovIdx[i]}:v]format=rgba,fade=t=in:st=${s}:d=${fadeIn}:alpha=1`;
    const out = it.kind === 'hook' ? 0.45 : OUT; // 첫 문구는 천천히 걷힌다
    if (!isCta) chain += `,fade=t=out:st=${(it.end - out).toFixed(3)}:d=${out}:alpha=1`;
    f.push(`${chain}[o${i}]`);
    // easeOutCubic 으로 올라오며 등장
    const y = `if(lt(t,${s}+${fadeIn}),${rise}*pow(1-(t-${s})/${fadeIn},3),0)`;
    f.push(`${last}[o${i}]overlay=x=0:y='${y}':enable='between(t,${s},${e})'[v${i}]`);
    last = `[v${i}]`;
  });
  if (hasBadge) {
    const cta = items.at(-1);
    // 페이드·이동 없이 고정 표시 (마지막 화면 배경이 다 덮인 뒤에 나타나게 0.5초 뒤)
    f.push(`[${badgeIdx}:v]scale=${BADGE_W}:-1,format=rgba[badge]`);
    f.push(`${last}[badge]overlay=x=${(W - BADGE_W) / 2}:y=${BADGE_Y}:enable='gte(t,${(cta.start + 0.5).toFixed(3)})'[vbd]`);
    last = '[vbd]';
  }
  // 위쪽 진행 바 (스토리처럼 차오름)
  f.push(`${last}[${barIdx}:v]overlay=x='-${W}+${W}*t/${T}':y=0[vb]`);
  f.push(`[vb]format=yuv420p[vout]`);

  // ── 오디오: 배경음악 (나레이션이 있으면 그 밑으로 낮춤)
  const vol = bgm ? (narration ? 0.22 : bgm.volume) : 1;
  f.push(`[${audioIdx}:a]atrim=0:${T},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, total - 1.8).toFixed(3)}:d=1.8,volume=${vol}${narration ? '[music]' : '[aout]'}`);
  if (narration) f.push(`[${voiceIdx}:a]atrim=0:${T}[voice];[music][voice]amix=inputs=2:normalize=0:duration=first[aout]`);

  const out = P('reel.mp4');
  args.push(
    '-filter_complex', f.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', T, '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart', out
  );
  await ffmpeg(args);

  // 미리보기용 썸네일 (hook 화면)
  await ffmpeg(['-y', '-ss', '1.2', '-i', out, '-frames:v', '1', '-vf', 'scale=540:-2', P('thumb.jpg')]);
  await writeFile(P('timeline.json'), JSON.stringify({ total, items: items.map(({ png, ...r }) => r) }, null, 2));
  return { file: out, seconds: total, bgm: bgm ? path.basename(bgm.file) : null, narrated: !!narration, badge: hasBadge };
}
