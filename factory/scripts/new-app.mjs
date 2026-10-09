// 템플릿을 복사해 새 미니앱을 만든다.
// 사용: node scripts/new-app.mjs <slug> --title "하찮음측정기" --tagline "..." --color "#7C3AED" --emoji "🐜" --idea "..." [--no-install]
import { existsSync } from 'node:fs';
import { cp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, TEMPLATE, appDir, fail, isTossBlue, run } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: 'string' },
    tagline: { type: 'string', default: '' },
    color: { type: 'string', default: '#6B7280' },
    emoji: { type: 'string', default: '✨' },
    idea: { type: 'string', default: '' },
    'no-install': { type: 'boolean', default: false },
  },
});

const slug = positionals[0];
if (!slug || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug)) fail('slug는 영문 소문자 케밥 케이스여야 해요. 예: hachanum-meter');
if (!opt.title) fail('--title 로 앱 이름(한글 가능)을 넣어 주세요.');
if (!/^#[0-9a-fA-F]{6}$/.test(opt.color)) fail('--color 는 #RRGGBB 형식이어야 해요.');
if (isTossBlue(opt.color)) fail(`${opt.color} 는 토스 블루 계열이라 쓸 수 없어요. 다른 색을 고르세요.`);

const dir = appDir(slug);
if (existsSync(dir)) fail(`apps/${slug} 가 이미 있어요.`);

await cp(TEMPLATE, dir, { recursive: true, filter: (src) => !/node_modules|[\\/]dist$/.test(src) });

const vars = { __APP_NAME__: slug, __TITLE__: opt.title, __TAGLINE__: opt.tagline, __COLOR__: opt.color };
async function fill(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) await fill(p);
    else if (/\.(json|ts|tsx|css|html|md)$/.test(e.name)) {
      let s = await readFile(p, 'utf8');
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(k, v);
      await writeFile(p, s);
    }
  }
}
await fill(dir);

const manifest = {
  slug,
  appName: slug,
  title: opt.title,
  tagline: opt.tagline,
  idea: opt.idea,
  color: opt.color,
  emoji: opt.emoji,
  createdAt: new Date().toISOString(),
  // 등록 스크린샷 3장을 찍을 때 각 장면 직전에 실행할 동작. Claude가 앱에 맞게 채운다.
  // type: wait | click | fill | scroll  (click/fill 은 selector 사용)
  shots: [
    { name: 'screenshot-1', actions: [] },
    { name: 'screenshot-2', actions: [] },
    { name: 'screenshot-3', actions: [] },
  ],
  ads: { banner: '', interstitial: '', rewarded: '', reward: { name: '', amount: 1 } },
  console: { workspaceId: null, miniAppId: null },
  bundle: { deploymentId: null, status: null, uploadedAt: null },
  steps: {
    scaffold: 'done',
    build_app: 'todo',
    assets: 'todo',
    console_app: 'todo',
    ad_groups: 'todo',
    release_build: 'todo',
    upload: 'todo',
    ready_for_review: 'todo',
  },
};
await writeFile(path.join(dir, 'factory.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`✔ apps/${slug} 생성`);

if (!opt['no-install']) {
  console.log('▶ 의존성 설치 (npm install, 공장 루트 workspaces)');
  await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT });
}
console.log(`다음: apps/${slug}/src/App.tsx 를 아이디어에 맞게 구현 → npm run dev -w ${slug}`);
