// 앱 하나를 검사하고 .ait 번들을 만든다.
// 사용: node scripts/check.mjs <slug> [--release] [--no-build]
//   --release : 업로드 직전 검사. 코드에서 쓰는 광고 종류의 광고 그룹 ID가 모두 채워져야 통과.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ASSET_SPECS, appDir, isTossBlue, pngSize, readManifest, requireSlug, run, updateManifest } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { release: { type: 'boolean', default: false }, 'no-build': { type: 'boolean', default: false } },
});
const slug = requireSlug(positionals[0]);
const dir = appDir(slug);
const m = await readManifest(slug);
const errors = [];
const warns = [];

// 1. appName 일치 (콘솔 앱 ID = apps-in-toss.config.ts appName = factory.json appName)
const config = await readFile(path.join(dir, 'apps-in-toss.config.ts'), 'utf8');
const appName = /appName:\s*['"]([^'"]+)['"]/.exec(config)?.[1];
if (appName !== m.appName) errors.push(`apps-in-toss.config.ts appName(${appName}) ≠ factory.json appName(${m.appName})`);
const color = /primaryColor:\s*['"]([^'"]+)['"]/.exec(config)?.[1];
if (isTossBlue(color)) errors.push(`대표색 ${color} 가 토스 블루 계열이에요.`);

// 2. 광고 배치 검사 (src/lib 제외한 앱 코드에서 실제로 쓰는지)
async function sources(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...(p.endsWith(`${path.sep}lib`) ? [] : await sources(p)));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push({ p, s: await readFile(p, 'utf8') });
  }
  return out;
}
const code = (await sources(path.join(dir, 'src'))).map((f) => f.s).join('\n');
const used = {
  banner: /<AdBanner\b|mountBanner\(/.test(code),
  interstitial: /showInterstitial\(/.test(code),
  rewarded: /<RewardedButton\b|showRewarded\(/.test(code),
};
if (!Object.values(used).some(Boolean)) errors.push('앱 코드에 광고가 하나도 없어요 (AdBanner / showInterstitial / RewardedButton).');
if (/useEffect\([^)]*\{[^}]*showInterstitial\(/s.test(code)) warns.push('useEffect 안에서 showInterstitial()을 부르고 있어요. 진입 직후 전면 광고는 검수에서 반려될 수 있어요.');
if (/__TITLE__|__TAGLINE__|__APP_NAME__|__COLOR__/.test(code + config)) errors.push('템플릿 자리표시자(__TITLE__ 등)가 남아 있어요.');
if (/여기에 결과를 보여줘요/.test(code)) errors.push('템플릿 기본 화면(App.tsx)이 그대로예요. 아이디어대로 구현하세요.');

const ads = JSON.parse(await readFile(path.join(dir, 'src', 'ad-config.json'), 'utf8'));
for (const [kind, isUsed] of Object.entries(used)) {
  if (!isUsed) continue;
  if (!ads[kind]) (opt.release ? errors : warns).push(`${kind} 광고를 쓰는데 광고 그룹 ID가 비어 있어요 → set-ads 로 넣으세요.`);
}
for (const [kind, id] of Object.entries(ads)) {
  if (kind !== 'reward' && id && !used[kind]) warns.push(`${kind} 광고 그룹 ID는 있는데 코드에서 쓰지 않아요.`);
}
if (used.rewarded && !ads.reward?.name) (opt.release ? errors : warns).push('보상형 광고의 보상 이름(reward.name)이 비어 있어요.');

// 3. 등록 이미지 규격
for (const s of ASSET_SPECS) {
  const f = path.join(dir, 'assets', s.file);
  const size = existsSync(f) ? await pngSize(f) : null;
  if (!size) (opt.release ? errors : warns).push(`assets/${s.file} 없음 → node scripts/assets.mjs ${slug}`);
  else if (size.width !== s.width || size.height !== s.height) errors.push(`assets/${s.file} ${size.width}×${size.height} (필요 ${s.width}×${s.height})`);
}

// 4. 빌드 (tsc → vite → ait build)
let deploymentId = null;
if (!errors.length && !opt['no-build']) {
  try {
    const out = await run('npm', ['run', 'build'], { cwd: dir });
    deploymentId = /deploymentId:\s*([0-9a-f-]{36})/i.exec(out)?.[1] ?? null;
    if (!existsSync(path.join(dir, `${m.appName}.ait`))) errors.push(`${m.appName}.ait 가 만들어지지 않았어요.`);
  } catch (e) {
    errors.push(`빌드 실패: ${e.message}`);
  }
}

console.log('');
console.log(`광고 사용: ${Object.entries(used).filter(([, v]) => v).map(([k]) => k).join(', ') || '없음'}`);
for (const w of warns) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✖ ${e}`);

if (errors.length) {
  await updateManifest(slug, { steps: opt.release ? { release_build: 'todo' } : { build_app: 'todo' } });
  process.exit(1);
}
const patch = { steps: { build_app: 'done' } };
if (deploymentId) patch.bundle = { deploymentId, status: 'BUILT', uploadedAt: null };
if (opt.release) patch.steps.release_build = 'done';
await updateManifest(slug, patch);
console.log(`✔ 통과${deploymentId ? `  deploymentId=${deploymentId}  파일=apps/${slug}/${m.appName}.ait` : ''}`);
