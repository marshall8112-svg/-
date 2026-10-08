// 장기 액세스 토큰(60일)을 연장한다. 새 토큰을 stdout으로 출력 → 워크플로가 시크릿에 다시 저장.
const res = await fetch(
  `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(process.env.IG_ACCESS_TOKEN)}`
);
const json = await res.json();
if (!res.ok || !json.access_token) {
  console.error('토큰 연장 실패:', JSON.stringify(json.error || json));
  process.exit(1);
}
console.error(`토큰 연장 완료 (유효기간 ${Math.round(json.expires_in / 86400)}일)`);
process.stdout.write(json.access_token);
