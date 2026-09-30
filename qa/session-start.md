# 세션 시작 상태 동결 (2026-09-28)

## 작업 환경

- 실제 프로젝트 루트: `C:\Users\hanbi\Desktop\opencode test\치지직\chzzk-all-in-one` (별도 git 저장소, `main` 브랜치)
- 바깥 폴더 `C:\Users\hanbi\Desktop\opencode test\치지직`은 커밋이 전혀 없는 래퍼 저장소다. `git reset/clean` 등을 절대 실행하지 않는다.
- 참조 복사본(수정 금지): 바깥 폴더의 `playback-107/` (1.0.7 사용자 수정본), `upstream/` (Cheese-PIP, chzzk_auto_log_power, FUCK-CHZZK-GRID, Better-Chzzk, cheese-knife), `baseline-refactor-20260923.zip`, `QA-AUDIT-1.0.7.md`, `qa-audit-1.0.7.cjs`

## Git 상태

- HEAD: `dacc340` (main, origin/main과 동기화) — "Improve Firefox WebM recording quality in v1.1.11"
- staged 변경: 없음
- unstaged 변경: 13개 파일 (+470/−102). 안전 patch 사본: `qa/session-start-20260928.patch`
- untracked: 프로젝트 내부에는 없음

## 미커밋 변경의 의미 (중단된 작업 = v1.1.15)

커밋된 HANDOFF는 1.1.11까지다. 미커밋 변경은 **1.1.12/1.1.13/1.1.14의 완료된 작업 + 진행 중인 1.1.15**를 담는다:

1. **1.1.12 RAW 녹화**: `timeshift.js`에 `createRawRecorder` (hlsFragLoaded 조각 복사, TS/fMP4), `tools.js`에 RAW 버튼·STOP 다운로드·오류/플레이어 교체 중단, `test/timeshift.test.js` RAW 테스트. QA-CHECKLIST RAW-01~05 추가.
2. **1.1.13 TM 무제한 과거 버퍼**: `createTimeShift().enable()`의 `backBufferLength` 300 → `Infinity`.
3. **1.1.14 채팅/통나무/GIF**: 채팅 글자 크기 선택자에 `aside#aside-chatting [role='log'] [class*='_chatting_message_'] > [class*='_text_']` 추가. `content.js`에 `recordPowerBalance` (미기록 잔액 증가분을 `OTHERS` 로그로 저장). 움직이는 GIF 프로필 기능 완전 제거 (content.js/index.html/popup.js) — 사용자 명시 요청이었음.
4. **1.1.15 (진행 중)**: 일시정지 시 TM 패널 없이 버퍼 유지 (`keepPausedBuffering` — maxBufferLength/maxMaxBufferLength를 3600초로, buffering/loading 재개, 재생 재개 시 복원, 메모리 압박으로 낮아진 한도는 재상향 안 함). REC 음소거 독립 회귀 테스트(AUDIO-MUTED-REC). README/QA-CHECKLIST 문서 갱신.

## 버전/빌드 상태

- manifest.json / package.json / package-lock.json: 모두 **1.1.15** (일치)
- dist 최신 빌드: **1.1.14** (2026-09-25 22:18) — **1.1.15 빌드는 아직 없음**
- AMO 승인본: 1.1.10. push/릴리스/서명은 하지 않은 상태

## 테스트 baseline (2026-09-28 실행)

- `npm test`: 단위 **63/63 통과**
- `npm run test:audit`: 회귀 18/18, 오디오 15/15, UI 17/17 통과
- 루트 JS 전체 `node --check` 통과
- HANDOFF에 1.1.15 섹션 없음 (마지막 섹션이 1.1.14) — 작업 필요

## 남은 작업

1. HANDOFF.md에 1.1.15 섹션 추가
2. v1.1.15 빌드 (build.ps1) + web-ext lint
3. Firefox E2E harness (qa/firefox-e2e) 확인/구축 — Selenium + geckodriver + 실제 Firefox
4. 핵심 4종 (광고 / 광고경고 모달 / 최고화질 / GRID-P2P) 실환경 검증
5. 성능 baseline vs extension ON (PERF-A~J 중 현실적으로 가능한 범위)

## 복구 방법

- 미커밋 변경을 잃으면: `git apply qa/session-start-20260928.patch` (커밋 `dacc340` 위에서)
- 원본 working tree는 절대 reset/clean으로 되돌리지 않는다
