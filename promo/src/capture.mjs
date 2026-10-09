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

/**
 * 앱 화면 녹화 대신 스크린샷 슬라이드로 '앱 화면' 영상을 만든다 (코드·공개 주소가 없는 앱용).
 * apps.json: "slides": { "images": ["assets/apps/<id>/shot-1.png", ...], "crop": "w:h:x:y" }
 * 장면(scene)이 바뀔 때마다 다음 장으로 밀려 넘어가고(slideleft), 각 장은 천천히 확대된다.
 * 첫 장은 hook+첫 장면, k번째 장은 k번째 장면부터. 장이 모자라면 마지막 장을 유지한다.
 */
export async function slideshowApp(app, outDir, items, root) {
  const s = app.slides;
  if (!s?.images?.length) return null;
  const XF = 0.45; // 전환 길이
  const scenes = items.filter((it) => it.kind === 'scene');
  const total = items.at(-1).end;
  const starts = [0, ...scenes.slice(1, s.images.length).map((it) => it.start)];
  const durs = starts.map((t, i) => (starts[i + 1] ?? total) - t);
  const [cw, ch] = (s.crop ?? '').split(':').map(Number);
  const W = 2 * (cw || 412);
  const H = 2 * (ch || 682);
  const args = ['-y'];
  const f = [];
  starts.forEach((_, i) => {
    const d = durs[i] + (i < starts.length - 1 ? XF : 0);
    args.push('-loop', '1', '-t', d.toFixed(3), '-i', path.join(root, s.images[i]));
    const frames = Math.ceil(d * 30);
    f.push(`[${i}:v]${s.crop ? `crop=${s.crop},` : ''}scale=${W * 2}:${H * 2},zoompan=z='1+0.05*on/${frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${W}x${H}:fps=30,setsar=1,format=yuv420p[s${i}]`);
  });
  let last = '[s0]';
  let offset = 0;
  for (let i = 1; i < starts.length; i++) {
    offset += durs[i - 1];
    f.push(`${last}[s${i}]xfade=transition=slideleft:duration=${XF}:offset=${(offset - XF / 2).toFixed(3)}[x${i}]`);
    last = `[x${i}]`;
  }
  const dest = path.join(outDir, 'capture.mp4');
  // render 쪽이 앞 0.4초를 잘라 쓰므로 그만큼 앞에 덧댄다
  await ffmpeg([...args, '-filter_complex', `${f.join(';')};${last}tpad=start_duration=0.4:start_mode=clone[out]`, '-map', '[out]', '-t', (total + 0.4).toFixed(3), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', dest]);
  return { file: dest, landscape: false, aspect: W / H };
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
