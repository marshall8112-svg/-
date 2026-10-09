// 공장 현황: 앱마다 단계별 진행 상태를 보여준다. 결과를 factory.json 에 기록할 때도 쓴다.
// 사용: node scripts/status.mjs                         (전체 현황)
//       node scripts/status.mjs <slug> --set key=value  (예: console.miniAppId=123 steps.upload=done bundle.status=CREATED)
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { APPS, readManifest, requireSlug, updateManifest } from './lib.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { set: { type: 'string', multiple: true } } });

const sets = opt.set?.length ? [...opt.set, ...positionals.slice(1)] : [];
if (sets.length) {
  const slug = requireSlug(positionals[0]);
  const patch = {};
  for (const kv of sets) {
    if (!kv.includes('=')) throw new Error(`key=value 형식이 아니에요: ${kv}`);
    const i = kv.indexOf('=');
    const keys = kv.slice(0, i).split('.');
    let v = kv.slice(i + 1);
    if (v === 'null') v = null;
    else if (/^-?\d+$/.test(v) && v.length < 16) v = Number(v);
    let o = patch;
    keys.slice(0, -1).forEach((k) => (o = o[k] ??= {}));
    o[keys.at(-1)] = v;
  }
  await updateManifest(slug, patch);
  console.log(`✔ ${slug} 갱신:`, JSON.stringify(patch));
  process.exit(0);
}

const icon = { done: '✅', todo: '⬜', skip: '➖', fail: '❌' };
const slugs = positionals.length
  ? positionals
  : (await readdir(APPS, { withFileTypes: true })).filter((e) => e.isDirectory() && existsSync(path.join(APPS, e.name, 'factory.json'))).map((e) => e.name);
if (!slugs.length) console.log('아직 만든 앱이 없어요.');
for (const slug of slugs) {
  const m = await readManifest(slug);
  console.log(`\n${m.emoji} ${m.title} (${m.appName})  콘솔 앱 ID: ${m.console?.miniAppId ?? '-'}  번들: ${m.bundle?.status ?? '-'}`);
  console.log('   ' + Object.entries(m.steps).map(([k, v]) => `${icon[v] ?? v} ${k}`).join('  '));
  if (m.bundle?.testLink) console.log(`   테스트 링크: ${m.bundle.testLink}`);
}
