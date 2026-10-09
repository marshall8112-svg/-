---
name: miniapp-factory
description: |
  앱인토스 미니앱 공장. 아이디어 한 줄을 받아 미니앱 구현 → 광고(배너·전면형·보상형) 삽입 →
  등록 이미지 생성 → 콘솔 앱 등록 → 광고 그룹 생성·연결 → 출시 번들 빌드·업로드 →
  GitHub 푸시 → 콘솔 웹 앱 정보 입력(임시저장) → 홍보 릴스 제작까지 끝내고,
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
| `title` | 한글 앱 이름, **공백 빼고 10자 이내**, 한글·영문·숫자·공백과 `:·?`만 (하이픈·이모지 불가 — "D-day" ✖ → "디데이"). 토스·Toss 금지 |
| `titleEn` | 영문 이름, 공백 빼고 15자 이내, 단어 첫 글자만 대문자 (예: `Quit Day Meter`) |
| `tagline` | 한 줄 소개 = 콘솔 부제. 20자 이내, `:·?` 외 특수문자·이모지 불가, 과장 금지 |
| `color` | 대표색 #RRGGBB. 토스 블루 계열 금지 |
| `emoji` | 대표 이모지 1개 (로고·썸네일에 쓰인다) |
| 화면 흐름 | 시작 → 핵심 동작 → 결과 (3~4화면이면 충분) |
| 광고 배치 | 아래 "광고 규칙"대로 |

결정한 내용을 `apps/<slug>/SPEC.md`에 짧게 적는다 (2단계 후).

콘솔 등록 문구도 이때 정해 `factory.json`의 `listing`에 넣는다 (11단계에서 그대로 쓴다):

```json
"listing": {
  "titleEn": "Quit Day Meter",
  "category": ["생활", "콘텐츠", "테스트"],
  "keywords": ["퇴사", "직장인테스트", "심리테스트", "번아웃", "월요병"],
  "releaseNote": "심사자용: 주요 화면·버튼·광고 위치·데이터를 서버로 보내는지 (300자 안팎)",
  "detail": "사용자용 상세 설명, 500자 이내, 이모지 불가. 무엇을 보고·누르고·경험하는지 1. 2. 3. 순서로"
}
```
- 카테고리는 `miniapp_category_list`에 있는 이름 그대로. 재미 테스트류는 생활 > 콘텐츠 > 테스트.
- 키워드 5개 안팎.

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
  `type`: `wait`(ms) · `click`(selector) · `fill`(selector, value) · `scroll`(y) ·
  `upload`(selector 생략 시 `input[type=file]`, file = 앱 폴더 기준 경로 — 예: `shots/sample.svg`)

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
   - appName = `slug`, title, titleEn, description = `tagline`, 카테고리·키워드 = `listing`
   - 로고는 필수: `image_upload_url`(실제 파일 크기) → curl PUT → `iconUploadId`
   - **새 앱은 거의 항상 4103("최초 등록이 끝나기 전에는 앱 정보와 번들을 함께 제출해요")으로
     끝난다. 이건 정상이다** — 오류 문구에 나온 miniAppId 로 앱은 이미 만들어졌고, 앱 이름 외의
     정보는 저장되지 않는다. 다시 만들거나 `miniapp_update_*`로 재시도하지 않는다
     (update 도구는 검토 요청까지 같이 낸다). 앱 정보는 11단계에서 콘솔 웹에 넣는다.
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
3. `bundle_list`(size 1)로 이 deploymentId 의 `reviewStatus`를 본다. (`bundle_build_status`는 쓰지 않는다 — 실패하는 것으로 알려짐)
   보통 수십 초 안에 끝나므로 그 사이 10·12단계 준비를 하고 다시 본다.
   - `CREATED` → 성공.
   - `BUILD_FAILED` → appName 일치부터 확인한다. 같은 번들을 반복 업로드하지 않는다.
4. `bundle_test_push`(같은 deploymentId) → 본인 토스 앱으로 테스트 푸시. 응답의 `privateLink`·
   `consoleTestUrl`을 그대로 보고에 쓴다.

대체 경로 — MCP 업로드가 안 될 때 (배포 API 키가 있을 때만):
```bash
node scripts/upload.mjs <slug> --cli -m "<메모>"
```

끝나면 기록한다:
```bash
node scripts/status.mjs <slug> --set bundle.status=CREATED steps.release_build=done steps.upload=done
```

## 10. GitHub 푸시

**GitHub 업로드는 사용자 요청 없이도 매번 한다.** 앱 코드·이미지는 여기서, 릴스 설정·영상은 12단계에서,
공장 스크립트나 지시문을 고쳤으면 그때그때 커밋·푸시한다. 푸시가 실패하면(인증 등) 이유를 보고에 적는다.
11단계 이미지 업로드가 GitHub 원본 주소를 쓰므로 **11단계 전에** 푸시한다. 저장소 루트에서:

```bash
git add factory/apps/<slug> && git commit -m "Add <slug> mini app (<title>)" && git push
```
- 현재 브랜치에 커밋한다 (기본 브랜치면 새 브랜치부터). git 사용자 정보가 없으면
  `git -c user.name=Claude -c user.email=noreply@anthropic.com commit ...`.
- `*.ait`, `dist/`, `profile.json`은 .gitignore 대상이라 올라가지 않는다.
- 커밋 메시지 끝에는 세션이 알려준 Co-Authored-By 줄을 붙인다.
- 기록: `node scripts/status.mjs <slug> --set steps.github=done`

## 11. 콘솔 웹 앱 정보 입력 (임시저장까지)

최초 등록 앱의 앱 정보는 MCP 로 저장만 할 방법이 없어서, **앱 안 브라우저**(`mcp__Claude_Browser__*`)로
콘솔 웹 폼을 채운다. ❌ **"검토 요청하기" 버튼은 절대 누르지 않는다** (훅이 막지만 시도하지 않는다).
앱 출시 화면의 번들 행에 있는 "검토 요청하기"로 들어가지 말고, 아래 주소로 바로 들어간다.

1. `preview_start` url = `https://apps-in-toss.toss.im/workspace/<workspaceId>/mini-app/<slug>/meta/edit`
   - 토스 비즈니스 로그인 화면이 나오면 **로그인은 사용자가 한다.** `tabs_context`로 패널이
     숨겨져 있는지 보고, 숨겨져 있으면 Ctrl+Shift+B 로 브라우저를 열어 달라고 한 뒤 로그인을
     부탁하고 기다린다. 그동안 12단계를 먼저 해도 된다.
   - 폼이 좁아 왼쪽이 잘리면 `resize_window` 1440×900 으로 넓히고, 끝나면 `preset: desktop`으로 되돌린다.
2. **1단계 기본 정보** (`read_page` interactive 로 ref 확인 → 클릭 후 `type`. React 입력이라 `form_input`보다 클릭+타이핑이 확실하다)
   - 앱 번들: 기본으로 최신 번들이 잡힌다. 메모 칸이 방금 올린 번들 메모인지 확인
   - 출시 노트 = `listing.releaseNote`, 영어 앱 이름 = `listing.titleEn`, 부제 = `tagline`,
     상세 설명 = `listing.detail`, 고객문의 이메일 = `profile.json`의 `developer.email`
   - 사용 연령은 "만 19세 이상"으로 잠겨 있다 (앱인토스는 19세 이상 전용). 손대지 않는다.
   - JS 로 `input,textarea` 값을 읽어 다 들어갔는지 확인 → **임시저장** → **다음**
3. **2단계 카테고리 및 노출** (`?step=1`)
   - 카테고리: 첫 칸은 "생활"로 고정, 두 번째·세 번째 드롭다운을 열어 `listing.category`대로 고른다.
     ⚠ 오른쪽 휴대폰 미리보기에도 "콘텐츠"·"테스트" 같은 같은 글자가 있어서 `find` ref 로 누르면
     엉뚱한 곳이 눌린다. 드롭다운을 연 뒤 JS 로 해당 글자 요소들의 화면 좌표를 구해
     (`getBoundingClientRect` × 스크린샷 배율) 폼 쪽(왼쪽) 것을 좌표로 클릭하고,
     끝나면 `카테고리`~`노출 정보` 사이 텍스트가 `생활 | 콘텐츠 | 테스트`인지 확인한다.
   - 이미지: 브라우저가 PC 파일·localhost 에 접근하지 못하므로 **GitHub 원본에서 받아 파일
     입력에 넣는다** (10단계 푸시가 먼저여야 한다). `javascript_tool`:
     ```js
     const base='https://raw.githubusercontent.com/<owner>/<repo>/<branch>/factory/apps/<slug>/assets/';
     const get=async n=>new File([await (await fetch(base+n)).blob()], n, {type:'image/png'});
     const put=(el,files)=>{const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f)); el.files=dt.files; el.dispatchEvent(new Event('change',{bubbles:true}));};
     const single=()=>[...document.querySelectorAll('input[type=file]')].filter(e=>e.accept.includes('.PNG')&&!e.multiple);
     put(single()[0],[await get('logo.png')]);           // 앱 로고
     await new Promise(r=>setTimeout(r,2500));
     put(single()[0],[await get('logo.png')]);           // 다크모드 로고 (로고 칸이 채워지면 남는 단일 입력)
     await new Promise(r=>setTimeout(r,2500));
     put([...document.querySelectorAll('input[type=file]')].find(e=>e.multiple),
         [await get('screenshot-1.png'),await get('screenshot-2.png'),await get('screenshot-3.png')]);
     ```
     owner/repo/branch 는 `git remote get-url origin`·`git branch --show-current`로 구한다.
     업로드 뒤 `static.toss.im` 이미지가 600×600 과 636×1048 ×3 으로 보이는지, 다크모드 칸에 파일명이 뜨는지 확인한다.
     저장소가 비공개라 fetch 가 안 되면 이미지 칸만 사용자에게 맡긴다.
   - 앱 검색 키워드: 입력칸 클릭 → 키워드 `type` → `Return`, 반복. 끝나면 `Escape`
   - 주요 기능(선택): 비워 둔다
   - "앱을 등록하기 전에 확인해 주세요" 체크박스 5개를 모두 체크하고 `checked`가 전부 true 인지 확인
     (내용이 이 앱에 맞지 않는 항목이 있으면 체크하지 말고 사용자에게 알린다)
   - **임시저장** 클릭 → 저장되면 끝. "검토 요청하기"는 누르지 않는다.
4. 기록: `node scripts/status.mjs <slug> --set steps.console_info=done`

## 12. 홍보 릴스

저장소의 `promo/`에서 한다 (`promo/README.md`). 이 PC(Windows)에서 만들면 나레이션이 들어간다.

1. `promo/apps.json`의 `apps`에 앱을 추가한다: id=`slug`, name·keyword=`title`, tagline,
   description(실제 기능만, Claude 기획이 이것만 쓴다), audience, emoji,
   theme(`bg1` 어두운 색, `bg2`=대표색, `accent` 밝은 강조색), url=`""`(공개 웹 주소가 생기면 그걸로),
   `actions`=릴스 녹화 동작(첫 2.4초는 홈 화면 대기 → 핵심 동작 → 결과 보기 → 결과에서 scroll).
   편집 뒤 `node -e "JSON.parse(require('fs').readFileSync('promo/apps.json','utf8'))"`로 JSON 검사.
2. 대본을 직접 쓴다: `promo/plans/<slug>-<template>.json`
   (`template` 은 empathy·demo·result_reveal·pov·challenge 중 앱에 맞는 것. 형식은 기존 plans 파일 참고 —
   hook 18자 이내, scenes 3~5개 각 20자·2줄 이내, 강조는 `*별표*`, cta 16자 이내, caption, hashtags).
   자막 타이밍이 `actions`와 맞게: hook 2.2초 → 각 scene 의 seconds 합이 화면 변화와 같은 시점에 바뀌도록.
3. 앱 빌드를 띄우고 생성한다:
   ```bash
   cd factory/apps/<slug> && npx vite preview --port 47xx --strictPort --host 127.0.0.1   # 백그라운드
   cd promo && FFMPEG_PATH="$PWD/.tools/node_modules/ffmpeg-static/ffmpeg.exe" STATE_DIR="$PWD/state" \
     node src/generate.mjs --app <slug> --template <template> --plan plans/<slug>-<template>.json --url http://127.0.0.1:47xx/
   ```
   - FFmpeg 가 PATH 에도 `.tools`에도 없으면 `cd promo/.tools && npm i ffmpeg-static@5.2.0` (git 제외 폴더)
   - 배경음악은 `promo/assets/bgm/`에서 무작위. 분위기가 다른 곡이 필요하면
     `node src/bgm-synth.mjs --name <이름> --bpm <80~130> --key <0~11>`로 자작곡을 만든다 (다운로드 음원 금지)
4. 확인: `out/<id>/timeline.json`과 `meta.json`(`narrated`·`bgm`·`captured` 가 모두 채워졌는지),
   FFmpeg 로 프레임 6~7장을 타일로 뽑아 Read 로 본다. 자막과 화면이 어긋나면 actions·seconds 를 고쳐 다시 만든다.
5. vite preview 를 끈다. 완성 영상을 `promo/reels/<slug>/`에 복사해 GitHub 에도 올린다
   (`promo/out/`은 git 제외라 작업용, `promo/reels/`가 보관용):
   ```bash
   cd promo && mkdir -p reels/<slug> && cp out/<id>/reel.mp4 reels/<slug>/<id>.mp4 && cp out/<id>/thumb.jpg reels/<slug>/<id>.jpg \
     && node -e "process.stdout.write(require('./out/<id>/meta.json').caption)" > reels/<slug>/<id>.caption.txt
   ```
   같은 앱 릴스를 다시 만들었으면 이전 파일은 지우고 최신 것만 남긴다.
   `promo/apps.json`·plans·reels 를 커밋·푸시하고, 영상은 `SendUserFile`로 사용자에게도 보낸다.
   인스타 게시는 하지 않는다.
6. 기록: `node scripts/status.mjs <slug> --set steps.reel=done`

## 13. 마무리 보고 (여기서 멈춘다)

`node scripts/status.mjs <slug> --set steps.ready_for_review=done` 후, 검토 요청은 하지 않고
사용자에게 아래 형식으로 보고한다:

```
✅ <emoji> <title> (<slug>) — 검토 요청 직전까지 완료

  콘솔 앱 ID   <miniAppId>
  광고 그룹    배너 <id> · 전면형 <id> · 보상형 <id>
  번들         <deploymentId> (CREATED, 버전 <versionName>)
  테스트 링크  <bundle_test_push 가 준 privateLink>
  앱 정보      콘솔 웹에 입력·임시저장 완료 (또는 로그인 대기 등 이유)
  릴스         <초>초, 템플릿 <template> (나레이션·배경음악 여부)

남은 일 (직접):
  1. 토스 앱에서 테스트 링크로 열어 광고가 뜨는지 확인
  2. 콘솔 → <title> → 앱 등록 화면에서 내용 확인 후 "검토 요청하기"
  3. 릴스 캡션을 붙여 인스타에 게시
```
캡션(본문 + "👉 토스 앱에서 검색: <keyword>" + 해시태그)은 바로 붙여 넣을 수 있게 코드 블록으로 함께 준다.

여러 아이디어를 받았으면 앱마다 1~12를 돌리고, 끝에 `node scripts/status.mjs` 결과를 함께 보여준다.
