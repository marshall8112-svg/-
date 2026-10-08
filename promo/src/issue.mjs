// 승인용 GitHub 이슈 본문 만들기 / 읽기.
//   node src/issue.mjs body <meta.json> <videoUrl> <thumbUrl>   → 이슈 본문 출력
//   node src/issue.mjs parse <body.md> <caption.txt>             → 캡션 파일 쓰고 GITHUB_OUTPUT에 id/video_url 기록
import { readFile, writeFile, appendFile } from 'node:fs/promises';

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'body') {
  const [metaFile, videoUrl, thumbUrl] = args;
  const m = JSON.parse(await readFile(metaFile, 'utf8'));
  const lines = [
    `### 🎬 [영상 보기](${videoUrl})  ·  ${m.appName} · ${m.template} · ${m.seconds.toFixed(1)}초${m.bgm ? ` · 🎵 ${m.bgm}` : ' · 🔇 BGM 없음'}`,
    '',
    `<a href="${videoUrl}"><img src="${thumbUrl}" width="270"></a>`,
    '',
    '**자막 흐름**',
    `1. (훅) ${m.plan.hook.replace(/\\n|\n/g, ' ')}`,
    ...m.plan.scenes.map((s, i) => `${i + 2}. ${s.text.replace(/\\n|\n/g, ' ')} _(${s.seconds}s)_`),
    `${m.plan.scenes.length + 2}. (마무리) ${m.plan.cta}`,
    '',
    '**캡션** — 고치고 싶으면 이 이슈 본문을 편집해서 아래 블록 안만 바꾸세요.',
    '<!-- caption:start -->',
    '```text',
    m.caption,
    '```',
    '<!-- caption:end -->',
    '',
    '---',
    '댓글로 명령: **`/approve`** 인스타에 게시 · **`/reject`** 버리기 · **`/regen`** 같은 앱으로 다시 만들기',
    '',
    `<!-- reel-meta:${JSON.stringify({ id: m.id, app: m.app, videoUrl, thumbUrl })} -->`
  ];
  process.stdout.write(lines.join('\n'));
} else if (cmd === 'parse') {
  const [bodyFile, captionFile] = args;
  const body = await readFile(bodyFile, 'utf8');
  const meta = JSON.parse(body.match(/<!-- reel-meta:(\{.*?\}) -->/s)?.[1] ?? 'null');
  const caption = body.match(/<!-- caption:start -->\s*```[a-z]*\r?\n([\s\S]*?)\r?\n```\s*<!-- caption:end -->/)?.[1];
  if (!meta || caption === undefined) throw new Error('이슈 본문에서 reel-meta 또는 캡션 블록을 찾지 못했어요');
  if (caption.length > 2200) throw new Error(`캡션이 너무 길어요 (${caption.length}/2200자)`);
  await writeFile(captionFile, caption.trim());
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `id=${meta.id}\napp=${meta.app}\nvideo_url=${meta.videoUrl}\n`);
  console.log(meta);
} else {
  throw new Error(`알 수 없는 명령: ${cmd}`);
}
