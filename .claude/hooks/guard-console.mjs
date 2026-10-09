#!/usr/bin/env node
// 콘솔 MCP 안전장치: 검토 요청(심사 제출)·출시·롤백·프로모션 계열 도구 호출을 막는다.
// 검토 요청은 사용자가 콘솔에서 직접 한다. (PreToolUse 훅, exit 2 = 차단)
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let tool = '';
  try {
    tool = JSON.parse(input).tool_name ?? '';
  } catch {
    process.exit(0);
  }
  const name = tool.replace(/^mcp__apps-in-toss-console__/, '');
  const readOnly = /(^|_)(get|list|status|read|search|history)(_|$)/i.test(name);
  const blocked = /(submit|release|rollback|promot|publish|launch)/i.test(name) || (/review/i.test(name) && !readOnly);
  if (blocked) {
    console.error(`차단됨: ${name} — 검토 요청·출시·프로모션은 사용자가 콘솔에서 직접 합니다. 업로드(CREATED)까지만 하고 보고하세요.`);
    process.exit(2);
  }
  process.exit(0);
});
