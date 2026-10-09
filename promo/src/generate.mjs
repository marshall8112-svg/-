// 오늘의 릴스 1편 생성: 앱/템플릿 선택 → Claude 기획 → 화면 녹화 → 영상 합성.
// 사용: node src/generate.mjs [--app filmlike] [--template demo] [--plan plan.json]
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { makePlan, buildCaption, TEMPLATES } from './plan.mjs';
import { captureApp, slideshowApp } from './capture.mjs';
import { renderReel, timeline, HOOK_SEC, CTA_SEC } from './render.mjs';
import { narrationLines, synthesize, fitPlan, buildTrack } from './narrate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: opt } = parseArgs({
  options: { app: { type: 'string' }, template: { type: 'string' }, plan: { type: 'string' }, out: { type: 'string' }, url: { type: 'string' } }
});

const config = JSON.parse(await readFile(path.join(ROOT, 'apps.json'), 'utf8'));
const historyFile = path.join(process.env.STATE_DIR || path.join(ROOT, 'state'), 'history.json');
const history = JSON.parse(await readFile(historyFile, 'utf8').catch(() => '[]'));

// 가장 오래 안 올라간 앱, 그 앱에서 가장 오래 안 쓴 템플릿을 고른다.
const lastUsed = (pred) => history.findLastIndex(pred);
const apps = config.apps.filter((a) => a.enabled);
if (!apps.length) throw new Error('apps.json 에 enabled 앱이 없어요');
const app = opt.app ? config.apps.find((a) => a.id === opt.app) : [...apps].sort((a, b) => lastUsed((h) => h.app === a.id) - lastUsed((h) => h.app === b.id))[0];
if (!app) throw new Error(`앱을 찾을 수 없어요: ${opt.app}`);
if (opt.url) app.url = opt.url; // 로컬 빌드 등 임시 주소로 녹화할 때
const template = opt.template || Object.keys(TEMPLATES).sort((a, b) => lastUsed((h) => h.app === app.id && h.template === a) - lastUsed((h) => h.app === app.id && h.template === b))[0];

const id = `${new Date().toISOString().slice(0, 10)}-${app.id}-${Date.now().toString(36).slice(-4)}`;
const outDir = path.resolve(opt.out || path.join(ROOT, 'out'), id);
await mkdir(outDir, { recursive: true });
console.log(`▶ ${id}  앱=${app.name}  템플릿=${template}`);

const plan = opt.plan
  ? { template, ...JSON.parse(await readFile(opt.plan, 'utf8')) }
  : await makePlan({ app, account: config.account, template, recent: history.filter((h) => h.app === app.id).slice(-8).map((h) => h.hook) });
console.log('  기획:', plan.hook, '/', plan.scenes.map((s) => s.text.replace(/\n/g, ' ')).join(' / '));

// 나레이션(무료 TTS). 말이 자막보다 길면 자막 시간을 늘리므로 녹화보다 먼저 한다.
const voiced = await synthesize(narrationLines(plan, app), outDir).catch((e) => {
  console.warn(`  나레이션 실패, 자막만으로 진행: ${e.message}`);
  return null;
});
if (voiced) fitPlan(plan, voiced, { hookSec: HOOK_SEC, ctaSec: CTA_SEC });
else console.log("  나레이션 없음 (배경음악만, 켜려면 TTS_ENABLE=1)");

const { items, total } = timeline(plan);
const capture = await (app.url ? captureApp(app, outDir, total) : slideshowApp(app, outDir, items, ROOT)).catch((e) => {
  console.warn(`  화면 녹화 실패, 그래픽만으로 진행: ${e.message}`);
  return null;
});
const narration = voiced ? await buildTrack(items, voiced, total, outDir) : null;
const video = await renderReel({ plan, app, account: config.account, capture, outDir, bgmDir: path.join(ROOT, 'assets', 'bgm'), narration });
const caption = buildCaption(plan, app, config.account);

const meta = { id, app: app.id, appName: app.name, template, hook: plan.hook, plan, caption, seconds: video.seconds, bgm: video.bgm, narrated: video.narrated, captured: !!capture };
await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`✔ ${video.file} (${video.seconds.toFixed(1)}초)`);

if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `id=${id}\ndir=${outDir}\n`);
