// Instagram 릴스 게시 (Instagram API with Instagram Login).
// 사용: node src/publish.mjs --video-url https://... --caption-file caption.txt
// 환경변수: IG_ACCESS_TOKEN, IG_USER_ID, (선택) IG_GRAPH_HOST, IG_API_VERSION
import { readFile, appendFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const HOST = process.env.IG_GRAPH_HOST || 'https://graph.instagram.com';
const VER = process.env.IG_API_VERSION || 'v23.0';

async function ig(method, pathname, params = {}) {
  const url = new URL(`${HOST}/${VER}/${pathname}`);
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const res = method === 'GET' ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`IG API ${method} ${pathname} 실패: ${JSON.stringify(json.error || json)}`);
  return json;
}

export async function publishReel({ videoUrl, caption, coverUrl, shareToFeed = true }) {
  const userId = process.env.IG_USER_ID;
  if (!process.env.IG_ACCESS_TOKEN || !userId) throw new Error('IG_ACCESS_TOKEN / IG_USER_ID 가 설정되지 않았어요');

  const params = { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: String(shareToFeed) };
  if (coverUrl) params.cover_url = coverUrl;
  const { id: containerId } = await ig('POST', `${userId}/media`, params);
  console.log(`  컨테이너 생성: ${containerId}`);

  // 인스타 서버가 영상을 받아 처리할 때까지 대기 (최대 약 10분)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const { status_code, status } = await ig('GET', containerId, { fields: 'status_code,status' });
    console.log(`  처리 상태: ${status_code}`);
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`영상 처리 실패: ${status}`);
    if (i === 59) throw new Error('영상 처리 시간 초과');
  }

  const { id: mediaId } = await ig('POST', `${userId}/media_publish`, { creation_id: containerId });
  const { permalink } = await ig('GET', mediaId, { fields: 'permalink' }).catch(() => ({}));
  return { mediaId, permalink };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({
    options: { 'video-url': { type: 'string' }, 'caption-file': { type: 'string' }, 'cover-url': { type: 'string' } }
  });
  const caption = opt['caption-file'] ? await readFile(opt['caption-file'], 'utf8') : '';
  const result = await publishReel({ videoUrl: opt['video-url'], caption: caption.trim(), coverUrl: opt['cover-url'] });
  console.log(`✔ 게시 완료: ${result.permalink || result.mediaId}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `media_id=${result.mediaId}\npermalink=${result.permalink || ''}\n`);
}
