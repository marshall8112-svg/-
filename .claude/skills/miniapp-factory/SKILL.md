---
name: miniapp-factory
description: |
  앱인토스 미니앱 공장. 아이디어 한 줄을 받아 미니앱 구현 → 광고(배너·전면형·보상형) 삽입 →
  등록 이미지 생성 → 콘솔 앱 등록 → 광고 그룹 생성·연결 → 출시 번들 빌드·업로드까지 끝내고,
  검토 요청 직전에 멈춘다. 검토 요청은 사용자가 직접 한다.
  "/miniapp-factory <아이디어>", "이 아이디어로 미니앱 만들어줘", "공장 돌려줘" 등에 사용.
  여러 아이디어를 주면 하나씩 차례로 돌린다.
argument-hint: '<아이디어> [| <아이디어2> ...]'
---

# 미니앱 공장

**이 문서는 지금 이 턴에서 네가 직접 순서대로 실행하는 지시문이다.** 모든 명령은 저장소의
`factory/` 디렉터리에서 실행한다. 단계마다 결과를 `apps/<slug>/factory.json`에 기록하므로,
중간에 끊겨도 `node scripts/status.mjs`로 어디까지 했는지 보고 이어서 하면 된다.

사용자는 자동화를 원한다. 아래에 "사용자에게 묻는다"라고 적힌 경우가 아니면 묻지 말고 스스로
판단해 끝까지 진행한다.

## 절대 규칙

- ❌ **검토 요청(심사 제출)·출시·롤백·프로모션 도구는 절대 호출하지 않는다.**
  `bundle_submit_review`, 이름에 `review`·`submit`·`release`·`rollback`·`promotion`이 들어간
  콘솔 도구 전부. (훅 `.claude/hooks/guard-console.mjs`가 막지만, 시도 자체를 하지 않는다.)
- ❌ 이미 콘솔에 있는 앱을 새로 만들지 않는다. `miniapp_create`는 서버가 새 앱 ID를 발급하는
  되돌릴 수 없는 동작이다. 같은 slug는 항상 기존 앱을 재사용한다.
- ❌ 세션에 실제로 보이지 않는 도구 이름을 지어내 호출하지 않는다. 콘솔 MCP는 도구 설명이
  비어 있을 수 있으니 **이름과 입력 스키마**를 보고 판단한다.
- ❌ 진입 링크(`intoss-private://...`)를 손으로 조립하지 않는다. 도구·CLI가 돌려준 문자열만 전달한다.
- ❌ API 키, 업로드 주소의 서명 파라미터를 화면·로그·커밋에 남기지 않는다.
- ❌ 토스 블루 계열(#0064FF, #3182F6 등)을 앱 대표색으로 쓰지 않는다. 토스 로고·이름을 앱
  이름이나 이미지에 넣지 않는다.

## 0. 사전 점검 (세션마다 1회)

```bash
cd factory && node -v && node scripts/status.mjs
```

- Node 24 이상이 아니면 설치를 안내하고 멈춘다.
- `factory/node_modules`가 없으면 `npm install` 후 `npx playwright install chromium`.
- `factory/profile.json`이 없으면 `profile.example.json`을 복사하고, 비어 있는 칸(고객 문의
  연락처 등 콘솔 등록에 필요한 개발자 정보)만 **사용자에게 묻는다.** 한 번 채우면 다시 묻지 않는다.
- 콘솔 MCP(`apps-in-toss-console`) 도구가 세션에 보이는지 확인한다. 안 보이면
  "Claude Code에서 `/mcp` → apps-in-toss-console → 인증"을 안내한다. 이 경우 1~5단계(구현·광고
  코드·이미지)는 그대로 진행하고, 6단계부터는 인증 후 이어서 하도록 안내한다.

## 1. 기획

아이디어에서 아래를 정한다. 애매해도 묻지 말고 가장 그럴듯한 쪽으로 정한다.

| 항목 | 규칙 |
|---|---|
| `slug` | 영문 소문자 케밥 케이스. 콘솔 앱 ID(appName)가 된다. `apps/`에 같은 이름이 없어야 한다 |
| `title` | 한글 앱 이름, 12자 이내. 토스·Toss 금지 |
| `tagline` | 한 줄 소개, 20자 이내, 과장 금지 |
| `color` | 대표색 #RRGGBB. 토스 블루 계열 금지 |
| `emoji` | 대표 이모지 1개 (로고·썸네일에 쓰인다) |
| 화면 흐름 | 시작 → 핵심 동작 → 결과 (3~4화면이면 충분) |
| 광고 배치 | 아래 "광고 규칙"대로 |

결정한 내용을 `apps/<slug>/SPEC.md`에 짧게 적는다 (2단계 후).

## 2. 앱 만들기

```bash
node scripts/new-app.mjs <slug> --title "<title>" --tagline "<tagline>" --color "<#hex>" --emoji "<emoji>" --idea "<원문 아이디어>"
```

템플릿 구조 (`apps/<slug>/`):
- `src/App.tsx` — **아이디어대로 다시 쓴다.** 필요하면 `src/` 아래에 파일을 더 만든다.
- `src/lib/ads.ts`, `src/lib/AdSlots.tsx` — 광고 모듈. **고치지 말고 가져다 쓴다.**
- `src/ad-config.json` — 광고 그룹 ID. 손으로 고치지 말고 `set-ads`로 넣는다.
- `src/styles.css` — 기본 스타일(`.page .title .body .card .btn .btn-secondary .bottom`).

구현 규칙:
- 토스 앱 WebView에서 도는 웹(React DOM) 앱이다. `react-native` import 금지.
- 서버 없이 브라우저 안에서 끝나는 기능으로 만든다. 외부 API 키가 필요한 기능은 만들지 않는다.
- 글자 15px 이상, 터치 영역 44px 이상, 하단 버튼은 safe area 위(`.bottom`).
- 다크 모드에서도 읽히게 CSS 변수(`--bg --text --sub --line --brand`)를 쓴다.
- 결과를 공유하거나 다시 하기 쉬운 구조가 재방문에 유리하다.

## 3. 광고 삽입 (광고 규칙)

`src/lib/ads.ts`와 `src/lib/AdSlots.tsx`에서 가져다 쓴다:

| 종류 | 코드 | 어디에 |
|---|---|---|
| 배너 | `<AdBanner />` | 결과 화면의 콘텐츠 아래, 또는 목록 중간. 첫 화면 핵심 콘텐츠를 밀어내지 않게 |
| 전면형 | `await showInterstitial()` | 자연스러운 쉬는 지점에서만: "결과 보기"를 눌러 결과로 넘어갈 때, 한 판이 끝났을 때. 반복 동작이면 `showInterstitial({ every: 3 })` |
| 보상형 | `<RewardedButton label="광고 보고 ○○" onReward={...} />` | 사용자가 원해서 누르는 추가 혜택: 추가 결과, 힌트, 다시 뽑기, 기회 +1 |

기본 조합은 **세 가지 모두** 쓴다 (수익 극대화). 앱 성격상 맞지 않는 종류만 뺀다.

반려를 피하기 위한 금지 사항:
- 앱 진입 직후·첫 화면 표시 중 전면 광고 (`useEffect`에서 `showInterstitial` 호출 금지)
- 일반 탭·스크롤 중 맥락 없는 전면 광고, 뒤로가기를 막는 광고
- 광고가 콘텐츠·버튼을 가리거나 광고를 콘텐츠처럼 위장
- 보상을 광고 시청 전에 주거나, `onReward`가 아닌 곳에서 지급
- 하단 탭바가 있는데 배너를 바닥에 고정

`showInterstitial()`은 광고가 없거나 빈도 제한(60초)에 걸리면 바로 끝나므로, 항상 `await` 뒤에
다음 화면으로 넘기면 된다. `RewardedButton`은 광고가 준비되지 않으면 스스로 숨는다.

## 4. 검사·눈으로 확인

```bash
node scripts/check.mjs <slug>
```

- `✖`가 있으면 고치고 다시 돌린다. (`⚠ 광고 그룹 ID 비어 있음`, `⚠ assets 없음`은 이 단계에선 정상)
- `factory.json`의 `shots`에 등록 스크린샷 3장을 찍을 동작을 채운다. 예:
  ```json
  [{ "name": "screenshot-1", "actions": [] },
   { "name": "screenshot-2", "actions": [{ "type": "click", "selector": "text=시작하기" }, { "type": "wait", "ms": 800 }] },
   { "name": "screenshot-3", "actions": [{ "type": "click", "selector": "text=시작하기" }, { "type": "click", "selector": "text=결과 보기" }] }]
  ```
  `type`: `wait`(ms) · `click`(selector) · `fill`(selector, value) · `scroll`(y)

## 5. 등록 이미지

```bash
node scripts/assets.mjs <slug>
```

`assets/`에 logo 600×600, thumbnail 1932×828, screenshot-1~3 636×1048이 생긴다.
**Read 도구로 다섯 장을 직접 열어 본다.** 화면이 비었거나 깨졌으면 앱이나 `shots`를 고치고
다시 만든다. 이 스크린샷이 앱이 실제로 동작하는지 보는 마지막 확인이기도 하다.

## 6. 콘솔 앱 등록 (콘솔 MCP)

1. `workspace_list` → 워크스페이스를 고른다. `profile.json`의 `workspaceId`가 있으면 그것,
   하나뿐이면 그것, 여러 개인데 지정이 없으면 **사용자에게 묻고** `profile.json`에 저장한다.
2. `factory.json`의 `console.miniAppId`가 있으면 등록을 건너뛴다. 없으면 `miniapp_get_status`
   등으로 같은 appName의 앱이 이미 있는지 확인한다.
3. 없을 때만 `miniapp_create`. 입력은 **세션에 보이는 스키마 그대로** 채운다:
   - appName = `slug`, 이름 = `title`, 소개 = `tagline`·SPEC.md, 카테고리는 아이디어에 맞게
   - 이미지 = `apps/<slug>/assets/*.png` (스키마가 파일 경로·base64·업로드 URL 중 무엇을
     원하는지 보고 맞춘다)
   - 개발자·문의 정보 = `profile.json`
4. 결과를 기록한다:
   ```bash
   node scripts/status.mjs <slug> --set console.workspaceId=<id> console.miniAppId=<id> steps.console_app=done
   ```

## 7. 광고 그룹 만들기·연결

1. 세션의 `apps-in-toss-console` 도구 중 이름에 `ad`·`ads`·`adgroup`·`iaa`·`advert`가 들어간
   것을 찾아 스키마를 확인한다. (목록·생성 도구가 있을 것이다.)
2. 이미 있는 광고 그룹을 먼저 조회한다. 없는 것만, 코드에서 쓰는 종류만 만든다:
   | 이름 | 유형 | 추가 입력 |
   |---|---|---|
   | `<slug>-banner` | 배너 | — |
   | `<slug>-interstitial` | 전면형 | — |
   | `<slug>-rewarded` | 보상형 | 보상 이름·수량 = 실제로 주는 것 (예: "추가 결과", 1) |
3. 받은 광고 그룹 ID를 넣는다:
   ```bash
   node scripts/set-ads.mjs <slug> --banner <ID> --interstitial <ID> --rewarded <ID> --reward-name "<보상 이름>" --reward-amount 1
   ```
4. **광고 도구가 세션에 없거나 생성이 거부되면** (광고 정산 정보 미등록 등): 이유를 그대로
   보여주고, 콘솔 웹에서 할 일을 정확히 안내한다 —
   "콘솔 → <앱> → 인앱 광고 → 광고 그룹 만들기에서 위 표대로 만들고 ID를 알려주세요."
   ID를 받으면 3을 실행하고 이어 간다. 기다리는 동안 다른 아이디어가 있으면 그걸 먼저 진행한다.

## 8. 출시 번들 빌드

```bash
node scripts/check.mjs <slug> --release
```

광고 ID·보상 이름·이미지가 모두 갖춰져야 통과한다. 통과하면 `apps/<slug>/<slug>.ait`와
`deploymentId`가 나온다 (factory.json `bundle.deploymentId`에도 저장됨).

## 9. 업로드 (검토 요청 전까지)

기본 경로 — 콘솔 MCP:
1. `bundle_upload` — 스키마대로 (appName/miniAppId, `deploymentId`는 8단계 값 그대로. 지어내지 않는다).
   응답의 업로드 주소로:
   ```bash
   node scripts/upload.mjs <slug> --put "<업로드 주소>"
   ```
2. `bundle_upload_complete` — 같은 deploymentId로. 여기서 콘솔 컴파일이 시작된다.
3. `miniapp_get_status`를 10초 간격으로 다시 불러 상태를 본다. (`bundle_build_status`는 쓰지 않는다 — 실패하는 것으로 알려짐)
   - `CREATED` → 성공. 응답에 진입 링크가 있으면 그대로 기록한다.
   - `BUILD_FAILED` → appName 일치부터 확인한다. 같은 번들을 반복 업로드하지 않는다.

대체 경로 — MCP 업로드가 안 될 때 (배포 API 키가 있을 때만):
```bash
node scripts/upload.mjs <slug> --cli -m "<메모>"
```

끝나면 기록한다:
```bash
node scripts/status.mjs <slug> --set bundle.status=CREATED steps.upload=done steps.ready_for_review=done
```

## 10. 마무리 보고 (여기서 멈춘다)

검토 요청은 하지 않는다. 사용자에게 아래 형식으로 보고한다:

```
✅ <emoji> <title> (<slug>) — 검토 요청 직전까지 완료

  콘솔 앱 ID   <miniAppId>
  광고 그룹    배너 <id> · 전면형 <id> · 보상형 <id>
  번들         <deploymentId> (CREATED)
  테스트 링크  <도구가 준 링크, 없으면 "콘솔 번들 목록에서 테스트">

남은 일 (직접):
  1. 토스 앱에서 테스트 링크로 열어 광고가 뜨는지 확인
  2. 콘솔 → <title> → 번들 → 방금 올린 번들 → 검토 요청
```

여러 아이디어를 받았으면 앱마다 1~10을 돌리고, 끝에 `node scripts/status.mjs` 결과를 함께 보여준다.
