// 릴스를 카카오톡 "나에게 보내기"로 전달할 메시지들을 만든다 (메시지당 200자 제한).
// 영상은 GitHub raw 다운로드 링크(커밋 고정, application/octet-stream → 폰 브라우저에서 바로 저장)로 보낸다.
// 사용: node src/kakao-msg.mjs <promo/reels/<앱>/<id>.mp4>   → JSON 배열 출력. 각 원소를 KakaotalkChat-MemoChat 으로 보낸다.
// 전제: 그 mp4 가 이미 커밋·푸시돼 있어야 한다 (링크가 HEAD 커밋을 가리킨다).
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LIMIT = 200;
const mp4 = path.resolve(process.argv[2] ?? '');
const git = (...a) => execFileSync('git', a, { cwd: path.dirname(mp4), encoding: 'utf8' }).trim();
const top = git('rev-parse', '--show-toplevel');
const rel = path.relative(top, mp4).split(path.sep).join('/');
const sha = git('rev-parse', '--short=7', 'HEAD');
const remote = git('remote', 'get-url', 'origin').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
const pushed = execFileSync('git', ['ls-tree', '--name-only', 'origin/' + git('branch', '--show-current'), '--', rel], { cwd: top, encoding: 'utf8' }).trim();
if (pushed !== rel)
  throw new Error(`${rel} 이 아직 푸시되지 않았어요. 커밋·푸시 후 다시 실행하세요.`);

const meta = JSON.parse(await readFile(mp4.replace(/\.mp4$/, '.meta.json'), 'utf8'));
const link = `${remote}/raw/${sha}/${rel}`;
const [body, tags] = (() => {
  const i = meta.caption.lastIndexOf('\n\n#');
  return i < 0 ? [meta.caption, ''] : [meta.caption.slice(0, i), meta.caption.slice(i + 2)];
})();

// 200자 넘으면 줄 단위로 나눈다
function chunks(title, text) {
  const out = [];
  let cur = title;
  for (const line of text.split('\n')) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > LIMIT && cur) {
      out.push(cur);
      cur = line;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

const msgs = [
  `[${meta.appName} 릴스] 다운로드 링크 (크롬/사파리로 열기)\n${link}`,
  ...chunks('캡션', body),
  ...(tags ? chunks('해시태그 (캡션 아래 붙여넣기)', tags) : [])
];
const n = msgs.length;
const out = msgs.map((m, i) => m.replace(/^(\[.*?\]|캡션|해시태그)/, (h) => (i === 0 ? h : `[${i + 1}/${n}] ${h}`)));
if (out.some((m) => m.length > LIMIT)) throw new Error('200자를 넘는 메시지가 있어요');
console.log(JSON.stringify(out, null, 2));
