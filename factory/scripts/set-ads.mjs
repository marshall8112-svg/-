// 콘솔에서 만든 광고 그룹 ID를 앱에 넣는다 (src/ad-config.json + factory.json).
// 사용: node scripts/set-ads.mjs <slug> [--banner ID] [--interstitial ID] [--rewarded ID] [--reward-name "힌트"] [--reward-amount 1]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { appDir, fail, requireSlug, updateManifest } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    banner: { type: 'string' },
    interstitial: { type: 'string' },
    rewarded: { type: 'string' },
    'reward-name': { type: 'string' },
    'reward-amount': { type: 'string' },
  },
});
const slug = requireSlug(positionals[0]);
const file = path.join(appDir(slug), 'src', 'ad-config.json');
const cfg = JSON.parse(await readFile(file, 'utf8'));

for (const k of ['banner', 'interstitial', 'rewarded']) if (opt[k] !== undefined) cfg[k] = opt[k].trim();
if (opt['reward-name'] !== undefined) cfg.reward.name = opt['reward-name'];
if (opt['reward-amount'] !== undefined) {
  const n = Number(opt['reward-amount']);
  if (!Number.isInteger(n) || n < 1) fail('--reward-amount 는 1 이상의 정수여야 해요.');
  cfg.reward.amount = n;
}

await writeFile(file, JSON.stringify(cfg, null, 2) + '\n');
const filled = ['banner', 'interstitial', 'rewarded'].filter((k) => cfg[k]);
await updateManifest(slug, { ads: cfg, steps: filled.length ? { ad_groups: 'done' } : {} });
console.log(`✔ ${slug} 광고 설정:`, JSON.stringify(cfg));
