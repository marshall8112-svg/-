// 공장 스크립트 공용 함수: 경로, 앱 매니페스트(factory.json), PNG 크기, 명령 실행.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APPS = path.join(ROOT, 'apps');
export const TEMPLATE = path.join(ROOT, 'template');

export const appDir = (slug) => path.join(APPS, slug);

export function requireSlug(slug) {
  if (!slug) fail('앱 slug를 넣어 주세요. 예: node scripts/check.mjs my-app');
  if (!existsSync(path.join(appDir(slug), 'factory.json'))) fail(`apps/${slug}/factory.json 이 없어요. 먼저 new-app 으로 만드세요.`);
  return slug;
}

export async function readManifest(slug) {
  return JSON.parse(await readFile(path.join(appDir(slug), 'factory.json'), 'utf8'));
}

export async function updateManifest(slug, patch) {
  const m = await readManifest(slug);
  const next = deepMerge(m, patch);
  next.updatedAt = new Date().toISOString();
  await writeFile(path.join(appDir(slug), 'factory.json'), JSON.stringify(next, null, 2) + '\n');
  return next;
}

function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
  const out = { ...(typeof a === 'object' && a && !Array.isArray(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
  return out;
}

/** PNG 헤더에서 가로·세로를 읽는다. */
export async function pngSize(file) {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} 은 PNG가 아니에요`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    await fh.close();
  }
}

/** 명령을 실행하고 출력을 그대로 보여주면서 모아서 돌려준다. */
export function run(cmd, args, { cwd = ROOT, env, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: process.platform === 'win32' });
    let out = '';
    const onData = (d) => {
      out += d;
      if (!quiet) process.stdout.write(d);
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} ${args.join(' ')} 실패 (exit ${code})`), { out }))));
  });
}

export function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

// 토스 브랜드 블루 계열은 앱 대표색으로 쓰지 않는다 (검수에서 토스 사칭으로 보일 수 있음).
export function isTossBlue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max !== b || d < 0.35) return false;
  const hue = 60 * ((r - g) / d + 4);
  return hue >= 205 && hue <= 230;
}

export const ASSET_SPECS = [
  { file: 'logo.png', width: 600, height: 600 },
  { file: 'thumbnail.png', width: 1932, height: 828 },
  { file: 'screenshot-1.png', width: 636, height: 1048 },
  { file: 'screenshot-2.png', width: 636, height: 1048 },
  { file: 'screenshot-3.png', width: 636, height: 1048 },
];
