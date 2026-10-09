#!/usr/bin/env node
// 콘솔 안전장치 (PreToolUse 훅, exit 2 = 차단). 검토 요청은 사용자가 콘솔에서 직접 한다.
// 1) 콘솔 MCP: 검토 요청(심사 제출)·출시·롤백·프로모션 계열 도구 호출을 막는다.
// 2) 브라우저(앱 안 브라우저·Chrome): 콘솔 폼을 채우다가 "검토 요청" 버튼을 누르는 동작을 막는다.
//    클릭·키 입력·스크립트의 설명(action_summary)이나 코드에 검토 요청·제출 문구가 있으면 차단한다.
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  const tool = payload.tool_name ?? '';

  if (tool.startsWith('mcp__apps-in-toss-console__')) {
    const name = tool.replace(/^mcp__apps-in-toss-console__/, '');
    const readOnly = /(^|_)(get|list|status|read|search|history)(_|$)/i.test(name);
    const blocked = /(submit|release|rollback|promot|publish|launch)/i.test(name) || (/review/i.test(name) && !readOnly);
    if (blocked) {
      console.error(`차단됨: ${name} — 검토 요청·출시·프로모션은 사용자가 콘솔에서 직접 합니다. 업로드(CREATED)까지만 하고 보고하세요.`);
      process.exit(2);
    }
    process.exit(0);
  }

  // 브라우저 조작 도구: 읽기(find·read_page·get_page_text·screenshot)는 통과
  if (/__(computer|browser_batch|javascript_tool|form_input)$/.test(tool)) {
    const text = JSON.stringify(payload.tool_input ?? {});
    const isRead = /"action":"(screenshot|zoom|scroll|scroll_to|wait|hover)"/.test(text) && !/browser_batch/.test(tool);
    if (!isRead && /(검토\s*요청|심사\s*(요청|제출)|출시하기|review_submit|submitReview)/.test(text)) {
      console.error('차단됨: 콘솔의 검토 요청·출시 버튼은 사용자가 직접 누릅니다. 임시저장까지만 하고 보고하세요.');
      process.exit(2);
    }
  }
  process.exit(0);
});
