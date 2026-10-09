// 콘솔 등록용 이미지를 정확한 규격으로 만든다 (apps/<slug>/assets/).
//   logo.png 600×600 · thumbnail.png 1932×828 · screenshot-1~3.png 636×1048
// 스크린샷은 실제 앱 빌드를 모바일 화면으로 띄워 factory.json 의 shots 동작대로 찍는다.
// 사용: node scripts/assets.mjs <slug> [--skip-build]
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { ASSET_SPECS, appDir, pngSize, readManifest, requireSlug, run, updateManifest } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { 'skip-build': { type: 'boolean', default: false } } });
const slug = requireSlug(positionals[0]);
const dir = appDir(slug);
const m = await readManifest(slug);
const out = path.join(dir, 'assets');
await mkdir(out, { recursive: true });

if (!opt['skip-build']) await run('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: dir });

// dist 를 정적으로 띄운다.
const dist = path.join(dir, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith(path.sep) || p === dist ? path.join(p, 'index.html') : p;
  const body = await readFile(file).catch(() => null);
  if (!body) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const font = `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  // 로고: 브랜드 색 배경 + 대표 이모지
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;width:600px;height:600px;display:grid;place-items:center;background:${m.color}">
    <div style="font-size:340px;line-height:1">${esc(m.emoji)}</div></body>`);
  await page.screenshot({ path: path.join(out, 'logo.png') });

  // 썸네일: 왼쪽 문구, 오른쪽 이모지
  await page.setViewportSize({ width: 1932, height: 828 });
  await page.setContent(`<body style="margin:0;width:1932px;height:828px;display:flex;align-items:center;justify-content:space-between;
    padding:0 160px;box-sizing:border-box;background:linear-gradient(135deg, ${m.color}, color-mix(in srgb, ${m.color} 55%, #000));color:#fff;font-family:${font}">
    <div><div style="font-size:120px;font-weight:800;letter-spacing:-2px">${esc(m.title)}</div>
    <div style="font-size:56px;margin-top:28px;opacity:.9">${esc(m.tagline)}</div></div>
    <div style="font-size:420px;line-height:1">${esc(m.emoji)}</div></body>`);
  await page.screenshot({ path: path.join(out, 'thumbnail.png') });
  await page.close();

  // 스크린샷: 318×524 CSS px × 2배 = 636×1048
  const ctx = await browser.newContext({ viewport: { width: 318, height: 524 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const shots = m.shots?.length ? m.shots : [{ name: 'screenshot-1', actions: [] }];
  for (const [i, shot] of shots.entries()) {
    const p = await ctx.newPage();
    await p.goto(base, { waitUntil: 'networkidle' });
    for (const a of shot.actions ?? []) {
      try {
        if (a.type === 'wait') await p.waitForTimeout(a.ms ?? 800);
        else if (a.type === 'click') await p.click(a.selector, { timeout: 5000 });
        else if (a.type === 'fill') await p.fill(a.selector, a.value ?? '', { timeout: 5000 });
        else if (a.type === 'scroll') await p.mouse.wheel(0, a.y ?? 400);
      } catch (e) {
        console.warn(`  ${shot.name} 동작 실패 (${a.type} ${a.selector ?? ''}): ${e.message.split('\n')[0]}`);
      }
    }
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(out, `${shot.name ?? `screenshot-${i + 1}`}.png`) });
    await p.close();
  }
} finally {
  await browser.close();
  server.close();
}

// 규격 검증
let ok = true;
for (const s of ASSET_SPECS) {
  const f = path.join(out, s.file);
  const size = await pngSize(f).catch(() => null);
  const good = size && size.width === s.width && size.height === s.height;
  ok &&= !!good;
  console.log(`${good ? '✔' : '✖'} assets/${s.file} ${size ? `${size.width}×${size.height}` : '없음'} (필요 ${s.width}×${s.height})`);
}
await updateManifest(slug, { steps: { assets: ok ? 'done' : 'todo' } });
if (!ok) process.exit(1);
