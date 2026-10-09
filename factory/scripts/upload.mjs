// .ait 번들을 콘솔에 올린다. 검토 요청은 하지 않는다.
// 두 가지 방법:
//   --put <url>  콘솔 MCP bundle_upload 가 준 업로드 주소로 PUT (기본 경로. 이후 bundle_upload_complete 호출)
//   --cli        ait deploy 로 직접 업로드 (환경변수 AIT_API_KEY 또는 `npx ait token add` 로 저장한 키 사용)
// 사용: node scripts/upload.mjs <slug> --put "<url>"   |   node scripts/upload.mjs <slug> --cli [-m "메모"]
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { appDir, fail, readManifest, requireSlug, run, updateManifest } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { put: { type: 'string' }, cli: { type: 'boolean', default: false }, memo: { type: 'string', short: 'm' }, force: { type: 'boolean', default: false } },
});
const slug = requireSlug(positionals[0]);
const dir = appDir(slug);
const m = await readManifest(slug);
const file = path.join(dir, `${m.appName}.ait`);

if (!existsSync(file)) fail(`${m.appName}.ait 가 없어요. 먼저 node scripts/check.mjs ${slug} --release`);
if (m.steps.release_build !== 'done' && !opt.force) fail(`출시용 검사를 아직 통과하지 않았어요. node scripts/check.mjs ${slug} --release`);
if (!opt.put && !opt.cli) fail('--put <url> 또는 --cli 중 하나를 고르세요.');

if (opt.put) {
  const { size } = await stat(file);
  const res = await fetch(opt.put, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip', 'Content-Length': String(size) },
    body: await readFile(file),
  });
  if (!res.ok) fail(`업로드 실패: HTTP ${res.status}`);
  await updateManifest(slug, { bundle: { status: 'UPLOADED', uploadedAt: new Date().toISOString() } });
  console.log(`✔ 업로드 완료 (${(size / 1024).toFixed(0)}KB). 이제 콘솔 MCP bundle_upload_complete 를 호출하세요. deploymentId=${m.bundle.deploymentId}`);
} else {
  const stored = existsSync(path.join(os.homedir(), '.ait', 'credentials'));
  if (!process.env.AIT_API_KEY && !stored) fail('배포 API 키가 없어요. AIT_API_KEY 환경변수를 넣거나 `npx ait token add` 로 저장하세요.');
  const args = ['ait', 'deploy', '--location', file];
  if (process.env.AIT_API_KEY) args.push('--api-key', process.env.AIT_API_KEY);
  if (opt.memo) args.push('--memo', opt.memo);
  const out = await run('npx', args, { cwd: dir, env: { CI: '1' } });
  const link = /intoss-private:\/\/\S+/.exec(out)?.[0] ?? null;
  await updateManifest(slug, {
    bundle: { status: 'CREATED', uploadedAt: new Date().toISOString(), testLink: link },
    steps: { upload: 'done' },
  });
  console.log(`✔ 배포(업로드+컴파일) 완료${link ? `\n테스트 링크: ${link}` : ''}`);
}
