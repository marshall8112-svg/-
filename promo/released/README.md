# 출시된 앱 표시

토스에 출시(OPEN)된 미니앱마다 `<앱 id>` 파일이 하나씩 생긴다 (내용: 감지한 날짜).
PC 의 Claude 예약 작업("미니앱 출시 감시")이 콘솔 MCP 로 출시를 확인하고 이 파일을 만들어 푸시하면,
`.github/workflows/reels-release.yml` 이 `promo/reels/<앱 id>/` 의 최신 릴스를 인스타에 올린다
(`AUTO_PUBLISH` 가 true 가 아니면 승인 이슈를 먼저 띄운다).

손으로 다시 올리고 싶으면 Actions → 출시 릴스 게시 → Run workflow 에 앱 id 를 넣는다.
