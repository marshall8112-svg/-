// 인스타 프로필 사진 후보 3종 (1080×1080 PNG). 원형으로 잘려도 보이게 가운데에 모은다.
// 사용: node src/profile-images.mjs → assets/profile/profile-{1,2,3}.png + preview.png(원형 미리보기)
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'profile');
const S = 1080;
const FONT = `@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@900&display=block');`;
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONT}
html,body{margin:0;width:${S}px;height:${S}px;overflow:hidden;font-family:'Noto Sans KR',sans-serif}</style></head><body>${body}</body></html>`;

const designs = [
  // 1) 앱 서랍: 내가 만든 미니앱 이모지가 둥근 타일로
  page(`<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 25%,#ff9a62,#ff5f6d 45%,#7b2ff7)"></div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(3,200px);gap:34px">
    ${['💰', '🚪', '🦶', '🎞️', '✨', '✈️', '🔮', '🐜', '🎯']
      .map((e, i) => `<div style="width:200px;height:200px;border-radius:56px;background:${i === 4 ? '#fff' : 'rgba(255,255,255,.2)'};display:grid;place-items:center;font-size:${i === 4 ? 128 : 112}px;box-shadow:0 14px 34px rgba(0,0,0,.18)">${e}</div>`)
      .join('')}
  </div>`),
  // 2) 큰 글자: "미니앱" — 작게 보여도 읽히게
  page(`<div style="position:absolute;inset:0;background:#ffd23f"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 75% 20%,#fff6c4,transparent 45%)"></div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);text-align:center">
    <div style="font-family:'Black Han Sans',sans-serif;font-size:300px;line-height:.95;color:#1a1a2e;letter-spacing:-8px">미니<br>앱</div>
  </div>
  <div style="position:absolute;right:150px;top:130px;font-size:140px;transform:rotate(14deg)">✨</div>
  <div style="position:absolute;left:200px;bottom:200px;width:120px;height:120px;border-radius:36px;background:#ff5f6d;transform:rotate(-14deg);box-shadow:0 12px 30px rgba(0,0,0,.2)"></div>`),
  // 3) 폰 캐릭터: 웃는 휴대폰 + 반짝임 (계정 마스코트)
  page(`<div style="position:absolute;inset:0;background:linear-gradient(160deg,#12a06a,#0b3d2e)"></div>
  <div style="position:absolute;left:50%;top:50%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(circle,rgba(255,209,102,.35),transparent 62%)"></div>
  <div style="position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-8deg);width:420px;height:700px;border-radius:84px;background:#151520;box-shadow:0 40px 80px rgba(0,0,0,.4)">
    <div style="position:absolute;inset:22px;border-radius:64px;background:linear-gradient(180deg,#fff8e1,#ffd166)">
      <div style="position:absolute;left:96px;top:230px;width:56px;height:76px;border-radius:50%;background:#151520"></div>
      <div style="position:absolute;right:96px;top:230px;width:56px;height:76px;border-radius:50%;background:#151520"></div>
      <div style="position:absolute;left:50%;top:350px;width:170px;height:85px;margin-left:-85px;border:16px solid #151520;border-top:0;border-radius:0 0 100px 100px"></div>
      <div style="position:absolute;left:58px;top:330px;width:58px;height:34px;border-radius:50%;background:#ff8a80;opacity:.8"></div>
      <div style="position:absolute;right:58px;top:330px;width:58px;height:34px;border-radius:50%;background:#ff8a80;opacity:.8"></div>
    </div>
  </div>
  <div style="position:absolute;left:150px;top:170px;font-size:130px">✨</div>
  <div style="position:absolute;right:140px;bottom:180px;font-size:110px">⚡</div>`)
];

await mkdir(OUT, { recursive: true });
const browser = await launchBrowser();
try {
  const p = await browser.newPage({ viewport: { width: S, height: S } });
  for (const [i, html] of designs.entries()) {
    await p.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `profile-${i + 1}.png`) });
  }
  // 원형으로 잘린 모습 + 실제 크기(110px) 미리보기
  await p.setViewportSize({ width: 1260, height: 560 });
  const img = (i, size) => `<img src="file:///${path.join(OUT, `profile-${i}.png`).replace(/\\/g, '/')}" style="width:${size}px;height:${size}px;border-radius:50%;display:block">`;
  await p.goto(`file:///${OUT.replace(/\\/g, '/')}/`);
  await p.setContent(
    `<body style="margin:0;background:#fff;font-family:sans-serif;display:flex;gap:40px;padding:30px">${[1, 2, 3]
      .map((i) => `<div style="text-align:center">${img(i, 360)}<div style="display:flex;gap:16px;justify-content:center;align-items:center;margin-top:24px">${img(i, 110)}${img(i, 56)}</div><div style="margin-top:12px;font-size:28px;font-weight:700">${i}</div></div>`)
      .join('')}</body>`
  );
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'preview.png') });
} finally {
  await browser.close();
}
console.log('✔ assets/profile/profile-1~3.png, preview.png');
