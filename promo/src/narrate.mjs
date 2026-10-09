// 자막을 읽어 주는 나레이션 트랙을 만든다 (무료 TTS).
// 지금은 Windows 내장 한국어 음성(SAPI, 기본 'Microsoft Heami Desktop')만 지원한다.
// 다른 OS거나 음성이 없으면 null 을 돌려주고, 영상은 나레이션 없이 만들어진다.
// 나중에 유료 TTS로 바꿀 때는 sapiBatch() 자리에 그 서비스 호출만 넣으면 된다 (문장별 wav 를 만들면 됨).
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg } from './capture.mjs';

const VOICE = process.env.TTS_VOICE || 'Microsoft Heami Desktop';
const RATE = Number(process.env.TTS_RATE ?? 2); // SAPI -10~10
const GAP = 0.25; // 문장 뒤 여유(초)

/** 자막 → 읽을 문장. 강조 별표·줄바꿈·ㅋㅋ 같은 자모는 읽지 않게 정리한다. */
export function speakable(text) {
  return String(text)
    .replace(/\\n|\n/g, ' ')
    .replace(/\*/g, '')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]+/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** timeline 항목 순서(hook, scenes..., cta)대로 읽을 문장 */
export function narrationLines(plan, app) {
  return [plan.hook, ...plan.scenes.map((s) => s.text), `${plan.cta} 토스에서 ${app.keyword} 검색!`].map(speakable);
}

function sapiBatch(jobs, dir) {
  const script = `
Add-Type -AssemblyName System.Speech
$jobs = Get-Content -Raw -Encoding UTF8 '${path.join(dir, 'jobs.json')}' | ConvertFrom-Json
foreach ($j in $jobs) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice('${VOICE}')
  $s.Rate = ${RATE}
  $s.SetOutputToWaveFile($j.file)
  $s.Speak($j.text)
  $s.Dispose()
}`;
  return new Promise(async (resolve, reject) => {
    await writeFile(path.join(dir, 'jobs.json'), JSON.stringify(jobs));
    await writeFile(path.join(dir, 'tts.ps1'), '﻿' + script);
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(dir, 'tts.ps1')], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`TTS 실패 (${code}) ${err.slice(-500)}`))));
  });
}

/** WAV 의 data 청크 길이로 재생 시간(초)을 구한다 */
async function wavSeconds(file) {
  const b = await readFile(file);
  let byteRate = 0;
  for (let i = 12; i < b.length - 8; ) {
    const id = b.toString('ascii', i, i + 4);
    const size = b.readUInt32LE(i + 4);
    if (id === 'fmt ') byteRate = b.readUInt32LE(i + 16);
    if (id === 'data') return size / byteRate;
    i += 8 + size + (size % 2);
  }
  throw new Error(`WAV 형식을 읽을 수 없어요: ${file}`);
}

/**
 * 문장마다 음성 파일을 만들고 앞뒤 무음을 잘라 길이를 잰다.
 * @returns {Promise<{file:string, seconds:number}[] | null>}
 */
export async function synthesize(lines, outDir) {
  if (process.platform !== 'win32' || process.env.TTS_DISABLE === '1') return null;
  const dir = path.join(outDir, 'tts');
  await mkdir(dir, { recursive: true });
  const jobs = lines.map((text, i) => ({ text, file: path.join(dir, `raw_${i}.wav`) }));
  await sapiBatch(jobs.filter((j) => j.text), dir);
  const out = [];
  for (const [i, j] of jobs.entries()) {
    if (!j.text) {
      out.push(null);
      continue;
    }
    const file = path.join(dir, `line_${i}.wav`);
    const trim = 'silenceremove=start_periods=1:start_threshold=-45dB';
    await ffmpeg(['-y', '-i', j.file, '-af', `${trim},areverse,${trim},areverse,aresample=48000`, '-ac', '1', '-map_metadata', '-1', '-bitexact', file]);
    out.push({ file, seconds: await wavSeconds(file) });
  }
  return out;
}

/** 말이 자막 시간보다 길면 그 자막을 늘린다 (hook·cta 포함) */
export function fitPlan(plan, voiced, { hookSec, ctaSec }) {
  const need = (i, cur) => (voiced[i] ? Math.max(cur, +(voiced[i].seconds + GAP).toFixed(2)) : cur);
  plan.hookSeconds = need(0, hookSec);
  plan.scenes = plan.scenes.map((s, i) => ({ ...s, seconds: need(i + 1, s.seconds) }));
  plan.ctaSeconds = need(voiced.length - 1, ctaSec);
  return plan;
}

/** 각 문장을 해당 자막 시작 시각에 놓아 하나의 트랙으로 합친다 */
export async function buildTrack(items, voiced, total, outDir) {
  const parts = items.map((it, i) => voiced[i] && { file: voiced[i].file, at: it.start + 0.12 }).filter(Boolean);
  if (!parts.length) return null;
  const args = ['-y'];
  for (const p of parts) args.push('-i', p.file);
  const f = parts.map((p, i) => `[${i}:a]adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`);
  f.push(`${parts.map((_, i) => `[a${i}]`).join('')}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${total},loudnorm=I=-16:TP=-1.5[out]`);
  const file = path.join(outDir, 'narration.wav');
  await ffmpeg([...args, '-filter_complex', f.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', file]);
  return file;
}
