// Playwright로 미니앱 웹 화면을 모바일 크기로 녹화한다. url이 없으면 건너뛴다.
// Chrome 화면 캐스트(CDP) 프레임을 받아 FFmpeg로 mp4를 만든다.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function launchBrowser(opts = {}) {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, ...opts });
}

export function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => (err = (err + d).slice(-4000)));
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 실패 (${code})\n${err}`))));
  });
}

async function runAction(page, a) {
  switch (a.type) {
    case 'wait':
      return page.waitForTimeout(a.ms ?? 1000);
    case 'click':
      return page.click(a.selector, { timeout: 5000 });
    case 'tap':
      return page.mouse.click(a.x, a.y);
    case 'fill':
      return page.fill(a.selector, a.value ?? '', { timeout: 5000 });
    case 'type':
      return page.keyboard.type(a.value ?? '', { delay: 80 });
    case 'upload':
      return page.setInputFiles(a.selector, a.file);
    case 'scroll':
      return page.mouse.wheel(0, a.y ?? 400);
    default:
      throw new Error(`알 수 없는 action: ${a.type}`);
  }
}

export async function captureApp(app, outDir, seconds) {
  if (!app.url) return null;
  const landscape = app.orientation === 'landscape';
  const viewport = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const frameDir = path.join(outDir, 'frames');
  await mkdir(frameDir, { recursive: true });

  const browser = await launchBrowser();
  const frames = [];
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: !landscape, hasTouch: true, locale: 'ko-KR' });
    const page = await context.newPage();
    await page.goto(app.url, { waitUntil: 'networkidle', timeout: 30000 });

    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      frames.push({ data, t: metadata.timestamp ?? Date.now() / 1000 });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: viewport.width * 2, maxHeight: viewport.height * 2 });
    const started = Date.now();

    const actions = app.actions?.length ? app.actions : [{ type: 'wait', ms: 2500 }, { type: 'scroll', y: 300 }, { type: 'wait', ms: 1500 }];
    for (const a of actions) {
      await runAction(page, a).catch((e) => console.warn(`  action 실패(${a.type}): ${e.message}`));
    }
    const left = seconds * 1000 - (Date.now() - started);
    if (left > 0) await page.waitForTimeout(left);
    await cdp.send('Page.stopScreencast');
    if (frames.length) frames.push({ t: frames[0].t + (Date.now() - started) / 1000 });
  } finally {
    await browser.close();
  }
  if (frames.length < 3) return null;

  // 화면이 바뀔 때만 프레임이 오므로, 프레임마다 보여줄 시간을 기록해 이어 붙인다.
  const list = [];
  for (let i = 0; i < frames.length - 1; i++) {
    const file = path.join(frameDir, `f${String(i).padStart(5, '0')}.jpg`);
    await writeFile(file, Buffer.from(frames[i].data, 'base64'));
    list.push(`file '${file}'`, `duration ${Math.max(0.001, frames[i + 1].t - frames[i].t).toFixed(3)}`);
  }
  list.push(list.at(-2)); // concat 형식상 마지막 파일을 한 번 더
  const listFile = path.join(frameDir, 'list.txt');
  await writeFile(listFile, list.join('\n'));

  const dest = path.join(outDir, 'capture.mp4');
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '18', dest]);
  return { file: dest, landscape };
}
