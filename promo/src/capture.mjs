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
    case 'waitFn':
      // 페이지 안의 조건(JS 식)이 참이 될 때까지 기다린다. 예: 게임 상태 "G.mode === 'bite'"
      return page.waitForFunction(a.fn, null, { timeout: a.ms ?? 60000, polling: 40 });
    case 'clickIf':
      // 조건이 참일 때만 누른다
      if (await page.evaluate(a.fn)) await page.click(a.selector, { timeout: 5000 });
      return;
    case 'pulseUntil': {
      // 버튼을 눌렀다 뗐다 반복 (누르고 있기 조작), 조건이 참이 되면 멈춘다
      const box = await page.locator(a.selector).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const until = Date.now() + (a.ms ?? 60000);
      while (Date.now() < until && !(await page.evaluate(a.fn))) {
        await page.mouse.down();
        await page.waitForTimeout(a.down ?? 450);
        await page.mouse.up();
        await page.waitForTimeout(a.up ?? 150);
      }
      return;
    }
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

/**
 * 3D(WebGL) 앱 녹화: 브라우저 자체 동영상 녹화(recordVideo, 크기 고정)로 통째로 찍고,
 * pause~resume 사이(입질 기다리기 등)는 기록해 둔 시각으로 잘라낸 뒤 이어 붙인다.
 */
async function captureVideoApp(app, outDir, seconds) {
  const landscape = app.orientation === 'landscape';
  const viewport = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const vdir = path.join(outDir, 'video');
  await mkdir(vdir, { recursive: true });
  const browser = await launchBrowser({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const segs = [];
  let videoFile;
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, locale: 'ko-KR', recordVideo: { dir: vdir, size: viewport } });
    // 앱 설정을 미리 심어 둔다 (예: 게임 화질 고정 {"jjinaksi.q": "1"} → 느린 녹화 환경에서 자동 절전 모드 방지)
    // 전체 화면·화면 회전 요청은 무시한다 (녹화 브라우저에서 전체 화면이 되면 화면 크기가 바뀌어 일부만 찍힌다)
    await context.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.resolve();
      if (screen.orientation) screen.orientation.lock = () => Promise.resolve();
    });
    if (app.localStorage) await context.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, app.localStorage);
    const page = await context.newPage();
    const t0 = Date.now();
    const at = () => (Date.now() - t0) / 1000;
    await page.goto(app.url, { waitUntil: 'networkidle', timeout: 30000 });
    let from = at();
    let used = 0;
    // retry: { until: 조건, times, actions: [...] } — 조건이 참이 될 때까지 안쪽 동작을 반복 (예: 원하는 입질이 올 때까지 다시 던지기)
    let cp = null;
    const runAll = async (list) => {
      for (const a of list) {
        if (a.type === 'pause') {
          if (from !== null) segs.push([from, at()]), (used += at() - from), (from = null);
        } else if (a.type === 'resume') {
          if (from === null) from = at();
        } else if (a.type === 'checkpoint') {
          cp = { n: segs.length, used, from };
        } else if (a.type === 'rollbackUnless') {
          // 조건이 거짓이면 checkpoint 이후 녹화를 버리고 멈춤 상태로 되돌린다 (예: 물고기를 놓친 판은 버림)
          if (cp && !(await page.evaluate(a.fn))) (segs.length = cp.n), (used = cp.used), (from = null);
        } else if (a.type === 'retry') {
          for (let i = 0; i < (a.times ?? 5) && !(await page.evaluate(a.until)); i++) await runAll(a.actions ?? []);
        } else await runAction(page, a).catch((e) => console.warn(`  action 실패(${a.type}): ${e.message.split(String.fromCharCode(10))[0]}`));
      }
    };
    await runAll(app.actions ?? []);
    if (from === null) from = at();
    const left = seconds - used - (at() - from);
    if (left > 0) await page.waitForTimeout(left * 1000);
    segs.push([from, at()]);
    await context.close();
    videoFile = await page.video().path();
  } finally {
    await browser.close();
  }
  const f = segs.map(([a, b], i) => `[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[s${i}]`);
  f.push(`${segs.map((_, i) => `[s${i}]`).join('')}concat=n=${segs.length}:v=1:a=0,fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2[out]`);
  const dest = path.join(outDir, 'capture.mp4');
  await ffmpeg(['-y', '-i', videoFile, '-filter_complex', f.join(';'), '-map', '[out]', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '18', dest]);
  return { file: dest, landscape };
}

export async function captureApp(app, outDir, seconds) {
  if (!app.url) return null;
  if (app.webgl) return captureVideoApp(app, outDir, seconds);
  const landscape = app.orientation === 'landscape';
  const viewport = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const frameDir = path.join(outDir, 'frames');
  await mkdir(frameDir, { recursive: true });

  // 3D(WebGL) 앱은 소프트웨어 렌더러로 띄운다 (헤드리스 기본값은 WebGL 이 꺼져 있다)
  const browser = await launchBrowser(app.webgl ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const frames = [];
  // pause/resume 동작으로 기다리는 구간을 영상에서 잘라낸다 (gap 만큼 시간을 당긴다)
  const rec = { on: true, gap: 0, pausedAt: 0 };
  const now = () => Date.now() / 1000;
  try {
    // 3D(WebGL) 앱은 배율 1 (소프트웨어 렌더링이 느리고, 중간에 프레임 크기가 바뀌는 문제를 막는다)
    const context = await browser.newContext({ viewport, deviceScaleFactor: app.webgl ? 1 : 2, isMobile: !landscape, hasTouch: true, locale: 'ko-KR' });
    const page = await context.newPage();
    await page.goto(app.url, { waitUntil: 'networkidle', timeout: 30000 });

    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      if (rec.on) frames.push({ data, t: now() - rec.gap });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    const dpr = app.webgl ? 1 : 2;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: viewport.width * dpr, maxHeight: viewport.height * dpr });
    const started = Date.now();

    const actions = app.actions?.length ? app.actions : [{ type: 'wait', ms: 2500 }, { type: 'scroll', y: 300 }, { type: 'wait', ms: 1500 }];
    for (const a of actions) {
      if (a.type === 'pause') {
        if (rec.on) (rec.on = false), (rec.pausedAt = now());
        continue;
      }
      if (a.type === 'resume') {
        if (!rec.on) (rec.gap += now() - rec.pausedAt), (rec.on = true);
        continue;
      }
      await runAction(page, a).catch((e) => console.warn(`  action 실패(${a.type}): ${e.message}`));
    }
    if (!rec.on) (rec.gap += now() - rec.pausedAt), (rec.on = true);
    const left = seconds * 1000 - (Date.now() - started - rec.gap * 1000);
    if (left > 0) await page.waitForTimeout(left);
    const endT = now() - rec.gap;
    rec.on = false; // 멈춘 뒤 늦게 도착하는 프레임은 버린다
    await cdp.send('Page.stopScreencast');
    if (frames.length) frames.push({ t: endT });
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
