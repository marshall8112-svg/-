# 미니앱 홍보 릴스 자동화

매일 정해진 시간에 GitHub Actions가 아래를 자동으로 합니다.

1. **앱·템플릿 선택**: `apps.json`의 앱을 돌아가며 고르고, 최근에 안 쓴 템플릿(공감형, 시연형, 결과공개형, POV, 도전형)을 고릅니다.
2. **기획**: Claude가 첫 문구, 자막 3~5개, 마무리 문구, 캡션, 해시태그를 씁니다. 최근에 쓴 첫 문구와 겹치지 않게 합니다.
3. **화면 녹화**: 앱 `url`이 있으면 모바일 화면으로 실제 사용 장면을 녹화합니다. 없으면 그래픽만으로 만듭니다.
4. **합성**: 1080×1920, 12~18초 세로 영상을 만듭니다. `assets/bgm/`에 음악이 있으면 깔아 줍니다.
5. **승인 요청**: GitHub 이슈로 미리보기를 보냅니다. 휴대폰 GitHub 앱에서 댓글 하나로 처리합니다.
   - `/approve` → 인스타 릴스에 게시
   - `/reject` → 버리기
   - `/regen` → 같은 앱으로 다시 만들기
   - 캡션을 고치려면 이슈 본문을 편집한 뒤 `/approve` 하면 됩니다.
6. 패턴이 잡히면 저장소 변수 `AUTO_PUBLISH=true`로 바꿉니다. 그때부터는 승인 없이 바로 게시합니다.

## 처음 한 번 설정

### 1. 인스타그램 계정
- 계정을 만든 뒤 **설정 → 계정 유형 및 도구 → 프로페셔널 계정으로 전환**합니다. 크리에이터를 추천합니다.

### 2. Meta 개발자 앱 (토큰 발급)
1. https://developers.facebook.com → 내 앱 → **앱 만들기**를 누르고, 사용 사례로 **"Instagram에서 메시지 및 콘텐츠 관리"**를 고릅니다.
2. 왼쪽 **Instagram → API 설정(Instagram 로그인 사용)** 화면에서 **"액세스 토큰 생성"**의 계정 추가로 위 인스타 계정을 연결합니다.
   - 테스터 초대가 뜨면 인스타 앱의 **설정 → 웹사이트 권한 → 앱 및 웹사이트**에서 수락합니다.
3. 생성된 **액세스 토큰**(60일짜리)과 **Instagram 사용자 ID**를 복사합니다.
   - 권한은 `instagram_business_basic`, `instagram_business_content_publish`가 필요합니다.
   - 본인 계정에만 올리는 용도라 앱 검수 없이 개발 모드로 쓰면 됩니다.

### 3. GitHub 저장소 설정
**Settings → Secrets and variables → Actions**

| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `ANTHROPIC_API_KEY` | Claude API 키 (console.anthropic.com) |
| Secret | `IG_ACCESS_TOKEN` | 2번에서 받은 토큰 |
| Secret | `IG_USER_ID` | 2번에서 받은 사용자 ID |
| Secret | `GH_PAT` | (권장) 토큰 자동 연장용. Fine-grained 토큰을 만들고, 이 저장소에 **Secrets: Read and write** 권한만 줍니다 |
| Variable | `AUTO_PUBLISH` | 처음엔 만들지 않음 → 나중에 `true` |
| Variable | `REELS_PAUSED` | 잠깐 멈추고 싶을 때 `true` |

**Settings → Pages** 에서 Source를 **Deploy from a branch**로 두고, `reels-media` / `(root)`를 고릅니다. 인스타 서버가 영상을 가져가는 공개 주소로 씁니다.

### 4. 앱 정보 채우기 (`apps.json`)
- `description`: **꼭 실제 기능으로 고쳐 주세요.** Claude는 여기 적힌 기능만 사용합니다.
- `url`: 브라우저에서 열리는 앱 주소입니다. Vercel이나 GitHub Pages에 웹 빌드를 올린 주소 등을 넣습니다. 비우면 그래픽만으로 만듭니다.
- `actions`: 녹화 중에 할 동작입니다. 예:
  ```json
  [{ "type": "wait", "ms": 1500 }, { "type": "click", "selector": "text=시작하기" },
   { "type": "fill", "selector": "input", "value": "홍길동" }, { "type": "click", "selector": "button" },
   { "type": "wait", "ms": 3000 }]
  ```
  `type`으로는 `wait` / `click` / `tap(x,y)` / `fill` / `type` / `upload` / `scroll`을 쓸 수 있습니다.
- `theme`: 배경 그라데이션과 강조색, `emoji`: 대표 이모지입니다.
- `account.handle`: 인스타 아이디로 바꿔 주세요.

### 5. 배경음악 (선택)
`assets/bgm/`에 mp3를 넣으면 무작위로 하나를 씁니다. API로 올리는 영상은 인스타 음원 라이브러리를 쓸 수 없습니다. 그러니 **상업적 사용과 SNS 업로드가 허용된 무료 음원**만 넣으세요.

## 실행
- 자동: 매일 09:17 (KST)에 실행됩니다. 시간은 `.github/workflows/reels-generate.yml`의 cron에서 바꿉니다.
- 수동: **Actions → 릴스 생성 → Run workflow**를 누릅니다. 앱과 템플릿을 지정할 수도 있습니다.
- 로컬:
  ```bash
  cd promo && npm ci && npx playwright install chromium
  ANTHROPIC_API_KEY=... node src/generate.mjs --app hachanum   # out/<id>/reel.mp4
  ```
  FFmpeg가 설치돼 있어야 합니다.

## 파일
| 파일 | 하는 일 |
|---|---|
| `src/plan.mjs` | Claude로 기획안을 만들고 캡션을 조립 |
| `src/capture.mjs` | 앱 화면 녹화 (Chrome 화면 캐스트 → mp4) |
| `src/render.mjs` | 자막 레이어(HTML→PNG)와 FFmpeg 합성 |
| `src/generate.mjs` | 위 단계를 묶어 영상 1편 생성 |
| `src/publish.mjs` | Instagram Graph API로 릴스 게시 |
| `src/issue.mjs` | 승인 이슈 본문을 만들고 읽기 |
| `src/history.mjs` | 게시 이력 기록 (`reels-media` 브랜치의 `history.json`) |
| `src/refresh-token.mjs` | 60일 토큰 연장 |
