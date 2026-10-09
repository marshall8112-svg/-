// 릴스용 배경음악을 코드로 합성한다 (저작권 걱정 없는 자작 음원).
// 4코드 루프 + 베이스 + 아르페지오 + 킥/하이햇. 결과는 assets/bgm/<name>.mp3
// 사용: node src/bgm-synth.mjs [--name upbeat] [--bpm 112] [--seconds 24] [--key 0] [--prog 0,7,9,5]
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ffmpeg } from './capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: o } = parseArgs({
  options: {
    name: { type: 'string', default: 'upbeat' },
    bpm: { type: 'string', default: '112' },
    seconds: { type: 'string', default: '24' },
    key: { type: 'string', default: '0' }, // C 기준 반음 이동
    prog: { type: 'string', default: '0,7,9,5' } // I-V-vi-IV (근음 반음)
  }
});

const SR = 44100;
const bpm = Number(o.bpm);
const beat = 60 / bpm;
const total = Number(o.seconds);
const key = Number(o.key);
const prog = o.prog.split(',').map(Number);
const minorRoots = new Set([9, 2, 4]); // vi, ii, iii 는 단조
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

const L = new Float32Array(Math.ceil(SR * total));
const R = new Float32Array(L.length);
const add = (t0, dur, fn, gainL = 1, gainR = 1) => {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n && s0 + i < L.length; i++) {
    const v = fn(i / SR);
    L[s0 + i] += v * gainL;
    R[s0 + i] += v * gainR;
  }
};
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);
const tri = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));

const bar = beat * 4;
for (let b = 0; b * bar < total; b++) {
  const root = 48 + key + prog[b % prog.length];
  const third = minorRoots.has(prog[b % prog.length]) ? 3 : 4;
  const chord = [root, root + third, root + 7];
  const t0 = b * bar;
  // 패드: 부드러운 사인 화음
  for (const [k, n] of chord.entries())
    add(t0, bar, (t) => 0.05 * Math.sin(2 * Math.PI * midi(n + 12) * t) * Math.min(1, t / 0.08, (bar - t) / 0.1), k === 1 ? 0.7 : 1, k === 1 ? 1 : 0.7);
  // 베이스: 8분음표 근음
  for (let e = 0; e < 8; e++)
    add(t0 + e * beat / 2, beat / 2, (t) => 0.16 * tri(midi(root - 12), t) * env(t, 0.005, 0.18));
  // 아르페지오: 16분음표 플럭
  const arp = [chord[0] + 24, chord[1] + 24, chord[2] + 24, chord[1] + 24];
  for (let s = 0; s < 16; s++) {
    const n = arp[s % 4];
    const pan = s % 2 ? [0.6, 1] : [1, 0.6];
    add(t0 + s * beat / 4, beat / 4, (t) => 0.06 * (Math.sin(2 * Math.PI * midi(n) * t) + 0.3 * Math.sin(4 * Math.PI * midi(n) * t)) * env(t, 0.003, 0.07), ...pan);
  }
  // 드럼: 킥(1·3박), 클랩 느낌 노이즈(2·4박), 하이햇(8분 뒷박)
  for (let q = 0; q < 4; q++) {
    const tb = t0 + q * beat;
    if (q % 2 === 0) add(tb, 0.25, (t) => 0.5 * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14));
    else add(tb, 0.15, (t) => 0.12 * (Math.random() * 2 - 1) * Math.exp(-t * 25));
    add(tb + beat / 2, 0.05, (t) => 0.05 * (Math.random() * 2 - 1) * Math.exp(-t * 90), 0.8, 1);
  }
}

// 정규화 + 16bit WAV
let peak = 0;
for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak;
const data = Buffer.alloc(L.length * 4);
for (let i = 0; i < L.length; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);

const dir = path.join(ROOT, 'assets', 'bgm');
await mkdir(dir, { recursive: true });
const wav = path.join(dir, `${o.name}.tmp.wav`);
const mp3 = path.join(dir, `${o.name}.mp3`);
await writeFile(wav, Buffer.concat([h, data]));
await ffmpeg(['-y', '-i', wav, '-af', 'afade=t=out:st=' + (total - 1.5) + ':d=1.5', '-c:a', 'libmp3lame', '-b:a', '160k', mp3]);
await rm(wav);
console.log(`✔ ${path.relative(ROOT, mp3)} (${total}초, ${bpm}BPM)`);
