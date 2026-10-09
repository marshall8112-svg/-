// 배경음악 폴더를 분석해 assets/bgm/ 으로 가져온다. 곡마다 옆에 .json 을 둔다:
//   start  : 가장 에너지가 높은 20초 구간의 시작(초) — 그 지점부터 깐다
//   tempo  : 느린 곡이면 1.0~1.2 (atempo, 음높이는 그대로) — 릴스 리듬에 맞게 조금 빠르게
//   volume : 곡마다 크기를 비슷하게 맞추는 배율
//   bpm    : 추정 BPM (참고용)
// 사용: node src/bgm-analyze.mjs <음악 폴더> [--target-bpm 112] [--max-tempo 1.2]
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'target-bpm': { type: 'string', default: '112' }, 'max-tempo': { type: 'string', default: '1.2' }, window: { type: 'string', default: '20' } }
});
const SRC = path.resolve(positionals[0] ?? '');
const DEST = path.join(ROOT, 'assets', 'bgm');
const FF = process.env.FFMPEG_PATH || 'ffmpeg';
const SR = 11025;
const HOP = 256; // ~23ms

function run(args, binary = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(FF, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? resolve(binary ? Buffer.concat(out) : err) : reject(new Error(err.slice(-500)))));
  });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track';

async function analyze(file) {
  const info = await run(['-hide_banner', '-i', file, '-f', 'null', '-'], false).catch((e) => e.message);
  const title = info.match(/title\s*:\s*(.+)/)?.[1]?.trim() ?? path.parse(file).name;
  const pcm = await run(['-v', 'error', '-i', file, '-ac', '1', '-ar', `${SR}`, '-f', 's16le', '-'], true);
  const x = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const n = Math.floor(x.length / HOP);
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += (x[j] / 32768) ** 2;
    env[i] = Math.sqrt(s / HOP);
  }
  const fps = SR / HOP;
  const dur = x.length / SR;

  // 1) 가장 시끄러운 window 초 구간 (처음 5초·끝 12초 제외)
  const win = Math.round(Number(o.window) * fps);
  let best = 0;
  let bestAt = Math.round(5 * fps);
  let acc = 0;
  const lo = Math.round(5 * fps);
  const hi = Math.max(lo + 1, n - win - Math.round(12 * fps));
  for (let i = lo; i < lo + win && i < n; i++) acc += env[i];
  for (let i = lo; i < hi; i++) {
    if (acc > best) (best = acc), (bestAt = i);
    acc += (env[i + win] ?? 0) - env[i];
  }
  const start = Math.round((bestAt / fps) * 10) / 10;

  // 2) BPM: 로그 에너지 증가분(onset) 의 자기상관, 70~140 BPM 범위로 접는다
  const on = new Float64Array(n);
  for (let i = 1; i < n; i++) on[i] = Math.max(0, Math.log(1e-4 + env[i]) - Math.log(1e-4 + env[i - 1]));
  const seg = on.subarray(bestAt, Math.min(n, bestAt + win * 2));
  const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
  let bpm = 0;
  let bestR = -Infinity;
  for (let b = 60; b <= 180; b += 0.5) {
    const lag = (60 / b) * fps;
    let r = 0;
    for (let i = 0; i + lag + 1 < seg.length; i++) {
      const l = Math.floor(lag);
      const f = lag - l;
      const y = seg[i + l] * (1 - f) + seg[i + l + 1] * f;
      r += (seg[i] - mean) * (y - mean);
    }
    r *= 1 - 0.15 * Math.abs(Math.log2(b / 115)); // 사람 귀에 흔한 템포 쪽으로 살짝 가중
    if (r > bestR) (bestR = r), (bpm = b);
  }
  while (bpm > 140) bpm /= 2;
  while (bpm < 70) bpm *= 2;

  const target = Number(o['target-bpm']);
  const tempo = Math.round(Math.min(Number(o['max-tempo']), Math.max(1, target / bpm)) * 100) / 100;

  // 3) 음량: 선택 구간 평균 RMS → 목표에 맞춘 배율
  const rms = Math.sqrt(env.subarray(bestAt, bestAt + win).reduce((a, b) => a + b * b, 0) / win);
  const db = 20 * Math.log10(rms + 1e-9);
  const volume = Math.round(Math.min(1.4, Math.max(0.5, 10 ** ((-17 - db) / 20) * 0.85)) * 100) / 100;
  return { title, start, tempo, volume, bpm: Math.round(bpm), seconds: Math.round(dur) };
}

await mkdir(DEST, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
const rows = [];
for (const f of files) {
  const a = await analyze(path.join(SRC, f));
  const name = slug(a.title);
  const ext = path.extname(f).toLowerCase();
  await copyFile(path.join(SRC, f), path.join(DEST, name + ext));
  await writeFile(path.join(DEST, name + '.json'), JSON.stringify({ ...a, source: f }, null, 2) + '\n');
  rows.push(`${f.padEnd(7)} ${a.title.padEnd(28)} bpm≈${String(a.bpm).padStart(3)}  tempo×${a.tempo.toFixed(2)}  start ${a.start}s  vol ${a.volume}`);
  console.log(rows.at(-1));
}
console.log(`✔ ${files.length}곡 → ${path.relative(ROOT, DEST)}`);
