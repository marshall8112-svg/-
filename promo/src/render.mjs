// 기획안 + (있으면) 앱 화면 녹화를 1080x1920 릴스 영상으로 합성한다.
// 글자 레이어는 HTML을 투명 PNG로 찍고, FFmpeg로 겹친다.
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, ffmpeg } from './capture.mjs';

const W = 1080;
const H = 1920;
export const HOOK_SEC = 2.2;
export const CTA_SEC = 3;
const LANDSCAPE_CROP = 0.62;
const FONT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@700;900&display=block');`;
const FONT_STACK = `'Noto Sans KR', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', 'WenQuanYi Zen Hei', sans-serif`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/\\n|\n/g, '<br>');

function page(body, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:${FONT_STACK};word-break:keep-all}
  ${extraCss}</style></head><body>${body}</body></html>`;
}

// 배경: 그라데이션 + 큰 이모지 + 하단 계정명. 녹화 화면이 들어갈 자리에 그림자 박스.
function bgHtml(app, account, slot) {
  const { bg1, bg2 } = app.theme;
  const slotBox = slot
    ? `<div style="position:absolute;left:${slot.x - 6}px;top:${slot.y - 6}px;width:${slot.w + 12}px;height:${slot.h + 12}px;border-radius:44px;background:#000;box-shadow:0 30px 80px rgba(0,0,0,.55)"></div>`
    : '';
  return page(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${bg1},${bg2})"></div>
     <div style="position:absolute;right:-80px;bottom:120px;font-size:520px;opacity:.12;transform:rotate(-12deg)">${app.emoji}</div>
     ${slotBox}
     <div style="position:absolute;bottom:56px;width:100%;text-align:center;color:rgba(255,255,255,.55);font-size:34px;font-weight:700">${esc(account.handle)}</div>`
  );
}

function hookHtml(text, app) {
  return page(
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 70px">
      <div style="background:rgba(0,0,0,.72);border-radius:36px;padding:48px 56px;text-align:center;color:#fff;font-family:'Black Han Sans',${FONT_STACK};font-size:104px;line-height:1.18;box-shadow:0 20px 60px rgba(0,0,0,.4)">
        ${esc(text)}<div style="height:10px"></div><span style="color:${app.theme.accent};font-size:60px">${app.emoji}</span>
      </div></div>`
  );
}

function sceneHtml(text, app, hasCapture) {
  const pos = hasCapture ? 'top:110px' : 'top:0;bottom:0';
  return page(
    `<div style="position:absolute;left:0;right:0;${pos};display:flex;align-items:center;justify-content:center;padding:0 60px">
      <div style="background:#fff;color:#111;border-radius:28px;padding:30px 44px;font-weight:900;font-size:${hasCapture ? 66 : 84}px;line-height:1.28;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.35)">
        ${esc(text).replace(/\*(.+?)\*/g, `<span style="color:#3182f6">$1</span>`)}
      </div></div>`
  );
}

function ctaHtml(plan, app, account) {
  const { bg1, bg2, accent } = app.theme;
  return page(
    `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${bg1}f2,${bg2}f2);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:0 80px">
      <div style="font-size:220px">${app.emoji}</div>
      <div style="font-family:'Black Han Sans',${FONT_STACK};font-size:118px;margin-top:20px">${esc(app.name)}</div>
      <div style="font-size:50px;font-weight:700;opacity:.85;margin-top:18px">${esc(app.tagline)}</div>
      <div style="margin-top:90px;background:#fff;color:#191f28;border-radius:999px;padding:30px 56px;font-size:54px;font-weight:900;display:flex;align-items:center;gap:20px">
        <span style="color:#3182f6">🔍</span>${esc(app.keyword)}
      </div>
      <div style="margin-top:34px;font-size:46px;font-weight:900;color:${accent}">${esc(plan.cta)}</div>
      <div style="margin-top:20px;font-size:34px;opacity:.7">${esc(account.searchHint)}</div>
    </div>`
  );
}

async function shoot(browser, html, file) {
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  await p.setContent(html, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: true });
  await p.close();
}

async function pickBgm(assetsDir) {
  const files = (await readdir(assetsDir).catch(() => [])).filter((f) => /\.(mp3|m4a|wav|aac)$/i.test(f));
  return files.length ? path.join(assetsDir, files[Math.floor(Math.random() * files.length)]) : null;
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
  let slot = null;
  if (capture) {
    // 가로 화면은 가운데 62%만 잘라서 세로 영상에 크게 넣는다
    slot = capture.landscape ? { w: 1000, h: Math.round((1000 * 390) / (844 * LANDSCAPE_CROP)), crop: LANDSCAPE_CROP } : { h: 1360, w: Math.round((1360 * 390) / 844), crop: 1 };
    slot.x = Math.round((W - slot.w) / 2);
    slot.y = capture.landscape ? 600 : 380;
  }

  const browser = await launchBrowser();
  const bgPng = path.join(outDir, 'bg.png');
  try {
    await shoot(browser, bgHtml(app, account, slot), bgPng);
    for (const [i, it] of items.entries()) {
      it.png = path.join(outDir, `ov_${i}.png`);
      const html = it.kind === 'hook' ? hookHtml(it.text, app) : it.kind === 'cta' ? ctaHtml(plan, app, account) : sceneHtml(it.text, app, !!capture);
      await shoot(browser, html, it.png);
    }
  } finally {
    await browser.close();
  }

  const args = ['-y', '-loop', '1', '-t', `${total}`, '-i', bgPng];
  let n = 1;
  let capIdx = null;
  if (capture) {
    args.push('-stream_loop', '-1', '-i', capture.file);
    capIdx = n++;
  }
  const firstOv = n;
  for (const it of items) {
    args.push('-loop', '1', '-t', `${total}`, '-i', it.png);
    n++;
  }
  const bgm = await pickBgm(bgmDir);
  if (bgm) args.push('-stream_loop', '-1', '-i', bgm);
  else args.push('-f', 'lavfi', '-t', `${total}`, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  const audioIdx = n++;
  const voiceIdx = narration ? n++ : null;
  if (narration) args.push('-i', narration);

  const f = [];
  let last = '[0:v]';
  if (capture) {
    f.push(`[${capIdx}:v]trim=start=0.4,setpts=PTS-STARTPTS,crop=iw*${slot.crop}:ih,scale=${slot.w}:${slot.h},fps=30[cap]`);
    f.push(`${last}[cap]overlay=${slot.x}:${slot.y}:shortest=0[b0]`);
    last = '[b0]';
  }
  items.forEach((it, i) => {
    // 글자 레이어는 0.18초 페이드인
    f.push(`[${firstOv + i}:v]format=rgba,fade=t=in:st=${it.start}:d=0.18:alpha=1[o${i}]`);
    f.push(`${last}[o${i}]overlay=0:0:enable='between(t,${it.start},${it.end})'[v${i}]`);
    last = `[v${i}]`;
  });
  f.push(`${last}format=yuv420p[vout]`);
  // 나레이션이 있으면 배경음악은 목소리 밑으로 깔리게 줄인다
  const bgmVol = bgm ? (narration ? 0.22 : 0.8) : 1;
  f.push(`[${audioIdx}:a]atrim=0:${total},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5,volume=${bgmVol}${narration ? '[music]' : '[aout]'}`);
  if (narration) f.push(`[${voiceIdx}:a]atrim=0:${total}[voice];[music][voice]amix=inputs=2:normalize=0:duration=first[aout]`);

  const out = path.join(outDir, 'reel.mp4');
  args.push(
    '-filter_complex', f.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', `${total}`, '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart', out
  );
  await ffmpeg(args);

  // 미리보기용 썸네일 (hook 화면)
  await ffmpeg(['-y', '-ss', '1', '-i', out, '-frames:v', '1', '-vf', 'scale=540:-2', path.join(outDir, 'thumb.jpg')]);
  await writeFile(path.join(outDir, 'timeline.json'), JSON.stringify({ total, items: items.map(({ png, ...r }) => r) }, null, 2));
  return { file: out, seconds: total, bgm: bgm ? path.basename(bgm) : null, narrated: !!narration };
}
