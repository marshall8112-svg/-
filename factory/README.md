# 미니앱 공장 (앱인토스)

아이디어 한 줄을 주면 Claude Code가 아래를 끝까지 하고 **검토 요청 직전에 멈춥니다.**

1. 기획 → 미니앱 구현 (React + `@apps-in-toss/web-framework` 3.x)
2. 광고 삽입: 배너 · 전면형 · 보상형 (반려 사유가 되는 배치는 자동 검사)
3. 등록 이미지 생성: 로고 · 썸네일 · 실제 앱 화면 스크린샷 3장 (콘솔 규격 그대로)
4. 콘솔에 앱 등록 → 광고 그룹 생성 → 앱에 광고 그룹 ID 연결
5. 출시 번들(`.ait`) 빌드 → 콘솔 업로드 → 컴파일 확인 (`CREATED`)
6. 보고 → **검토 요청은 직접** (콘솔 → 앱 → 번들 → 검토 요청)

검토 요청·출시·프로모션 도구는 `.claude/hooks/guard-console.mjs`가 막아 둡니다. 실수로도 제출되지 않습니다.

## 처음 한 번 설정 (이 PC)

1. **Node 24 이상**, git, Claude Code 설치
2. 이 저장소를 받고 공장 의존성 설치
   ```bash
   git clone <이 저장소> && cd <저장소>/factory
   npm install
   npx playwright install chromium
   ```
3. 저장소 루트에서 `claude` 실행 → `/mcp` → **apps-in-toss-console** 선택 → 토스 계정으로 인증
   (`.mcp.json`에 콘솔 MCP와 문서 MCP가 이미 들어 있습니다)
4. 개발자 정보: `factory/profile.example.json`을 `factory/profile.json`으로 복사해 채웁니다.
   비워 두면 첫 실행 때 Claude가 물어봅니다. (`profile.json`은 git에 올라가지 않습니다)
5. 콘솔에서 미리 해 둘 것: 워크스페이스 · 사업자/정산 정보 · **인앱 광고 이용 신청**.
   광고 정산 정보가 없으면 광고 그룹을 만들 수 없습니다.

## 사용

저장소 루트에서 Claude Code를 열고:

```
/miniapp-factory 오늘 점심 메뉴를 룰렛으로 골라주는 앱
```

여러 개도 됩니다:

```
/miniapp-factory 점심 메뉴 룰렛 | 내 MBTI로 보는 오늘의 운세 | 10초 반응속도 테스트
```

진행 상황 보기:

```bash
cd factory && node scripts/status.mjs
```

```
🍱 점심룰렛 (lunch-roulette)  콘솔 앱 ID: 12345  번들: CREATED
   ✅ scaffold  ✅ build_app  ✅ assets  ✅ console_app  ✅ ad_groups  ✅ release_build  ✅ upload  ✅ ready_for_review
```

중간에 끊겨도 같은 명령(`/miniapp-factory`)으로 다시 부르면 `factory.json`에 기록된 단계부터 이어 갑니다.

## 구조

| 경로 | 내용 |
|---|---|
| `template/` | 새 앱의 뼈대. 광고 모듈(`src/lib/ads.ts`, `src/lib/AdSlots.tsx`) 포함 |
| `apps/<slug>/` | 만들어진 앱. `factory.json`(진행 기록), `SPEC.md`(기획), `assets/`(등록 이미지) |
| `scripts/new-app.mjs` | 템플릿 복사 + 이름·색 채우기 + 설치 |
| `scripts/check.mjs` | 광고 배치·이미지 규격·appName 검사 + `npm run build`(→ `.ait`). `--release`면 광고 ID까지 필수 |
| `scripts/assets.mjs` | 등록 이미지 생성 (실제 앱 빌드를 띄워 스크린샷) |
| `scripts/set-ads.mjs` | 광고 그룹 ID를 앱에 연결 |
| `scripts/upload.mjs` | `.ait` 업로드 (`--put <콘솔 업로드 주소>` 또는 `--cli` = `ait deploy`) |
| `scripts/status.mjs` | 현황 보기 / `--set`으로 기록 |
| `../.claude/skills/miniapp-factory/SKILL.md` | 전체 순서를 Claude에게 지시하는 문서 |
| `../.claude/hooks/guard-console.mjs` | 검토 요청·출시 도구 차단 |

## 광고 모듈

```tsx
import { showInterstitial } from './lib/ads';
import { AdBanner, RewardedButton } from './lib/AdSlots';

// 결과로 넘어갈 때 전면 광고 (60초 빈도 제한, 광고 없으면 바로 통과)
await showInterstitial();
setStep('result');

// 결과 화면
<AdBanner />
<RewardedButton label="광고 보고 추가 결과 보기" onReward={() => setBonus(true)} />
```

- 광고 그룹 ID는 `src/ad-config.json`에서 읽습니다 (`set-ads`가 채움).
- `npm run dev -w <slug>`로 띄우면 devtools mock SDK가 붙어 브라우저에서도 광고 흐름을 확인할 수 있습니다 (ID가 비어 있어도 mock ID 사용). 운영 번들에는 mock이 들어가지 않습니다.
- 토스 앱 밖이나 지원하지 않는 토스 앱 버전에서는 조용히 건너뜁니다.
- devtools mock은 보상형 광고의 보상 이벤트(`userEarnedReward`)를 보내지 않습니다. 보상 지급은 토스 앱 테스트 링크로 확인하세요.

## 손으로 돌리기

```bash
cd factory
node scripts/new-app.mjs lunch-roulette --title "점심룰렛" --tagline "고민 말고 돌려요" --color "#F97316" --emoji "🍱"
# apps/lunch-roulette/src/App.tsx 구현
node scripts/check.mjs lunch-roulette
node scripts/assets.mjs lunch-roulette
node scripts/set-ads.mjs lunch-roulette --banner <ID> --interstitial <ID> --rewarded <ID> --reward-name "다시 돌리기"
node scripts/check.mjs lunch-roulette --release
AIT_API_KEY=<배포 키> node scripts/upload.mjs lunch-roulette --cli
```
