# CHZZK All-in-One 인수인계 / 현황 (최신: 2026-10-04)

## 최신 작업 위치와 버전

- 기준 저장소: `C:\Users\hanbi\Documents\ChatGPT\치지직\chzzk-all-in-one`. 바깥 `치지직` 폴더의 빈 Git 저장소와 구분한다.
- 공통 소스·빌드 **1.1.28**(2026-10-04, 미커밋 빌드. 1.1.27은 커밋 `2740b5e`로 main·codex/chrome-compat에 push 완료. 이전 기록: 1.1.27: 사용자 제안으로 채팅 애니메이션을 "새 메시지만" 방식으로 교체 — 기존 메시지는 즉시 한 칸 올리고, 새로 들어온 메시지(같은 순간 여러 개면 한 덩어리)만 `translateY(새 메시지 높이 합)`→0으로 140ms ease-out 슬라이드. 아래 경계 밖은 목록 overflow가 잘라 주며 scrollHeight는 변하지 않음(정적 페이지 측정). 높이 애니메이션·overflow/flex-shrink 조작은 제거. 이전 1.1.26: 1.1.25 채팅 애니메이션을 사용자 피드백("눈이 아프고 가독성 떨어짐")으로 페이드 제거·120ms(동시 4개 이상 80ms)·ease-out으로 완화. 1.1.24도 미커밋 빌드로 사용자 QA 예정이었음. 커밋·push 여부는 `git status`로 확인). 1.1.23 기준: `main` = `codex/chrome-compat` = `origin/main` = `origin/codex/chrome-compat` = `b087a76` (2026-10-02 사용자가 Windows에서 push). 원격 `https://github.com/birowsi/CHZZK-All-in-One.git`. 이 문서 갱신 커밋은 그 뒤 로컬 커밋이며 push 여부는 `git status`로 확인한다.
- 빌드 결과: `dist/chzzk-all-in-one-firefox-v1.1.28.zip`/`.xpi`(미서명), `dist/chzzk-all-in-one-chrome-v1.1.28/`와 ZIP. dist는 Git에 올리지 않는다.
- 아래 날짜별 절의 오래된 HEAD/버전 표기는 각 작업 당시 기록이다.

## 지금 상태 한눈에 보기 (2026-10-02 기준)

### 동작이 확인된 것
- Chrome 1.1.23의 `PIP` 버튼과 PIP 중 REC 유지: 사용자가 설치해 써 보고 "잘 된다"고 확인(2026-10-02). 광고·버퍼링 등 세부 상황별 확인은 따로 받지 않았다.
- Firefox COMP ON/OFF·슬라이더가 되돌아가던 문제: 1.1.22에서 사용자 확인으로 해결.
- Chromium 테스트 페이지 측정(실방송 아님): PIP·더 큰 영상·사이트 내 이동·탭 전환 중 녹화 유지, 컴프레서 실제 압축, 음소거 상태 녹화의 원본 소리.
- 자동 테스트: 단위 82, 기본 회귀 23, 오디오 19, UI 19 (합계 143) 통과.

### 아직 확인하지 못한 것 (다음 우선순위 순)
1. Firefox 1.1.23 실환경: 확장 `PIP` 버튼이 없는지, 기본 PiP 중 REC가 유지되는지, REC 중 청취·컴프레서 소리. 일반 Firefox에 영구 설치하려면 1.1.23 ZIP을 AMO에 제출해 서명본을 받아야 한다(문서상 AMO 승인 기록은 1.1.10이고, 2026-10-01 확인 때 사용자 Firefox에는 1.1.21 서명본이 설치돼 있었다. 1.1.22 이후 서명 여부는 기록이 없다).
2. 통나무: 실제 1시간 시청 보상 후 로그 금액이 실제 잔액 증가와 같은지. 1.1.23부터 클릭만으로는 기록하지 않으므로, 버튼은 눌렸는데 로그가 없으면 `log-power` 잔액 조회(1.5/5/15초 뒤)가 증가를 못 본 것이다.
3. RAW 녹화, 광고 건너뛰기, GRID 1080p, 팔로잉 알림·hover 미리보기의 실방송 동작.
4. 일시정지 버퍼는 MSE 메모리 한계로 1080p에서 약 2분대까지만 쌓인다(1.1.16 실측). 더 길게 하려면 MSE 밖 저장 설계가 필요하다.

### 원격(Claude 앱) 세션에서 작업할 때 알아둘 것
- 연결된 PC 셸은 Windows가 아니라 폴더만 마운트된 리눅스 환경이다. `pwsh`가 없어 `build.ps1`을 못 돌리므로 같은 파일 목록·manifest 변환을 Python `zipfile`로 수행한다(Chrome 폴더 빌드는 `qa/chrome-pip-audio/build_chrome.py` 참고). Windows에서는 기존대로 `.\build.ps1`, `.\build.ps1 -Browser Chrome`.
- 그 셸과 클라우드 작업 공간 모두 `chzzk.naver.com`과 GitHub에 접속할 수 없다. Claude in Chrome도 CHZZK를 안전 정책으로 차단한다. 실방송 확인은 사용자가 하고, push는 사용자가 Windows에서 `git push origin main codex/chrome-compat`를 실행한다(claude.ai Connectors에 GitHub를 연결하면 원격에서도 가능).
- 작업 트리는 CRLF, 저장소는 LF다. 리눅스 셸에서는 `git -c core.autocrlf=true status/add/commit`을 써야 줄바꿈만 다른 파일이 변경으로 잡히지 않는다. 그냥 `git status`를 보면 40여 개 파일이 변경으로 보인다.
- 이 폴더는 기본적으로 파일 삭제가 막혀 있어 Git이 `.git/index.lock`을 못 지운다. 커밋 전 삭제 권한을 받고 `rm -f .git/index.lock` 한다.
- `playback-107`은 연결이 끊긴 오래된 1.0.2 worktree(`codex/playback-recovery`)다. 건드리지 않았다.

## 2026-10-04 RAW 저지연 HLS 부분 조각 지원 — 1.1.28

- 사용자 제보: RAW가 모든 방송에서 `저지연 HLS 부분 조각은 RAW 저장을 지원하지 않습니다`로 중단(기존 HANDOFF의 1.1.16·실방송 QA 기록과 일치). 원인: 치지직 플레이어는 LLHLS를 쓰고 hls.js가 `hlsFragLoaded`를 부분 조각(part)마다 보내는데, `createRawRecorder`가 part를 보면 무조건 실패 처리했다.
- 실제 방송 확인(채널 `75cbf189…`, 2026-10-04): LLHLS 재생 목록은 fMP4(`EXT-X-MAP`), 2초 조각당 1초 part 2개, 모든 part `INDEPENDENT=YES`, part는 `moof`로 시작. 한 조각의 part 2개를 이어 붙인 바이트가 같은 조각 전체 파일과 **완전히 일치**(775,987바이트).
- 수정(`timeshift.js`): part를 같은 조각 안에서 번호 순서대로 연결한다. 시작은 조각 전체·0번 part·독립 part에서만. 이미 받은 조각/part 재전송, part 뒤에 온 같은 조각 전체는 건너뛴다. 같은 조각 안 part 번호가 건너뛰거나 조각 번호가 건너뛰면 기존처럼 부분 파일 저장 후 중단. 한계: 조각의 마지막 part가 빠진 채 다음 조각 0번 part가 오면 감지하지 못한다(조각당 part 수를 알 수 없음).
- `qa/chrome-e2e.cjs`: RAW 실패 시 특정 문구를 요구하던 단언을 제거하고 사유만 기록.
- 자동: 단위 84/84(새 LL-HLS RAW 테스트: 중간 비독립 part 무시, 재전송·중복 전체 조각 무시, part→다음 조각 전체 연결, part 누락 시 부분 파일), 회귀 23, 오디오 19, UI 21. 빌드 Firefox 41/Chrome 43, manifest 1.1.28, 패키지 timeshift.js 일치.
- AMO: 2026-10-04 `.\sign.ps1`로 1.1.28을 직접 배포(unlisted)로 제출·서명 완료. 서명본 `dist/signed-v1.1.28/7f27e59867454bfd8439-1.1.28.xpi`(스크립트가 버전·META-INF 서명 확인). sign.ps1은 이제 `git ls-files`에서 과거에 커밋된 `dist/`·`node_modules/`를 뺀 소스 ZIP(`dist/chzzk-all-in-one-source-v<버전>.zip`, 약 35MB)을 `--upload-source-code`로 함께 제출한다. 첫 시도는 PC 시계가 AMO보다 58초 빨라 `JWT iat ... invalid`로 거부됐고(제출 안 됨), 사용자가 Windows 시간 동기화 후 성공. API 키는 사용자 환경 변수 `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET`에 있다(값은 기록하지 않음).
- 미확인: 실제 확장에서 RAW 저장 파일의 재생·오디오(치지직 LLHLS는 오디오가 같은 조각에 들어 있는지 이번에 확인하지 않음 — 별도 오디오 트랙이면 기존 검사로 중단된다), 화질 자동 전환 시 중단 빈도.

## 2026-10-03 제한 중계 표시·채팅 부드럽게 올리기 — 1.1.25

### 제한 중계 분석과 범위
- 사용자 제보: 아시안게임 같이보기 방송(`/live/45e71a76e949e16a34764deb962f9d9f`)이 1080p로 몇 초 보이다 오류 후 저화질 고정. live-detail 확인 결과 `liveCategory=asiangames2026`, `watchPartyNo` 있음, `krOnlyViewing=true`, 인코딩 트랙은 480p·360p·오디오 전용뿐이고 트랙 ID가 `480p` 같은 이름이 아닌 무작위 문자열이다. 확장의 1080p 우회(`480p`→`1080p` 경로 치환)는 이 방송에 적용되지 않는다. 몇 초간의 1080p 원인은 확인하지 못했다.
- 중계권 제한을 우회하는 작업(목록에 없는 고화질 경로 추측 요청, 관련 우회 도구 탐색)은 하지 않기로 했다. 이 세션에서 해당 CDN 탐색 요청은 자동 안전 검사로 거부되었고, 사용자 재요청에도 진행하지 않았다. 대신 표시 기능만 추가했다.

### 수정
1. `tools.js` 제한 중계 표시: `maxPlaybackHeight`(live-detail 재생 정보의 최고 videoHeight, 오디오 전용 제외)와 `isRestrictedPlayback`(0 초과 720 미만). `refreshPlaybackLimit`이 방송마다·1분마다 live-detail을 다시 조회한다. 제한이면 Q 버튼이 `Q 480p 제한`(주황색 `is-limited`), title·클릭 안내에 "서버가 최고 480p까지만 제공"을 표시한다. 화질 요청은 바꾸지 않는다.
2. `tools.js` 채팅 부드럽게 올리기(새 설정 `chatSmooth`, 기본 ON, 팝업 "새 채팅 부드럽게 올리기"): 사이트 채팅 목록은 `[role=log]` 안 `_wrapper_…`(column-reverse, overflow-y auto, 첫 자식 `_list_bottom_…`)이다(2026-10-03 사이트 JS/CSS 확인). 그 목록에만 MutationObserver를 붙여 새 메시지 높이를 0→실제 높이로 180ms(4개 이상 동시면 120ms) 애니메이션한다. 맨 아래(scrollTop≈0)일 때만, 13개 이상 동시 추가·탭 숨김·reduced-motion이면 하지 않는다. flex 컨테이너에서 찌그러지지 않게 애니메이션 중에만 overflow hidden·flex-shrink 0을 주고 종료/타임아웃 때 원래대로 되돌린다(타임아웃은 멈춘 애니메이션도 finish).

### 검증
- 자동: 단위 83/83(제한 중계 판정, 실제 응답 구조), 회귀 23/23, 오디오 19/19, UI 21/21(Q 버튼 `제한` 표시 포함).
- 실제 치지직 index.css + tools.js 정적 채팅 페이지(내장 Chromium): column-reverse 확인, 새 메시지 높이 0→19→25→28px, 다른 메시지 높이 유지, 종료 후 inline 스타일 복원·애니메이션 제거, 위로 스크롤 중·20개 일괄 추가는 애니메이션 안 함. 내장 브라우저 창이 숨김 상태라 애니메이션 시점은 currentTime을 직접 지정해 측정했다. 실방송 채팅 체감은 미확인.
- 빌드: Firefox 41/Chrome 43 항목, manifest 1.1.25, 패키지 tools.js/tools.css/index.html/popup.js가 소스와 일치.

## 2026-10-03 COMP 자동 숨김·RAW 버퍼링 중단·전체화면 안내 — 1.1.24

### 요청
- 사용자 제보: 플레이어 UI가 숨겨져도 컴프레서 컨트롤이 계속 보임. 이후 "더 찾아 볼래?" 요청으로 코드 검토해 두 건을 추가로 수정. 이번 세션은 Windows 로컬(build.ps1 사용 가능)이다.

### 수정
1. `tools.css` COMP 자동 숨김(1.1.22 회귀): 사이트는 바 전체가 아니라 `.pzp-pc__volume-control`, `.pzp-pc__setting-button` 등 클래스별로 `opacity:0`을 주고 `.pzp-pc--controls`일 때만 `opacity:1`로 보인다(2026-10-03 실제 player-vendor CSS 확인). 1.1.22에서 COMP root의 `pzp-pc__volume-control` 클래스를 제거해 숨김 대상에서 빠졌다. 클래스를 되돌리지 않고 `#hanbi-audio-compressor`에 같은 규칙(opacity 0/1, 0.2s, `--ended`에서 숨김)을 추가했다.
2. `tools.js` RAW 중단 조건: `prepareVideo`가 `rawRecording.source !== video()`이면 RAW를 끝냈다. 버퍼링(readyState<2 → video()=null)이나 더 큰 광고/미리보기 video만으로 RAW가 멈췄다(1.1.23에서 REC만 고쳐진 같은 결함). 이제 녹화 video가 문서에서 제거되거나 경로가 바뀔 때만 끝낸다. 플레이어 교체·방송 이동은 기존 timeshift.js 페이지 측 검사가 처리한다.
3. `tools.js` 전체화면 오버레이: 안내 토스트·REC 표시·팔로잉 알림이 body에 붙어 전체화면에서 보이지 않았다. `overlayHost()`(fullscreenElement 또는 body)에 붙이고, `fullscreenchange` 때 토스트·REC 표시·스크린샷 미리보기·TM 창·팔로잉 알림을 새 위치로 옮긴다. 부수 효과: 전체화면에서도 팔로잉 알림이 뜬다(15초 후 사라짐).

### 검증
- 자동: 단위 82/82, 기본 회귀 23/23, 오디오 19/19, UI 21/21(새 RAW-STALL, FULLSCREEN-OVERLAY). RAW-STALL은 1.1.23 tools.js에서 실패함을 확인.
- 실제 치지직 player-vendor CSS + tools.css 정적 페이지(Chromium 내장 브라우저)에서 COMP opacity: controls 1, 숨김 0, ended display:none. 실방송 확인 아님.
- 빌드: `.uild.ps1`, `.uild.ps1 -Browser Chrome`. Firefox 41/Chrome 43 항목, manifest 1.1.24, 패키지 tools.js/tools.css가 소스와 일치.
- 미확인: 실방송에서 COMP 숨김, RAW 버퍼링 중 유지, 전체화면 안내 표시. 사용자가 QA 예정.

## 2026-10-02 Chrome PIP 복구·PIP 중 녹화 유지·통나무 로그 검증 — 1.1.23

### 요청과 원칙
- 사용자 요청: 버그·작동 안 되는 기능 정리, Chrome PIP 버튼 복구, PIP 모드에서도 녹화 유지, 미확인 항목 확인. 이후 "지울 기능은 없고 고치라는 뜻"으로 정정했으므로 기능 삭제 없이 수정만 했다.
- Claude in Chrome은 사용자 Chrome에 연결됐지만 `chzzk.naver.com`을 안전 정책으로 차단했다(사용자 사이트 허용과 무관한 오류). 이 작업 환경의 셸도 CHZZK에 접속할 수 없다. 따라서 이번 검증은 실제 방송이 아닌 Chromium + 가짜 플레이어 페이지 검사다.

### 수정
1. `tools.js` PIP: 표준 Picture-in-Picture API(`document.pictureInPictureEnabled`)가 있을 때만 `PIP` 버튼을 만든다. Chrome에는 생기고, Firefox는 자체 PiP 버튼이 있으므로 사용자 요청에 따라 UA 검사로 명시적으로 제외한다(표준 API 유무와 무관). 녹화 중이면 녹화 중인 video를 PiP로 띄우고, 사이트의 `disablePictureInPicture`는 사용자가 누른 경우에만 해제한다. PiP 상태는 버튼 강조/aria-pressed로 표시한다.
2. `tools.js` 녹화 유지(실제 결함): 기존 `prepareVideo`는 "가장 큰 재생 영상"이 녹화 중인 video와 다르면 녹화를 끝냈다. 버퍼링으로 readyState가 2 미만이 되거나, 광고/미리보기 등 더 큰 video가 나타나기만 해도 녹화가 끊겼다. 새 `shouldStopRecording`은 녹화 video가 문서에서 제거되거나 다른 경로로 이동했을 때만 끝낸다. 단 PiP로 보던 video는 사이트 내 이동 후에도 유지한다. src 교체·종료는 기존 emptied/ended 리스너가 처리한다. `video()`는 PiP 중인 video를 우선한다.
3. `content.js` 통나무 시청 보상 로그(문서의 남은 문제 1·2·3):
   - 버튼 클릭 직후 구독 등급으로 추정한 100/120/200을 기록하던 방식을 없앴다. 클릭 전 잔액을 기준으로 잡고 1.5/5/15초 뒤 `log-power` 잔액 증가가 확인될 때만 그 증가분을 `view`로 기록한다(2분 내 미확인 시 기록 없음). 다음 시청 보상 시각도 실제 지급 기준이 된다.
   - 잔액 증가 로그 저장 실패 시 기준 잔액을 되돌려 다음 조회에서 재시도한다.
   - 증가 로그에 `balanceAfter`를 넣고 `log-store.js`의 직렬화된 append에서 같은 채널·같은 잔액 증가 로그를 중복으로 막아 여러 탭의 OTHERS 중복을 없앴다.
   - 사용하지 않게 된 `getViewPowerAmountBySubscription`과 관련 메모리 변수를 제거했다.

### 검증
- 자동: 단위 82/82, 기본 회귀 23/23, 오디오 19/19, UI 19/19(PIP 버튼 유무 포함). 새 회귀: 클릭만으로는 로그 없음, 확인된 증가만 view, 저장 실패 시 기준 복구, 두 탭 동시 기록 1건.
- Chromium 141(Playwright) + Xvfb에 압축 해제 Chrome 빌드 설치, `chzzk.naver.com` 요청을 가짜 플레이어 페이지로 라우팅(`qa/chrome-pip-audio/`, 결과 `qa/chrome-pip-audio-1.1.23.json`):
  - 버튼 `REC RAW SHOT PIP Q TM`. PIP 클릭 → 실제 PiP 진입, aria-pressed=true.
  - REC 후 PiP → 더 큰 video 등장 → SPA 이동(`/lives`) → 다른 탭 전환 동안 녹화 유지, STOP 후 결과 창 13.9초·1280×720 WebM.
  - 같은 시나리오의 1.1.22 tools.js는 더 큰 video가 나타나는 즉시 녹화가 끝났다(수정 전 결함 재현).
  - COMP 출력 레벨(테스트 전용 AnalyserNode 탭, 배포 코드 무변경): OFF 큰/작은 소리 차 39.1dB → ON 34.2dB, 작은 소리 −61.1→−48.6dB, 게인 2는 +6.0dB.
  - 플레이어 음소거 상태 REC 결과 파일: 원본 음량 그대로(피크 −18.4dB, 테스트 음원 최대값과 일치).
- 미확인: 실제 CHZZK 방송에서의 위 동작, Firefox 실환경(이번 환경에 Firefox 없음), 실제 통나무 지급 응답, RAW/광고/GRID 실방송. 일시정지 버퍼의 약 2분 한도는 MSE 메모리 한계로 이번에 바꾸지 않았다.
- 사용자 확인(2026-10-02): Chrome 1.1.23 PIP·녹화 "잘 된다". 이후 사용자 요청으로 Firefox PIP 버튼 명시 제외(`b087a76`)를 추가하고 같은 1.1.23으로 Firefox/Chrome 패키지를 다시 만들었다(패키지 tools.js와 소스 일치 확인).
- GitHub: 원격 세션에서는 push할 수 없었다(PC 셸은 GitHub 차단, 클라우드는 GitHub 미연결). 사용자가 Windows에서 `git push origin main codex/chrome-compat`를 실행했고, 로컬 원격 추적 ref가 두 브랜치 모두 `b087a76`인 것을 확인했다. release 생성·AMO 제출은 하지 않았다.
- 빌드: Windows PowerShell이 없는 연결 환경이라 build.ps1과 같은 파일 목록·manifest 변환을 Python/zip으로 수행했다(ZIP 항목 수·버전 확인).

## 2026-10-01 Firefox 컴프레서 컨트롤 간섭 경로 수정 — 1.1.22

### 사용자 증상과 조사 근거

- 요청: Firefox COMP on/off 수정 및 GitHub 업데이트. 증상은 클릭하거나 슬라이더를 움직인 직후 ON·중간값으로 돌아감. 원격 push는 이번 요청으로 허가되었으며 release 생성·AMO 제출·사용자 프로필 수정은 수행하지 않는다.
- 실제 저장소 `codex/chrome-compat`, 시작 HEAD `287559a`, 시작 tracked diff 없음. 원격 main은 `dacc340`(1.1.11), 로컬 main은 `84f1404`(1.1.18). 두 main 모두 현재 공통 개발 분기의 조상임을 확인했다. 이력을 재작성하거나 force push하지 않고 이전 1.1.19~21 수정도 함께 반영한다.
- 사용자 기본 Firefox 프로필의 extensions.json 및 설치 XPI를 읽기 전용으로 확인했다. CHZZK All-in-One 1.1.21 active=true이고 tools.js는 현재 소스와 정확히 일치한다. 서명본 manifest 포맷 차이는 있으나 content_scripts의 파일·world·실행 시점은 일치한다. 다른 CHZZK 관련 별도 확장들은 해당 메타데이터에서 inactive였다. 설정·쿠키·계정·서명본은 변경하지 않았다.
- 임시 Firefox 157 초기 조사에서 키보드만 사용하는 슬라이더 검사와 일부 클릭이 실패한 실행이 있었다. trusted pointer 조작으로 보완한 기존 소스 검사에서는 ON/OFF·게인·새로고침 유지가 통과했다. 따라서 사용자의 지속적인 즉시 초기화는 동일 환경에서 재현·원인 확정한 것으로 처리하지 않는다. `qa/firefox-compressor-1.1.21.json`은 마지막 baseline 실행 결과이며 앞의 실패 실행 기록은 포함하지 않는다. baseline 영상은 paused=true였으므로 재생 중 성공 근거로 사용하지 않는다.
- 코드에서 확인된 결함: 컴프레서 root가 사이트 볼륨 컨트롤 클래스와 legacy knife-comp를 사용하고 버튼도 사이트 설정 클래스를 사용함. native 볼륨 DOM이 사라지면 확장 자신을 볼륨 anchor로 선택할 수 있음. 조작 이벤트가 플레이어 부모로 버블링함. 기존 ID의 복제 DOM을 만나면 리스너 없는 컨트롤을 계속 재사용함. 이 조건을 실제 소스 추출 모의 검사로 재현해 수정 전 새 검사 4건 실패/기존 오디오 15건 통과를 확인했다. 실제 사이트가 이 실행에서 DOM을 복제했다는 근거는 없다.

### 최소 수정 및 보존 사항

1. `tools.js`: COMP에 전용 root 클래스 사용, 버튼의 사이트 설정 클래스 제거(일반 pzp-button 스타일 유지). native 볼륨 anchor 검색에서 COMP ID 제외. 동일 버튼·슬라이더·위치와 0~200% 보정 게인 기능을 유지한다.
2. COMP root의 pointerdown/up·click·input/change·keydown/up 버블링만 차단한다. preventDefault를 호출하지 않아 range 기본 동작을 유지하고 document capture 단계의 기존 AudioContext 재개도 유지한다. 플레이어 전체 이벤트 핸들러는 변경하지 않는다.
3. WeakSet으로 리스너를 설치한 root를 구분하고, 복제/교체되어 리스너 없는 COMP만 다시 생성한다. ON/OFF 변수와 게인·영상별 오디오 그래프를 DOM 재생성과 함께 초기화하지 않는다. 이미 같은 슬라이더 값에는 value를 다시 쓰지 않는다.
4. 기존 `hanbi_comp_enabled`/`knifeGain` 저장키와 데이터, DynamicsCompressor 파라미터, 그래프 재사용/원음 bypass/실패 복구/Firefox REC 청취/음소거 녹화 경로는 유지한다. 새 observer·polling·timer·fetch/XHR patch·보조 프로그램을 추가하지 않았다. 별도 Firefox/Chrome 임시 기능 대체 구현도 만들지 않았다.

### 검증 결과와 정확한 범위

- 자동: 단위 81/81, 기본 회귀 21/21, 오디오 19/19(기존 15 + 컨트롤 관련 4), UI 19/19. 합계 140. 변경 JS와 QA 스크립트 문법 및 git diff --check 확인. 추적 파일 삭제 없음.
- 실제 Firefox 157: 기존 Selenium/geckodriver 및 BiDi 임시 add-on으로 throwaway headless 프로필에서 검사했다. 사용자 Firefox를 닫거나 기존 프로필에 설치·설정 변경하지 않았다. 새 의존성을 설치하지 않았고 바탕화면에 이미 있는 QA node_modules를 NODE_PATH로 참조했다. 재현 시 해당 경로가 없어지면 기존 qa/firefox-e2e/package.json 환경이 필요하다.
- 실제 CHZZK 비로그인 방송 `/live/75cbf189b3bb8f9f687d2aca0d0a382b`: trusted COMP 클릭, 게인 0·2, 드래그 1.42, OFF, 새로고침 후 OFF/1.42 유지 확인. 재생 요청 후 높이1080 영상이 paused=false, currentTime 29.22→34.92초로 진행하고 error=null을 유지했다. COMP 클릭이 부모 측 테스트 listener로 전달되지 않음(0건), 컨트롤 1개 유지 확인. `qa/firefox-compressor-1.1.22.json`의 9개 검사 통과.
- 컨트롤 복제 검사는 임시 테스트 탭에 cloneNode(true)로 의도적으로 교체한 fixture다. ON/1.42 보존·리스너 복원·이후 OFF 성공을 확인했으며 자연 발생한 사이트 DOM 복제로 기록하지 않는다. 기존 소스에서 이 시나리오가 실패하는 것은 모의 회귀 검사로 확인했다.
- headless QA의 media.volume_scale=0 설정을 사용했다. 실제 방송 소리를 청취하거나 DSP 파형/압축 효과를 측정하지 않았다. UI와 재생 확인만으로 컴프레서 음향 효과 및 모든 녹화 회귀를 실제 검증했다고 주장하지 않는다. 콘솔은 사이트 `setPolicyInfo Object(3)` 경고 1건, 수집된 error 0건이다.
- Chrome Browser Use/Windows native Computer Use/sky를 사용하지 않았다. Chrome 1.1.22 컨트롤은 공통 소스 및 패키지 검사만 수행했다.

### 빌드·배포와 다음 직접 확인

- manifest/package/package-lock 두 버전 및 Firefox/Chrome 패키지 manifest 1.1.22 일치. `dist/chzzk-all-in-one-firefox-v1.1.22.zip/.xpi`와 `dist/chzzk-all-in-one-chrome-v1.1.22/` 및 ZIP 생성. Firefox41/Chrome43 항목 유지, 패키지 tools.js와 소스 일치 확인. 이전 빌드와 바탕화면 폴더는 보존했다.
- 로컬 XPI는 미서명 개발용이다. 일반 Firefox 영구 설치는 기존 AMO 부가 기능에 1.1.22 ZIP을 제출해 서명본을 받아야 한다. 이번에는 AMO 제출/서명/release/패키지 외부 업로드를 하지 않는다.
- GitHub source 업데이트 완료: 수정 커밋 `d99d1fc`(1.1.22)을 main으로 fast-forward하고 `git push origin main codex/chrome-compat` 성공. 원격 main `dacc340→d99d1fc`, 원격 Chrome 분기 신규 생성. force push·reset·rebase·release 없이 원래 Git 이력을 보존했다. 이 완료 기록을 담은 후속 문서 커밋도 두 분기에 반영하며, 최종 SHA는 원격 ref와 로컬 HEAD 대조로 확인한다.
- 사용자 확인(2026-10-01): 수정 후 `잘되네. 좋다.`라고 답했다. 기존 Firefox에서 COMP 조작 직후 ON·중간값으로 돌아가던 문제는 사용자 확인으로 해결 처리한다. 별도 음향 측정 결과를 제공한 것은 아니므로 소리의 압축 ON/OFF 차이와 REC 중 청취·음소거 녹화 실환경 검증은 여전히 미확인이다. 사용자 확인은 위 임시 Firefox 자동 검사와 구분하며, 간섭 경로 중 어느 것이 사용자 환경의 직접 원인이었는지까지 확정하지 않는다.
- 공통 개선/Chrome 작업 브랜치의 소스/로컬 빌드는 `1.1.21`다. 이전 1.1.12~1.1.20 작업을 로컬 커밋으로 보존했다. push/AMO 업로드/서명/릴리스는 하지 않았다.
- 바탕화면 `C:\Users\hanbi\Desktop\opencode test\치지직\chzzk-all-in-one`과 비교해 추가 QA/인수인계 자료를 통합했다. 그쪽 파일은 수정·이동·삭제하지 않았다. 세부 원인·수정·검증은 문서 마지막 2026-09-29 절에 있다.

## 2026-09-30 광고 없는 시청 치트키 안내 팝업 대응 — 1.1.21

### 기준·증상·원인

- 시작 상태: `codex/chrome-compat`, HEAD `5190dfd`(1.1.20), 작업 트리 깨끗함. 사용자가 제공한 실제 HTML은 `<div class="_container_1l6oy_2" role="alert">` 안에 `광고 방해없이 영상을 시청하고 싶으신가요?`, `모든 채널의 광고를 제거해주는 치지직 치트키를 사용해보세요.`, `https://game.naver.com/profile#cheat_key` 링크 및 `_button_close_...` 닫기 버튼이 있다.
- 기존 `removeAdPopup`은 popup_container/dialog/alertdialog/modal_container를 찾았으므로 해당 role=alert 컨테이너는 후보에서 제외됐다. 후보에 들어가더라도 `isBlockedPromoNotice`는 광고 차단 프로그램 경고와 타임머신 치트키 구매 안내만 인식해서 이 광고 없는 시청 홍보 문구가 제외됐다. 두 원인은 현재 파일로 확인했다.
- 사용자는 Firefox에서 uBlock Origin을 함께 사용 중이라고 밝혔다. Chrome과 Firefox 팝업 차이를 uBlock 효과로 단정하지 않는다. 외부 차단기 없이 광고/홍보 팝업을 제거하는 방향으로 공통 코드를 개선한다. 팔로잉 알림 등 기존 사용 기능과 실제 오류 안내는 보존한다.

### 수정과 보존 범위

- `tools.js`의 기존 후보 선택자에 `[role='alert']`를 추가하고, `치지직 치트키`와 `광고 방해 없이 ... 영상/시청` 또는 `모든 채널의 광고를 제거`가 함께 있는 경우만 홍보 대상으로 추가했다. 해시 클래스명에 의존하지 않는다.
- 기존 `hideAdPopup` 설정(기본 ON), WeakSet 중복 방지, 닫기 버튼 click 및 React DOM 유지 숨김 fallback, OFF 복원, 타임머신 안내의 기존 TM 열기 동작을 유지한다. 새 광고 없는 시청 홍보를 닫을 때 TM을 열지 않는다.
- 기존 MutationObserver/requestAnimationFrame 처리 경로를 재사용한다. 추가 observer/polling/timer/fetch/XHR patch 없음. 광고 영상/피드 응답의 차단 로직·GRID·화질·TM·REC/MP4·오디오·설정값·사용자 데이터는 변경하지 않았다. 이번 팝업 개선만으로 모든 시작/중간 광고까지 해결됐다고 보고하지 않는다.

### 검증

- 단위 81/81, 기본 회귀 21/21, 오디오 15/15, UI 19/19 통과. 제공한 HTML textContent와 줄바꿈 변형을 인식하고, 오류·로그인·치트키 결제 완료·480p 안내·팔로잉 알림과 치트키 없는 문구는 제외한다.
- 실제 소스 추출 UI 검사: role=alert 홍보 닫기 1회/중복 클릭 없음, 일반 alert 보존, 기존 광고 차단 경고/타임머신 모달 경로 유지, 닫기 버튼 없는 React DOM의 숨김/inert 적용 및 설정 OFF 복원. 이 검사는 모의 DOM이며 실제 Firefox/CHZZK 닫힘 확인과 구분한다.
- Chrome Browser Use로 사용자 현재 방송 `/live/a9a343510e132ea3026ff3cf682820b5`를 읽었다. 광고/치트키 관련 alert/dialog는 0개였고 본방송 1920×1080, paused=false, currentTime 약555.5초, video.error 없음이었다. 현재 탭에서 제공 팝업을 재현하지 못했고, 기존 설치본에 새 코드를 반영한 직접 실방송 검증도 아니다. 사이트 DOM을 임의 주입하거나 계정/확장 설정을 조작하지 않았다. Windows native Computer Use/sky 미사용.
- 변경 JS 문법, git diff --check 및 추적 파일 삭제 없음 확인. 기존 1.1.20 MP4 즉시 저장 수정도 회귀 검사로 보존했다.

### 버전·결과물·남은 확인

- manifest/package/package-lock 두 버전과 Chrome/Firefox 빌드 manifest를 1.1.21로 맞췄다. `dist/chzzk-all-in-one-chrome-v1.1.21/` 및 ZIP, `dist/chzzk-all-in-one-firefox-v1.1.21.zip/.xpi` 생성. Chrome43/Firefox41 항목 유지 및 패키지 tools.js가 소스와 정확히 일치함을 확인한다. Firefox XPI는 미서명이다. 이전 빌드/바탕화면 폴더는 삭제하거나 덮어쓰지 않았다.
- 사용자는 기존 설치 폴더의 내용만 새 빌드로 덮어쓴 뒤 해당 확장과 방송 탭을 새로고침하면 기존 Chrome ID·설정·로그를 보존할 수 있다. 이번에는 자동 설치/삭제/재로그인/push/서명/업로드를 하지 않았다.
- 미확인: 1.1.21 반영 후 해당 실제 팝업 닫힘과 재등장 처리, Firefox 외부 차단기 없는 재생, 시작/중간 광고가 실제 공급되는 시나리오. 전체 광고/전체 홍보 팝업 차단을 완료했다고 표시하지 않는다. 다음에 다른 팝업이나 실제 광고가 나타나면 해당 DOM/광고 요청을 구분해 기존 공통 경로를 보강한다.

## 2026-09-30 MP4 속도 개선 및 로그인 기능 검증 — 1.1.20

### 작업 기준과 원인

- `codex/chrome-compat`, 시작 HEAD `599c5c8`(1.1.19)에서 진행했다. Firefox 기준 main/84f1404(1.1.18)는 변경하지 않았다. 소스의 manifest/package/package-lock 및 브라우저별 결과물은 1.1.20이다.
- 사용자 허가: MP4 속도 개선 및 현재 로그인한 Chrome의 통나무/팔로잉 검사. 추가 프로그램 설치 없이 기존 기능·품질·저장소·REC 결과 창·단일 MP4 버튼과 GIF/WebP/자르기/분할을 보존했다.
- 원인 재현: 기존 FFmpeg WASM 변환은 MediaRecorder VP8/Opus WebM의 1k tbr에서 기본 동기화로 1000fps 출력과 불필요한 프레임 복제를 만들었다. 로컬 합성 4초 1920×1080 영상의 인코딩 87,053.6ms, 엔진 로딩 146.2ms였다. 출력 검사에서도 1k fps가 확인됐다. 엔진 로딩 자체가 주원인이 아니었다.
- 실제 연결 Chrome은 명시적인 H.264/AAC MP4 MediaRecorder 형식을 지원하고 `video/mp4;codecs=avc1.420028,mp4a.40.2` 파일을 만들었다. 브라우저별 가능 여부는 버전 문자열 가정 대신 isTypeSupported 및 실제 생성/시작 성공으로 판단한다.

### 최소 수정

1. `record-result-logic.js`: 기존 MP4 공통 인코딩 인수에 `-fps_mode vfr` 추가. MP4 변환·자르기·분할 모두 원본 타임스탬프를 사용하고 프레임율/해상도를 강제 축소하지 않는다. libx264 ultrafast/CRF23/yuv420p/AAC160k는 유지했다.
2. `tools.js`: 가능한 경우 AVC/AAC MP4 녹화를 먼저 시도하고, 생성 또는 start의 동기 실패 시 같은 캡처 스트림에서 기존 VP9/VP8 WebM 순서로 돌아간다. 실패 후보의 이벤트 리스너를 정리하며 별도 캡처·오디오 그래프를 만들지 않는다. 모든 후보 실패 시 기존 일회용 트랙 정리/Firefox 공유 오디오 유지 규칙을 보존했다. 비동기 녹화 오류는 명시 실패로 표시하고 해당 결과를 성공 저장하지 않는다.
3. `record-result.js`: 확인된 AVC/AAC MP4의 전체 MP4 저장은 원본 blob URL을 다운로드하여 FFmpeg를 로드하지 않는다. 코덱 불명·HEVC·Opus MP4는 이 경로로 처리하지 않는다. WebM은 계속 기존 호환 재인코딩을 사용한다. MP4 입력 파일명/작업 공간 정리 및 결과 창 실패 시 원본 확장자를 실제 MIME에 맞췄다.
4. Firefox의 MP4 미지원 환경에서는 기존 WebM 녹화와 오디오 유지 구조를 사용한다. 실제 Firefox 1.1.20 설치·청취·녹화는 이번에 수행하지 않았다. REC MP4도 MediaRecorder 재인코딩 결과이며 방송 전송 원본 RAW와 같다고 주장하지 않는다.

### 검증 결과와 범위

- 자동: 단위 80/80, 기본 회귀 21/21, 오디오 15/15, UI 17/17. 실제 소스 추출 검사로 네이티브 MP4 저장 시 FFmpeg 미호출, 생성/start 실패 시 WebM fallback 및 트랙 정리를 검증했다. 변경 JS와 로컬 QA module 문법, git diff --check, 추적 파일 삭제 없음 확인.
- Chrome 로컬 HTTP 합성 영상: 수정 후 WebM→MP4 인코딩 11,811.3ms, 로딩 111.6ms. 출력 1920×1080, 56.72fps(가변), AAC stereo/48kHz 및 전체 디코딩 exit0. 이전 1000fps 복제는 사라졌다. 동일한 생성기로 만든 별도 녹화 간 비교이며 동일 입력 파일 반복 측정/실방송 전체 평균은 아니다. 약 7.4배 개선은 이 사례의 관측값이다.
- Chrome 직접 MP4: 합성 4초, 1920×1080, AVC/AAC stereo, 브라우저 재생 성공. 원본 blob 직접 저장에는 재인코딩/복사가 없다. 비교용 remux 74.2ms는 제품 MP4 직접 저장 경로의 처리 시간이 아니다. 다운로드 완료/디스크 저장 속도 역시 이 0ms blob 준비 측정과 구분한다.
- 새 MP4 입력에서 기존 GIF/WebP 640×360 브라우저 이미지 로딩 성공, MP4 0.5~1.5초 자르기 및 2초 분할 파일 전부 FFmpeg 디코딩 성공. 분할 끝에 남은 짧은 마지막 조각도 보존했다. 초기 QA는 FFmpeg의 animated WebP 디코딩 오류를 냈으나, 실제 브라우저 이미지 디코더에서는 정상 로딩됐다. 제품 WebP 변환 코드는 변경하지 않았다. 실제 확장 결과 창의 저장/애니메이션 전체 및 다른 모든 자르기·분할 조합을 이 검사만으로 완료 처리하지 않는다.
- 자료: `qa/mp4-performance-before.json`, `qa/mp4-performance-after.json`, `qa/mp4-formats-after.json`. 재현용 `qa/mp4-benchmark.html`과 `qa/serve-benchmark.cjs`는 루프백 127.0.0.1:8765에서 합성 영상/오디오와 번들 FFmpeg만 사용한다. 마이크·카메라·외부 업로드·새 설치 없음. 배포 파일 목록에 포함하지 않았다.

### 로그인 CHZZK 직접 관찰

- Chrome Browser Use의 기존 로그인 사용자 탭만 사용했다. native Windows Computer Use/sky 미사용. 로그인 버튼 대신 계정 UI와 팔로잉 채널을 확인했다. 방송/채팅 입력·후원·예측·팔로우 설정을 변경하지 않았다.
- 동일 `/live/c7d3b49d29be2d2b1d74ba8403f5851a`에서 보유량 330→350→360→370과 확장 `로그 저장됨` 콘솔 메시지를 08:30:11/08:35:11/08:40:11/08:45:11 UTC에 관찰했다. 이전 다른 채널 560은 비교에서 제외한다. 자동 수령 버튼을 사람이 클릭하지 않았다. 보유량 증가와 로그 저장 실행은 확인했으나 지급 PUT/정확한 획득 방식·항목 내용까지 확인한 것은 아니다.
- 네트워크에서 현재 채널 log-power HTTP200을 관찰했다. 상세 응답 body 읽기는 커넥터의 문서 응답 처리 중 CDP 제한으로 불가능했고, 후속 이벤트 버퍼는 truncated=true였다. 요청·토큰·쿠키 전체를 출력하거나 저장하지 않았다. 관측하지 못한 지급 PUT을 성공으로 추정하지 않는다.
- 팔로잉 아라하시 타비 미리보기는 실제 640×360 video, muted=true, paused=false, currentTime 19.616407→48.231161로 진행했다. 포인터 이동 후 hidden=true/paused=true로 종료했다. 썸네일 표시만 보고 영상 성공으로 판정하지 않았다. `qa/chrome-login-preview.png`와 `qa/chrome-login-results.json`에 근거를 보존했다. 커넥터의 드래그 입력으로 생긴 텍스트 선택은 빈 헤더 클릭으로 해제했다.
- 수집한 error/warn 로그 없음. 1시간 통나무 자동 받기, 로그 페이지의 실제 저장 항목/정확한 금액/중복 여부, 실제 팔로잉 방송 시작 알림은 아직 검증하지 못했다. 이전 현황의 DOM 클릭 직후 추정 로그·저장 실패 재시도·여러 탭 OTHERS 중복 위험도 이번 관찰로 해결됐다고 처리하지 않는다.

### 빌드 및 다음 확인

- Chrome 폴더/ZIP `dist/chzzk-all-in-one-chrome-v1.1.20`, Firefox ZIP/미서명 XPI `dist/chzzk-all-in-one-firefox-v1.1.20.*`. Chrome 43개/Firefox 41개 파일, 압축 manifest 1.1.20 및 수정된 3개 배포 JS와 소스 정확 일치 확인. 서명/업로드/push 없음. 기존 빌드는 덮어쓰지 않았다.
- 커넥터는 chrome://extensions와 chrome-extension:// 결과/로그 페이지를 지원하지 않는다. 우회하지 않았다. 사용자에게 새 Chrome 빌드 내용을 현재 로드한 확장 폴더에 덮어쓰고 해당 확장·방송 탭을 새로고침하도록 요청했다. 기존 설정/로그를 보존하기 위해 삭제·다른 ID 재설치를 요구하지 않았다. 사용자는 `업데이트 완료`라고 확인했다. 설치 manifest 버전 자체를 커넥터로 읽은 것은 아니다.
- 업데이트 후 실제 CHZZK 1920×1080, muted=true/paused=false 상태에서 REC를 시작했다. 녹화 완료 결과 탭 2건(사용자가 먼저 종료한 녹화 및 후속 짧은 녹화)을 관찰했고, 종료 후 REC 버튼으로 복귀/방송 재생 및 수집된 error/warn 없음 확인. 테스트 도중 사용자의 채널 이동/음소거 조작도 있었으므로 마지막 다른 채널 보유량을 앞의 330~370과 비교하지 않는다.
- **사용자 실제 결과 확인:** `23.5초 · 65.5 MB · video/mp4;codecs=avc1.420028,mp4a.40.2`, `mp4 저장 바로 됨. mp4 소리 있음.`이라고 답했다. Chrome 실방송 네이티브 MP4 저장 성공과 오디오는 사용자 확인이며 결과 창 내부 직접 검사·다운로드 시간 계측·오디오 파형 분석은 수행하지 않았다. 기존 음소거 녹화 구조를 변경하지 않았고 테스트 시작 당시 본방송 muted=true였음을 직접 관찰했다. 녹화 전체 구간의 음소거 상태를 연속 측정하지는 않았다.
- 다음 우선순위: 새 Chrome REC MIME·MP4 즉시 저장 및 오디오, Firefox 실제 녹화/변환, 서버 지급과 통나무 로그 일치. 별도로 남아 있는 LL-HLS RAW·Chrome 처음 GRID 안내·사이트 화질 요약 480p·장시간 TM 메모리 한도는 변경하지 않았다.
- 사용자는 Chrome 실제 결과 확인 후 Firefox에도 반드시 적용하도록 요청했다. 변경은 공통 소스와 Firefox 1.1.20 ZIP/XPI에도 포함되어 있다. 실제 Chrome 즉시 저장/오디오 확인은 완료되어 다음 우선순위에서 제외한다. Firefox MediaRecorder MP4 지원 요구는 확인한 Mozilla 공식 Bug 1631143에서 NEW/Open 상태다(https://bugzilla.mozilla.org/show_bug.cgi?id=1631143). 따라서 Firefox에서도 Chrome의 네이티브 MP4 즉시 저장을 보장한다고 말하지 않는다. 런타임 지원 시 동일 직접 저장을 사용하고, 미지원 시 기존 WebM을 기록해 VFR로 개선된 변환을 사용한다. Firefox에서 즉시 MP4가 필요하다면 별도의 지원 가능한 인코더/먹서 또는 원본 조각 저장 경로를 검토해야 하며 이번 변경으로 구현된 것이 아니다. 추가 프로그램 설치를 요구하지 않았다.
- 로컬 QA 서버는 종료했고 합성 검사 탭은 닫았다. 사용자의 방송/녹화 결과 탭은 남겼다. Chrome 프로필/권한/쿠키/로그인 상태는 변경하지 않았다.

## 2026-09-30 사용자 Chrome 브라우저 커넥터 직접 검증

### 환경과 접근 제한

- 사용자의 지시에 따라 Chrome Browser Use 연결만 사용했다. 연결된 Chrome extension provider는 browser ID 3, 프로필 표시는 gpt였다. Windows native Computer Use 및 sky.get_window_state를 사용하지 않았다.
- 기존 새 탭을 CHZZK로 이동해 직접 검사했다. 소스 기준은 codex/chrome-compat의 decf4e4, 1.1.19이며 이번에는 기능 코드·manifest·빌드·사용자 설치를 수정하지 않았다. 설치본 버전 자체는 별도로 읽지 못했다.
- CHZZK에서는 로그인 버튼과 로그인 안내 채팅 입력창이 표시돼 로그아웃 상태임을 확인했다. 통나무·팔로잉 계정 검사는 수행하지 않았다.
- chrome://extensions 접근은 커넥터의 URL 정책(HTTP/HTTPS만 허용)에서 거절됐다. 우회·CDP·Windows UI를 통한 접근을 하지 않았다. 검사 중 생긴 about:blank 탭만 닫았고, 사용자의 방송 탭은 유지했다. chrome-extension:// 결과 창 내부의 변환 검증은 사용자 확인으로 구분했다.

### 직접 관찰한 결과

1. **Chrome 최초 재생 안내:** 일반 게임 방송 `/live/36ddb9bb4f17593b60f1b63cec86611d`에 들어가자 공식 고화질 확장 설치 안내와 `설치없이 일반 화질 시청` 버튼이 나타났다. 후자를 누른 뒤 영상이 시작됐다. 이 진입 차이는 아직 자동 처리하지 않았다.
2. **1080p와 Q 표시:** 실제 HTMLVideoElement는 1920×1080, readyState 4, 재생 중이며 errorCode null이었다. 확장 버튼 Q 1080p와 해상도 tooltip도 일치했다. 사이트 설정 요약은 `해상도 480p`로 남았으나 상세 선택 행에 `480p 실제 출력 1080p` 보정 표시를 직접 확인했다. 기본 요약의 480p는 남아 있으며 모든 UI가 1080p로 바뀌었다고 보고하지 않는다.
3. **TM 탐색/LIVE:** 버퍼 유지 ON과 buffered 범위를 확인했다. −30초 버튼으로 과거 구간 이동, LIVE 버튼으로 버퍼 끝 약 1초 전 복귀를 확인했고 이후 영상 시간 증가도 확인했다.
4. **일시정지 버퍼:** currentTime 201.994172, paused true를 유지하는 동안 buffered 끝이 205에서 257.987978로 늘었다. 일시정지한 채 LIVE를 누르면 위치는 256.987978로 이동하되 paused true를 유지했다. 재생 버튼으로 재개한 뒤 시간 증가를 확인했다. 이 관찰은 장시간·무제한 버퍼 보장을 의미하지 않는다.
5. **COMP:** COMP OFF→ON→OFF 전환 중 영상 재생이 이어지고 errorCode null이었다. 설정은 OFF로 복원했다. 직접 청취·압축량 측정·녹화 오디오 분석을 하지 않았으므로 음향 효과까지 정상이라고 보고하지 않는다.
6. **SHOT:** 1920×1080 PNG 미리보기의 naturalWidth/naturalHeight와 실제 화면을 확인했다. 미리보기 드래그는 좌표 (512.5, 44.640625)→(372.5, 84.640625)로 이동했다. 저장 이벤트 대기는 시간 초과였지만 Downloads의 `chzzk_20260930T075907.png`(1,826,254바이트, 17:00:16 생성)를 파일 시스템에서 확인했다. 이후 추가 PNG 헤더 검사를 시도한 시점에는 ENOENT라 수행하지 못했으며 이동/삭제 원인은 미확인이다. 커넥터 다운로드 이벤트만으로 저장 실패라고 결론 내리지 않았다.
7. **REC:** REC→STOP 및 `녹화를 시작했습니다` 안내, 약 33초 녹화 표시를 확인했다. STOP 뒤 `녹화 완료 · CHZZK All-in-One` 결과 탭 생성은 사용자 탭 목록에서 확인했다. 결과 영상과 MP4 다운로드 내부 상태는 커넥터로 읽지 않았다.
8. **RAW:** 일반 게임 방송도 `저지연 HLS 부분 조각은 RAW 저장을 지원하지 않습니다. 기존 REC를 이용해 주세요.`로 중단되고 RAW 버튼으로 복원됐다. RAW 무재인코딩 저장의 실환경 지원 범위 문제는 남아 있다.
9. **트렌드/오류:** 트렌드 수동 갱신 뒤 표시가 17시 5분 53초→17시 6분 53초로 바뀌었다. 마지막 영상은 1920×1080, currentTime 855.474146, paused false, errorCode null이었다. 수집된 error 로그 0건, warn은 사이트의 `setPolicyInfo Object`였다. 로그에 토큰·서명 URL을 저장하지 않았다.

### 사용자 확인과 남은 작업

- 사용자는 이번 REC 결과 창 재생 및 MP4 변환/저장에 대해 `잘 되네. 근데 여전히 mp4 변환은 느려`라고 답했다. 기능 성공은 사용자 확인이며 처리 시간·출력 코덱·오디오는 직접 계측하지 않았다.
- MP4 속도는 미해결이다. 기존 변환은 FFmpeg WASM의 libx264, ultrafast, CRF 23 재인코딩을 사용한다. 이번 검증에서는 변환 로직·품질을 낮추거나 추가 프로그램을 설치하지 않았다.
- 실제 광고가 재생되는 시나리오를 포착하지 못해 광고 차단 성공/실패는 판정하지 않았다. 로그인 통나무 보유량·실제 자동 획득·로그, 팔로잉 미리보기/알림, 채팅 글자 설정, 녹화 음소거 오디오, GIF/WebP/자르기/분할, 장시간 안정성은 미확인이다. Firefox 실제 검증으로도 간주하지 않는다.
- `qa/chrome-connector-results.json`에 실측/사용자 확인/미확인을 나눴고 `qa/chrome-connector-preview.png`에는 사이트 화질 상세 메뉴와 Q 표시를 남겼다. 기존 임시 Chromium QA 결과 파일은 덮어쓰지 않았다. 기능 소스를 수정하지 않아 자동 회귀 검사 및 빌드를 반복하지 않았다.

## 2026-09-30 Chrome 테스트 지원 및 브랜치 분리, 1.1.19

### 기준 보존과 범위

- 사용자는 Firefox 컴퓨터 사용이 도구 정책에서 중단된 뒤, 기존 기능을 Chrome에서 그대로 테스트할 수 있게 해달라고 요청했다. 현재 Firefox 코드와 누적 QA/문서를 `main`의 로컬 커밋 `84f1404`로 보존한 뒤 `codex/chrome-compat`을 만들었다. 이전 미커밋 작업은 삭제하거나 초기화하지 않았다. 바탕화면 복사본도 변경하지 않았다.
- 원본 manifest는 Firefox MV3의 background.scripts, webRequestBlocking, Gecko 설정 및 worker-src blob:을 사용한다. Chrome 로더가 worker-src blob:을 실제 거부했고, Chrome용 서비스 워커 및 CSP가 필요했다. 원본 광고·TM·GRID 재생 정보·UI·변환·로그 로직을 공유하고 브라우저별 API 연결만 추가했다.
- Chrome 공식 문서의 서비스 워커, 메시지 JSON 직렬화, DNR 규칙을 확인했다. 외부 참고 프로젝트 코드를 복사하거나 의존성을 추가하지 않았다.

### 파일별 수정

1. `build.ps1`: 기본 Firefox 빌드는 유지하고 `-Browser Chrome` 선택지를 추가했다. Chrome 폴더에 기존 배포 파일과 전용 워커/GRID 파일을 복사한 후 manifest를 생성한다. Gecko 설정과 webRequestBlocking을 제외하고 background.service_worker, alarms, Chrome 120 최소 버전, worker-src self를 지정한다. ZIP 내부 manifest와 파일 수를 기존 방식으로 검증한다.
2. `chrome-worker.js`: 기존 following/grid/log/recording 모듈을 importScripts로 로드하고 공유 background를 실행한다. `background.js`는 Firefox의 blocking 리스너를 그대로 두되 Chrome에서 등록하지 않는다. Chrome 비동기 응답은 sendResponse/return true를 사용해 Promise listener 지원 배포 여부에 의존하지 않는다.
3. `chrome-grid.js`: CHZZK 탭 ID와 알려진 CDN, 재생목록 요청에만 세션 리다이렉트 규칙을 적용한다. 경로의 480p만 1080p로 바꾸며 서명·쿼리는 유지한다. 수동 화질 선택 탭은 제외하고 채널 이동/재로드 때 해제한다. 고화질 오류는 정확한 원본 URL을 60초 동안 허용한다. 수동 선택/실패 상태를 storage.session에 저장하고 Chrome alarm으로 만료해 워커 재시작에도 동작한다. Firefox의 즉시 응답 리다이렉트와 달리 Chrome은 플레이어의 다음 원본 재시도에 의존하며, 첫 실패가 잠깐 보일 수 있다.
4. `recording-transport.js`: Firefox는 기존 Blob 메시지로 저장한다. Chrome은 최대 256 KiB 바이트를 base64 JSON으로 나눠 전송하고 기존 IndexedDB에 같은 Blob/메타데이터로 저장한다. 순서·총 크기·발신 탭/문서를 확인하며 전송 실패는 기존 원본 저장 fallback으로 이어진다. 완료 전 메모리 전송은 워커 중단에 취약할 수 있고, 완료 데이터는 IDB로 복원한다. 동시 미완료 업로드 4개 제한, 닫힌 탭의 전송 해제, 5분 이상 방치된 전송의 다음 시작 시 정리를 추가했다. 장시간 파일의 실제 메모리/속도는 추가 확인이 필요하다.
5. `tools.js`/`record-result.js`/HTML/manifest: 기존 REC→전용 결과 창·원본/MP4/GIF/WebP/자르기/분할 흐름을 그대로 transport에 연결한다. MAIN 광고·TM 코드와 사용자 요청에 따른 PIP 비활성화는 유지했다. RAW도 기존 경로를 유지했다.
6. 실제 Chrome REC 결과에서 WebM duration이 Infinity여서 자르기/분할이 막힐 수 있는 문제를 확인했다. 결과 창이 로컬 디코더로 파일 끝을 확인하고 원래 위치를 복원해 길이를 계산한다. 기존 유한 길이 파일에는 적용하지 않으며 확인 제한은 5초다. 실제 2.5초 녹화 길이 표시를 확인했다.

### 자동 검사 및 빌드

- 단위 76/76, 기본 회귀 20/20, 오디오 15/15, UI 17/17 통과. Chrome JSON 왕복으로 큰 녹화 두 건, 입력 순서/소유자/저장 오류, Firefox Blob 유지, GRID 적용 범위·수동 선택·403/네트워크 오류·만료·워커 상태 복원을 테스트했다.
- 수정/추가 JS 8개와 QA 파일 문법 검사를 수행했다. git diff --check 통과, 파일 삭제 없음.
- Chrome 압축해제 폴더 및 ZIP 43개 파일, Firefox ZIP/XPI 41개 파일을 생성했다. 추가 파일 때문에 이전 40개에서 늘었으며 기존 파일을 제외하지 않았다. 각 압축 파일의 바이트를 대응 소스/Chrome 폴더와 대조했다. 소스 manifest/package/lockfile 및 양 브라우저 내부 manifest가 1.1.19다.
- Chrome ZIP SHA-256: `BDE70E5672FB1B10BDCC4A651D82F880296F5B1ED843D106F1EA7B3880EB1E53`.
- Firefox ZIP/XPI SHA-256: `1FB5F74D6DC936BD6D5AF71B7A2CECCE6D44D90A0863A789C27C7B3209996516`. Firefox XPI는 미서명이다.

### Chromium 및 실제 CHZZK 확인

- 설치돼 있던 Playwright 런타임/Chromium 148.0.7778.96을 임시 프로필로 사용했다. 새 브라우저/보조 프로그램을 설치하지 않았고 사용자 Chrome 144 프로필이나 Firefox 1.1.17 설치를 변경하지 않았다. 테스트 브라우저와 임시 프로필은 종료·정리했다.
- 실제 확장 등록, 서비스 워커 시작, 설정 페이지, 합성 VP8/Opus 녹화 전달과 같은 바이트 복원, 1 MiB 이상 분할 전송 복원, 전용 결과 창 영상 320×180 재생, MP4 변환 다운로드 및 출력 MP4 320×180/약 1.17초 재생, 워커 강제 중지 후 기존 녹화 재조회가 통과했다.
- 초기 CSP 오류는 Chrome manifest 생성에서 수정했다. 디버그 CDP와 명령행 방식의 중복 로드가 송수신 ID 불일치를 만든 것은 테스트 환경 문제였고, 단일 로드로 해결했다. 이 진단용 로그는 최종 소스에서 제거했다.
- 실제 CHZZK 공개 방송에서 약 10초 동안 영상 시간이 계속 진행하고 errorCode가 null인 것을 확인했다. 툴바 REC/RAW/SHOT/Q/TM이 표시됐고, REC→STOP→결과 창에서 VP9/Opus 녹화 852×480/약 2.5초를 재생했다. Q 480p는 해당 영상의 실제 높이와 일치했다. 실제 DNR testMatchOutcome에서도 Chrome 업그레이드 규칙이 일치했다.
- 일부 접속은 30초 내 video 요소가 생성되지 않아 대기 제한에 걸렸다. 그때 재생목록 요청도 없고 GRID 실패 기록도 없었으며 확장 원인으로 특정하지 않았다. 확인한 방송에는 아시안게임 SPOTV가 포함되고 480p였다. 일반 방송 1080p 정상화의 근거로 사용하지 않는다.
- Chrome의 실제 요청 엔진에 로컬 테스트 응답을 제공해 480p→1080p 변경, 1080p의 HTTP 403, 원본 URL 재시도의 480p HTTP 200을 확인했다. 실제 방송 서버에서 1080p를 확보했다는 뜻은 아니다. QA 결과의 fixture 요청은 실제 CHZZK 요청과 별도로 표시한다.
- 실제 CHZZK에서 TM 패널의 `버퍼 유지 ON · 저장 17초 · LIVE −3초` 상태와 −30초 버튼의 과거 버퍼 탐색을 확인했다. LIVE 버튼 클릭·패널 닫기도 수행했으나 복귀 뒤 영상 진행을 별도로 검증하지 않았으며 장시간 버퍼·일시정지 상태는 미확인이다.
- 해당 방송의 RAW는 `저지연 HLS 부분 조각은 RAW 저장을 지원하지 않습니다`라는 기존 보호 로직으로 중단됐다. 이 방송에서 RAW 저장 성공을 보고하지 않는다. 지원되는 일반 TS/fMP4 방송의 파일 저장·오디오·재생은 여전히 확인해야 한다. 초기 QA가 자동 중단 뒤 RAW 버튼을 다시 눌러 다운로드를 기다리는 오류를 수정해, 지원 불가 결과를 기록하고 TM 검사까지 진행하게 했다.
- `qa/chrome-e2e.cjs`, `qa/chrome-e2e-results.json`, `qa/chrome-live-preview.png`에 도구·결과·화면을 남겼다. coreChecksFromPreviousRun이 true이면 같은 빌드의 직전 녹화 바이트/MP4/워커 복원 검사 결과를 재사용한 것이며 reusedChecks 목록으로 이번 실방송 검사와 구분한다. 최종 실방송 검사 exit 0, 수집된 console error 0건이다. 간헐적인 최초 로드의 video 부재 및 REC 버튼 표시 대기 실패는 이전 시행에서 있었고 모든 시작 조건의 안정성을 보장하지 않는다.

### 남은 실환경 검증

- 사용자 일반 Chrome 144에 설치한 직접 UI 검증, 실제 광고 시작/중간 광고·경고 모달, 일반 방송 1080p 및 업그레이드 오류 후 원본 재시도.
- 로그인 계정의 통나무 실제 획득·보유량·로그, 팔로잉 미리보기/알림, 컴프레서 음향, 음소거 녹화 오디오, SHOT 캡처 권한/미리보기/드래그, GIF/WebP/자르기/분할 출력 전부, 장시간 RAW/REC·다중 탭·장시간 TM 버퍼.
- 사용자 Firefox 실환경 1.1.19는 확인하지 않았다. main의 Firefox 1.1.18과 기존 설치본은 보존했다. 앞서 확인된 Firefox MSE quota 및 통나무의 클릭 직후 추정 로그 문제는 이번 Chrome 호환 작업에서 해결한 것으로 보고하지 않는다.

## 2026-09-30 광고 응답 경계 처리 및 재생 호환성 보강, 1.1.18

### 조사 범위와 원인

- 사용자 요청대로 외부 참고 프로젝트의 README와 파일 구조에서 광고 처리 범위를 살펴봤다. 외부 구현·테스트 코드를 복사하거나 번들·의존성을 추가하지 않았다. 수정과 테스트는 기존 `page.js`에서 직접 재현한 문제를 기준으로 작성했다. 기존 LICENSE/NOTICE/author 표기는 유지했다.
- 기존 코드에는 GFP 광고 스케줄, SSP 워터폴, 플레이어 광고 표시 신호, OPTIONS 상태 보정이 이미 있다. 이번 수정은 해당 처리 경로의 경계 조건과 브라우저 API 호환성에 한정했다. 현재 CHZZK에서 광고가 새로 뚫렸다는 사실이나 00:00 오류의 원인을 입증한 작업은 아니다.
- 바이너리 광고 응답은 처음 두 바이트가 정확히 `{"`일 때만 검사했다. JSON 앞 공백·줄바꿈·UTF-8 BOM 또는 `{` 뒤 줄바꿈이 있으면 동일한 광고 객체도 누락됐다.
- XHR 객체 응답은 getter를 읽을 때마다 복제했고, 실제 변경이 없어도 복제본을 반환했다. 같은 완료 응답을 반복해서 읽어도 객체가 달라지며 바이너리 변환도 반복될 수 있었다.
- 전역 Uint8Array 생성자 패치는 Uint16Array 등 다른 typed array의 원소를 변환하지 않고 내부 바이트를 먼저 검사했다. 내부 바이트가 광고 JSON처럼 보이면 정상 원소 변환 대신 다른 길이·내용을 반환하는 오류를 재현했다.

### 수정 내용과 보존 범위

1. `neutralizeAdBuffer`: BOM과 JSON 공백을 건너뛰어 객체 후보만 디코딩한다. 기존 엄격 UTF-8 디코딩/JSON 파싱 및 광고 객체 식별을 유지한다. 잘못된 UTF-8, 깨진 JSON, 일반 JSON/영상 데이터는 변환하지 않는다.
2. XHR: 기존 요청 WeakMap 안에 최근 완료 응답의 변환 결과를 보관한다. 원본 값·URL·GRID 설정이 같으면 결과를 재사용한다. `open()` 호출은 새 요청 메타데이터를 만들어 캐시를 초기화하고, GRID 설정 변경은 다시 평가한다. 변경이 없는 객체는 원본을 반환한다. native getter를 먼저 호출해 responseText 예외를 보존하고, 미완료·실패 응답은 그대로 반환한다.
3. Uint8Array: native 생성으로 범위 검사와 원소 변환을 먼저 수행한 뒤 실제 생성 결과를 검사한다. 기존 buffer offset/length와 입력 버퍼 보존을 테스트했다. 새 fetch/XHR patch·Observer·timer·polling은 추가하지 않았다.
4. manifest/package/lockfile 루트 및 packages[""] 버전을 1.1.18로 맞추고 로컬 ZIP/XPI를 빌드했다. 이번 작업의 실행 코드 변경은 `page.js`뿐이며 통나무·TM·REC/RAW·변환기·화질 선택 UI는 수정하지 않았다.

### 검증 결과

- 코드 분석: 기존 처리 범위, XHR getter 및 Uint8Array 생성자 계약을 확인했다. 기존 미커밋 변경과 QA 자료를 보존했다.
- 재현 테스트: 새 테스트 5개가 수정 전 모두 실패하고 수정 후 모두 통과했다. `test/page.test.js` 20/20 통과.
- 전체 자동 검사: `npm run test:all` 단위 71/71, 기본 회귀 20/20, 오디오 15/15, UI 17/17 통과. 이 검사는 Node/DOM/Web Audio 모형이며 실제 사이트의 모든 기능 정상 판정이 아니다.
- JavaScript 문법: `node --check page.js`, `node --check test/page.test.js` 통과. 일반 `git diff --check` 통과, 추적 파일 삭제 없음. CRLF 파일에 `core.autocrlf=false`를 임시 적용한 검사에서 나온 CR 문자 경고는 일반 검사 결과와 구분한다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.18.zip` 및 `.xpi`. 이전 1.1.17과 파일 목록 40개가 같고, 각 압축 파일의 바이트가 현재 소스와 일치한다. manifest/package/lockfile 2곳/내부 manifest 총 5곳이 1.1.18이다. ZIP/XPI SHA-256은 모두 `35D6C7741FB87D029BB5A1CD328C43BA738366577D948B4754960226C118F860`이다.

### 실제 환경 미확인과 다음 확인

- 이번 1.1.18을 Firefox 또는 실제 CHZZK에 설치해 확인하지 않았다. 광고 시작·중간 광고·경고 모달·채널 전환·GRID ON/OFF와 일반 방송 1080p, 제한 중계 최고 가용 화질은 사용자 실환경 확인이 남는다.
- 로컬 XPI는 미서명이다. 이전 AMO 승인본과 별개의 결과물이다.
- 이전 1.1.16 실제 Firefox 검사에서 확인된 MSE quota로 인한 장시간 일시정지 버퍼 정체는 여전히 미해결이다. 이번 광고 코드 변경이 무제한 버퍼를 구현한 것은 아니다.
- 통나무 자동 지급/보유량의 로그인 계정 실환경 확인과, 클릭 직후 지급 확인 없이 시청 획득 로그를 만드는 기존 문제는 이전 기록대로 남는다.

## 아래는 날짜별 누적 기록

## 기준과 작업 위치

- 원본 작업 저장소: `C:\Users\hanbi\Documents\ChatGPT\치지직\chzzk-all-in-one` (`main`, HEAD `b343393`). 현재 수정은 커밋하지 않은 작업 트리에 있다. Git 원격은 `https://github.com/birowsi/CHZZK-All-in-One.git`이다.
- 비교한 사용자 수정본: `C:\Users\hanbi\Desktop\opencode test\치지직\playback-107`. 그 옆의 `chzzk-all-in-one` 복사본 핵심 파일은 원본 작업 저장소와 같았다. 바탕화면 파일은 이동하거나 삭제하지 않았다.
- 원본 작업 트리는 시작 시 manifest/package `1.1.0`이었으나 빌드는 없었다. 실제 배포 파일은 1.0.7까지 확인됐다. 1.1.0의 광범위한 미커밋 변경은 이 작업에서 초기화하거나 제거하지 않았다.
- 현재 개발 검증본은 `1.1.8`이다. Git push, 태그, 릴리스, 외부 업로드는 하지 않았다.

## 이번 병합

1. `page.js`: 바탕화면 수정본의 GFP 광고 스케줄, SSP 워터폴, 플레이어 pre/mid 광고 표시 응답 처리와 JSON 바이트 처리 경로를 이식했다. 원본의 `GRID OFF`일 때 P2P 재생 정보를 유지하는 설정 경로와 HLS 화질 목록 보존 동작은 유지했다. `glad-vod.pstatic.net/a/read/v2/VOD_ALPHA/` 광고 미디어 인식도 포함했다. 기존 `play()`/메타데이터 후 광고 넘기기와 `SKIP` 버튼 클릭을 fallback으로 둔다. 정상 방송 조각 주소에는 광고 변환을 적용하지 않도록 테스트했다.
2. `timeshift.js`: 광고 video가 본편보다 앞에 남아 있어도 타임머신이 본편 video를 선택하도록 했다. 기존 HLS 버퍼 탐색, LIVE 복귀 및 최초 최고 화질 선택 로직은 유지했다.
3. `tools.js`: Firefox 녹화가 `mozCaptureStream`으로 가져간 오디오가 녹화 종료 후 끊기지 않도록 같은 video의 캡처·오디오 모니터를 재사용한다. 모니터 경로에도 COMP 설정을 적용한다. 녹화 시작 실패와 결과 저장에 대한 원본의 보호 흐름을 유지했다. 이후 사용자 명시 요청에 따라 확장 PIP 구현과 버튼 생성 부분을 주석 처리했다.
4. `record-result-logic.js`/`record-result.js`: 긴 녹화 자르기의 입력 위치 탐색, MP4 빠른 변환 실패 시 호환 변환, 유효하지 않은 ffmpeg 진행률의 불확정 표시와 경과 시간 안내를 반영했다. 기존 전용 결과 창, 저장소 ID, GIF/WebP/분할 기능은 유지했다.
5. `manifest.json`, `package.json`, `package-lock.json`을 현재 `1.1.2`로 맞추고 README 설치 경로와 QA 대상 버전을 갱신했다. `dist/chzzk-all-in-one-firefox-v1.1.2.zip` 및 `.xpi`를 로컬에 생성했다. 1.1.1 XPI는 사용 중인 파일이라 덮어쓰지 않았다.

## 의도적으로 제외한 바탕화면 변경

- 바탕화면 수정본의 PIP 주석 처리는 처음에는 보존 원칙에 따라 보류했다. 사용자가 2026-09-25에 의도한 변경이라고 명시해 같은 방식으로 적용했다. Firefox 기본 PiP는 확장 코드와 별개다.
- 바탕화면 1.0.7의 '1080p만 남기는' HLS playlist 필터는 원본 1.1.0의 모든 가용 화질 보존 방식으로 유지했다. 제한 중계와 실패 시 하위 화질 fallback이 필요하기 때문이다.
- 바탕화면 작업본 전체를 원본에 덮어쓰지 않았다. 원본의 팔로잉, 녹화 저장소, GRID 설정 분리, QA 추가 구현을 보존했다.

## 검증한 범위

- 코드 분석: 두 Git 작업 트리와 바탕화면 사용자 수정본의 차이를 비교했다. 광고 URL은 사용자 제공 경로를 기준으로 정상 방송 조각과 구분했다. PIP 비활성화는 명시 요청 후 반영했다.
- 자동 테스트: `npm run test:all`에서 단위 테스트 55/55, 회귀 스크립트 기본 10/10, 오디오 14/14, UI 13/13 통과했다. 이번에 광고 피드 fetch, 광고 JSON, 본편 video 선택, 자르기/MP4 fallback, 공유 캡처 테스트를 추가했다.
- 문법: `page.js`, `timeshift.js`, `tools.js`, `record-result-logic.js`, `record-result.js`의 `node --check` 통과.
- 빌드: 로컬 ZIP/XPI를 생성했다. manifest, package, lockfile의 루트 버전과 XPI 내부 manifest가 모두 `1.1.2`이다. ZIP과 XPI의 SHA-256도 일치하며, XPI 내부에서 활성 PIP 버튼 생성 코드가 없는 것을 확인했다. 실제 Firefox 기능 검증은 아래 미확인 항목이다.
- 기존 Git diff에는 이번 작업 전부터 광범위한 미커밋 변경이 있다. `content.js` 끝의 빈 줄에 대한 `git diff --check` 경고는 이번에 편집하지 않은 기존 변경에서 나온다.

## 실제 환경 미확인 / 다음 우선순위

1. **광고**: 일반 방송 및 아시안게임/올림픽 중계에서 pre/mid 광고가 건너뛰어지는지, 광고 차단 안내 UI가 남지 않는지 Firefox에서 확인해야 한다. 광고 응답 구조가 바뀌면 `neutralizeAds`의 정확한 객체 구조를 실제 응답 기준으로 갱신한다. `SKIP` fallback은 영상 시작 전 광고를 완전히 막는 방식이 아니다.
2. **재생·GRID·화질**: GRID ON/OFF 각각에서 00:00 멈춤, 방송 오류 후 재시작, 일반 방송 1080p, 제한 중계의 최고 가용 화질과 하위 fallback을 확인해야 한다. 이전 사용자 진단은 광고가 보이면서 1920×1080 방송이 정상 재생 중인 한 순간만 입증한다. 00:00 원인은 아직 특정되지 않았다.
3. **타임머신**: 본편 video 선택, 버퍼 안 탐색, LIVE 복귀, 광고 전후 플레이어 교체 시 복구를 실제 방송에서 확인해야 한다. 버퍼 밖 서버 DVR은 구현·확인되지 않았다.
4. **녹화/오디오/변환**: Firefox에서 COMP ON/OFF, REC 시작·중지·재시작 후 방송 청취, 결과 창, MP4 자동 호환 변환, GIF/WebP/자르기/분할의 실제 출력 재생을 확인해야 한다. 자동 테스트는 Web Audio/DOM 모형이며 실제 음향과 ffmpeg 완성 파일을 검증하지 않는다.
5. 팔로잉 알림, 트렌드/썸네일, 사이드바, 블라인드 메시지, 통나무, 스크린샷 등 나머지 기능은 이번 병합에서 의도적으로 제거하지 않았지만 실제 CHZZK 기능 정상 판정은 하지 않았다.

## 2026-09-25 후속 확인: MP4 변환

- 사용자 실제 환경 보고: 1초 녹화는 빠른 MP4 복사가 호환 변환으로 전환된 뒤 약 7초에 완료됐다. 원본 저장, GIF, WebP도 동작한다고 보고됐다. 광고 차단과 타임머신도 현재 잘 동작한다고 보고됐다. 이는 사용자 확인이며 이 작업 환경에서 Firefox/CHZZK를 직접 재현한 결과는 아니다.
- 번들된 `ffmpeg-core.wasm`을 Node에서 직접 실행해 1초짜리 1080p VP8/Opus 합성 WebM을 확인했다. 빠른 `-c copy` MP4는 종료 코드 1, H.264/AAC 호환 변환은 종료 코드 0과 출력 파일을 반환했다. 후자는 이 PC의 Node 환경에서 약 0.9초였다. 실제 Firefox 시간은 달랐다.
- 해당 사례는 변환 실패로 판정하지 않는다. 5초 대기는 완료 전이었고 7초에 성공했다. 추가 코드 수정과 버전 변경은 하지 않았다. 생성한 합성 파일과 임시 탐색 파일은 삭제했다.
- 남은 확인: 수 분 이상의 실제 녹화, 자르기·분할 MP4, 녹화 중/종료 후 방송 오디오와 COMP 상태. 이후 사용자가 재현한 다른 깨진 기능을 우선순위에 따라 조사한다.

## 2026-09-25 추가 조사: MP4 속도와 화질 메뉴

- 사용자 실제 녹화의 MIME은 `video/webm;codecs=vp8,opus`다. 번들된 FFmpeg에서 VP8/Opus는 `-c copy` MP4에 담기지 않아 "빠른 변환" 버튼이 매번 호환 재인코딩으로 넘어간다. 사용자 4.1초·1.4MB 녹화도 이 형식이었다. 이는 버튼의 빠른 경로가 현재 Firefox 녹화 형식과 맞지 않는 설계 문제다.
- 별도 합성 VP9/Opus WebM은 같은 번들 FFmpeg에서 MP4 무재인코딩 복사가 성공했지만, 사용자 Firefox의 MediaRecorder는 VP8/Opus를 선택했다. VP9/Opus MP4의 타 플레이어 호환성도 아직 확인되지 않았다.
- Mozilla Bug 1631143은 Firefox MediaRecorder의 `video/mp4` 미지원 문제를 열린 상태로 추적한다. 사용자는 추가 설치를 원하지 않는다. PC FFmpeg 보조 프로그램은 추가하지 않는다. 브라우저 전용 고속 MP4의 현실적인 후보는 원본 HLS의 MP4 조각을 직접 녹화해 재인코딩을 피하는 별도 경로인데, 오디오/화질 변경/중계 유형을 실제 사이트에서 검증해야 하므로 아직 구현하지 않았다. 현재 REC·원본 WebM·호환 MP4를 임의로 대체하지 않는다.
- 사용자는 영상 자체는 좋아 보이지만 CHZZK 화질 메뉴에는 480p가 뜬다고 보고했다. 코드상 GRID 우회는 플레이어가 요청한 480p manifest를 1080p URL로 리다이렉트할 수 있어 메뉴 상태와 실제 요청이 다를 수 있다. 현재는 원인 후보이며 실제 네트워크/화질 메뉴 동기 검증 없이 텍스트만 바꾸지 않는다.

## 2026-09-25 후속 수정: VP8 MP4 변환 경로 (1.1.3)

- 사용자 제공 실제 녹화: `4.1초 · 1.4 MB · video/webm;codecs=vp8,opus`. 이 경우 기존 MP4 빠른 버튼의 `-c copy`는 구조적으로 실패하므로, `conversionKindForRecording`이 즉시 기존 H.264/AAC 호환 변환을 선택한다. 알 수 없는 형식은 기존 복사 시도와 실패 시 fallback을 유지한다. GIF/WebP/원본/편집 경로는 바꾸지 않았다.
- 결과 창의 해당 버튼을 이 녹화에서는 `MP4 자동 변환` 및 `VP8 녹화: 호환 인코딩 필요`로 표시해 실제 동작을 드러낸다. 두 MP4 버튼은 이 형식에서 같은 호환 변환을 수행하지만, 기존 선택지를 삭제하지 않았다.
- 추가 설치는 하지 않는다. 이 수정은 실패하는 FFmpeg 실행 1회를 생략하며, VP8→H.264/AAC 재인코딩과 번들 WASM 로딩 시간은 남는다. 실제 Firefox에서 총 소요 시간이 얼마나 줄었는지는 사용자가 확인해야 한다. 화질을 낮추거나 REC 경로를 바꾸지 않았다.
- 자동 테스트: `npm run test:all` 단위 56/56, 회귀 기본 10/10, 오디오 14/14, UI 13/13 통과. `record-result.js`와 `record-result-logic.js` 문법 검사 통과. 이는 Firefox 실제 변환 속도 측정이 아니다. 원본 1.1.2 결과물은 보존한다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.3.zip`와 `.xpi` 생성. manifest/package/lockfile 루트/XPI 내부 manifest가 모두 `1.1.3`이며 ZIP·XPI SHA-256은 동일하다. 이번 변경 경로의 `git diff --check` 통과. 의도하지 않은 파일 삭제는 없었다. Firefox에서 VP8 4.1초 녹화의 변환 시간 및 결과 MP4 재생은 아직 확인하지 못했다.

## 2026-09-25 후속 수정: 변환 UI·자르기·통나무 로그와 시계 (1.1.4)

- 사용자 명시 요청으로 중복된 MP4 자동/호환 버튼을 하나의 `MP4 변환`으로 통합했다. VP8/Opus WebM은 기존 H.264/AAC 호환 인코딩만 실행한다. 실패할 `-c copy` 및 fallback 분기와 두 번째 버튼은 제거했다. 버튼에 변환이 오래 걸릴 수 있음을 명시했다. 원본 저장, GIF, WebP, MP4 분할은 유지했다.
- `잘라서 저장`에 MP4, WebM, GIF, WebP 형식을 추가했다. 길이와 시작점 검증, 출력 확장자/MIME/파일명은 선택 형식에 맞춘다. WebM은 VP8/Opus로 재인코딩해 자르기 정확도를 유지한다. 번들된 FFmpeg WASM을 Node에서 2초 합성 녹화에 직접 실행해 0.5–1.5초 자르기 네 형식 모두 반환 코드 0과 파일 생성 확인. MP4는 H.264/AAC, WebM은 VP8/Opus, 각각 약 1초 출력이었다. GIF/WebP 파일 생성도 확인했으나 Firefox 화면에서 재생·미리보기 검증은 하지 않았다.
- `popup.js`의 다음 통나무 획득 표시는 저장되지 않는 `lastPowerAcquisitionTime`과 임의의 첫 로그를 더 이상 사용하지 않는다. 가장 최근 `view` 로그 + 1시간으로 계산하고, 저장소 변경을 열린 팝업에 반영한다. 기록이 없거나 예상 시각이 지났으면 확인이 필요하다고 표시한다. 사이트 내 시계도 최근 `view` 로그를 쓰고 같은 상태를 표시한다. 이는 추정 시간이며 CHZZK 서버가 보장하는 실제 다음 보상 시각으로 검증하지 않았다.
- `log.js`는 열려 있는 동안 `powerLogs` 저장소 변경을 반영한다. 편집 중인 미저장 내용을 덮지 않도록 변경이 없는 때만 자동 반영한다. `savePowerLog` 성공 여부를 반환하고 저장 실패 시 메모리의 중복 방지 시각을 찍지 않아 다음 시도를 막지 않는다. 비활성화된 시청 보상 버튼은 클릭·기록하지 않는다. 버튼 클릭만으로 서버 획득 성공을 확정할 수 없는 기존 한계는 남아 있어 실제 CHZZK 계정에서 로그 정확도 확인이 필요하다.
- 자동 테스트: `npm run test:all` 단위 55/55, 기본 회귀 15/15, 오디오 14/14, UI 13/13 통과. `content.js`, `popup.js`, `log.js`, `record-result.js`, `record-result-logic.js` 문법 검사 통과. 변경 경로의 `git diff --check` 통과했고 의도하지 않은 파일 삭제는 없었다. 테스트용 합성 미디어는 시스템 임시 폴더에서 삭제했고 바탕화면 사용자 자료와 기존 1.1.3 빌드는 건드리지 않았다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.4.zip`과 `.xpi` 생성. manifest/package/lockfile 루트/XPI 내부 manifest가 모두 `1.1.4`; ZIP/XPI SHA-256 동일. XPI 내부에는 MP4 버튼 1개와 자르기 형식 선택이 포함됐다. 실제 Firefox 변환 속도·출력 재생과 실제 CHZZK 통나무 획득·로그·다음 시각은 사용자 검증이 필요하다.

## 2026-09-25 후속 수정: 화질 표시와 분할 형식 (1.1.5)

- 사용자 재요청에 따라 플레이어 도구에 `Q 1080p`처럼 현재 HTMLVideoElement의 `videoHeight`를 보여주는 버튼을 추가했다. 480p를 선택한 사이트 메뉴와 실제 영상 높이가 다르면 열린 메뉴의 선택 항목 옆에 `실제 출력 1080p`를 표시한다. 메뉴의 원래 480p 텍스트, 선택 동작, 가용 화질 목록은 조작하지 않는다. 광고 영상 래퍼는 표시에서 제외하고 영상의 `loadedmetadata`/`resize`/`emptied`를 기존 `schedule` 흐름으로 갱신한다. 추가 observer나 timer를 만들지 않았다. 버튼을 누르면 사이트 선택값과 영상 출력값을 알린다.
- 원인: `background.js`의 GRID 우회는 플레이어가 요청한 480p m3u8을 1080p URL로 돌릴 수 있다. 따라서 플레이어가 기억하는 메뉴 선택값과 실제 비디오의 해상도가 다를 수 있다. 이것은 코드상 경로이며 사용자 사례가 정확히 해당 리다이렉트였는지는 Firefox 네트워크로 아직 확인하지 않았다. 실제 제한 중계에서 영상 높이가 480이면 `Q 480p`로 표시하며 1080p를 꾸며 표시하지 않는다.
- 추가 요청으로 분할 저장에도 MP4/WebM/GIF/WebP 형식 선택을 넣었다. 기존 MP4의 FFmpeg 세그먼트 경로는 보존했다. WebM/GIF/WebP는 기존 자르기 변환을 분할 구간마다 실행하고 `_001` 순서로 다운로드한다. 결과 영상 길이를 알 수 없으면 오류를 표시한다. 번들 FFmpeg WASM과 3초 합성 WebM으로 MP4는 세그먼트 3개, 나머지 형식은 각각 세 구간 모두 반환 코드 0과 출력 파일을 확인했다. 합성 파일은 임시 폴더에서 삭제했다.
- `test/tools.test.js`, `test/record-result.test.js`, `qa/regression.cjs`에서 실제 높이 읽기, 사이트 메뉴와 다를 때 표시, 분할 형식 분기를 확인한다. Firefox의 실제 CHZZK 메뉴 렌더링, 방송 중 화질 전환, 실제 녹화 분할 파일 재생은 사용자 검증이 남는다.
- 자동 테스트: `npm run test:all` 단위 56/56, 기본 회귀 15/15, 오디오 14/14, UI 14/14 통과. `tools.js`, `record-result.js`, `record-result-logic.js` 문법 검사 통과. 변경 경로의 `git diff --check` 통과했고 의도하지 않은 추적 파일 삭제는 없었다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.5.zip`과 `.xpi` 생성. manifest/package/lockfile 루트/XPI 내부 manifest 모두 `1.1.5`, ZIP/XPI SHA-256 동일. XPI 내부에 화질 표시 버튼과 분할 형식 선택 포함. 기존 1.1.4 결과물과 바탕화면 사용자 자료는 보존했다.

## 2026-09-25 후속 수정: 팔로잉 hover 미리보기 (1.1.6)

- 사용자 보고: 왼쪽 팔로잉 채널 hover의 방송 미리보기가 보이지 않는다. 설정 `hoverPreview`, pointerover/out 리스너와 CSS는 현 코드와 Git HEAD 모두에 남아 있었다. 원래 구현은 사이드바 링크의 첫 이미지만 확대했으며 이미지가 없으면 즉시 반환했다. 첫 이미지는 대개 채널 아바타이므로 방송 썸네일도 보장하지 않았다. 링크 탐색도 상대 `/live/` 주소만 받았다.
- `tools.js`에서 상대/절대 방송 링크를 팔로잉 섹션 안에서 인식한다. 실제 주소를 `chzzk.naver.com`의 32자리 채널 ID로 검증한다. 팝업은 사이드바 이미지 없이도 먼저 열리고, 기존 방송 시작 알림이 이미 쓰는 팔로잉 API의 `liveImageUrl` 및 `liveTitle`로 갱신한다. 기존 조회가 있으면 재사용하고, hover만 활성화된 경우 60초 안에 한 번만 목록을 조회한다. API 오류 때에는 사이드바 이미지가 있으면 그 이미지를 유지한다. hover 종료·설정 OFF 뒤 늦은 응답은 표시하지 않는다. 새 observer나 polling은 없다.
- `qa/regression.cjs`에 사이드바 이미지가 없는 경우 실제 방송 썸네일이 채워지는 UI 흐름 테스트를 추가했다. `npm run test:all`: 단위 56/56, 기본 회귀 15/15, 오디오 14/14, UI 15/15 통과. `tools.js`와 `qa/regression.cjs` 문법 검사 통과. 테스트는 가짜 DOM/API이며 Firefox·CHZZK 실제 화면 검증은 아니다.
- `dist/chzzk-all-in-one-firefox-v1.1.6.zip`과 `.xpi`를 생성했다. manifest/package/package-lock 루트/lock 루트 패키지/XPI 내부 manifest 버전은 모두 `1.1.6`이며 ZIP과 XPI의 SHA-256이 같다. 관련 경로의 `git diff --check`는 공백 오류 없이 통과했고 추적 파일 삭제는 없다. 기존 빌드는 보존했다.
- 사이트 API의 실제 성공 응답, 팔로잉 사이드바의 현재 DOM, 마우스를 뗄 때 팝업 제거, 썸네일 및 제목은 사용자가 Firefox에서 확인해야 한다. 이 작업에서 바탕화면 비교본은 수정·삭제하지 않았고 Git push/릴리스/업로드는 하지 않았다.

## 다음 작업 규칙

- 원본 저장소의 현재 파일과 `git status`를 먼저 확인하고 필요한 범위만 조사한다. 바탕화면 작업본은 사용자가 삭제하기 전까지 비교 자료로 남아 있다.
- 실제 사이트에서 재현된 문제는 증상 → 관련 경로 → 이전 정상 구현 → 최소 수정 → 관련 및 핵심 회귀 테스트 순으로 처리한다.
- 매 작업 뒤 이 문서를 최신 상태로 갱신한다. Firefox/CHZZK 실제 확인과 자동 테스트를 분리해서 기록한다.

## 2026-09-25 기능 연결 감사 (코드 수정 없음)

- 범위: 현 `main` 작업 트리의 설정 UI → 실행 코드 → 이벤트/주기 갱신 연결, `QA-CHECKLIST.md`의 관련 기대 동작, `HEAD b343393`의 필요한 함수만 대조했다. 기존 단위 테스트 통과만으로 실사이트 정상이라고 판정하지 않았다. 이번 감사에서 소스·버전·빌드는 변경하지 않았다.
- **확정 회귀 / 트렌드 fallback**: `tools.js`의 `selectTrendStreams()`는 기준 시청자 이상 후보가 0이면 `items: []`를 반환한다. 800명·700명 두 방송, 기준 1,000명으로 직접 호출하면 최초/후속 모두 0개다. `QA-CHECKLIST.md` TREND-12는 인기 상위 방송 fallback을 요구하고, Git HEAD에는 그 fallback이 실제로 있었다. 현재 테스트 `TREND-THRESHOLD`는 빈 목록을 정답으로 검사해 이 회귀를 놓친다. 수정 우선순위 높음. 실제 CHZZK에서 해당 시간대 발생 여부는 미확인.
- **조건부 기능 중단 / 통나무 재활성 감지**: `content.js`에서 `log-power`의 `active === false`를 받으면 1초 DOM 검사와 30초 잔액 조회 타이머를 모두 중지한다. 같은 URL에서 `active`가 다시 true로 바뀌어도 재시작 경로가 없다. 따라서 그 상태 전이가 실제로 일어나면 배지와 보상 감지가 복구되지 않는다. 이는 코드 흐름으로 확인했으며 서버 상태 전이의 실제 빈도는 미확인. 수정 우선순위 높음, 특히 사용자가 통나무 동작을 문제로 보고한 바 있다.
- **조건부 범위 문제 / 팔로잉 사이드바 갱신**: `followingSections()`는 중첩 후보 중 가장 안쪽 컨테이너만 남긴다. 갱신 버튼이 그 컨테이너 밖 헤더에 있고 방송 링크가 안쪽 목록에 있으면 `findFollowingRefreshButton()`이 버튼을 못 찾는다. 현재 CHZZK의 실제 DOM을 이 환경에서 보지 못했으므로 확정 고장으로 분류하지 않는다. 사용자의 Firefox DOM/동작 확인 후 최소 변경을 결정한다.
- 다음 순서: TREND-12의 기존 fallback 복구와 회귀 테스트 수정 → 통나무 비활성·재활성 및 채널 이동 경로의 타이머/응답 경합 수정 → 팔로잉 새로고침 실제 DOM 확인. 광고, GRID, 화질, 타임머신, 녹화 등의 실제 정상 여부는 이번 정적 감사만으로 판정하지 않는다.

## 2026-09-25 후속 수정: 트렌드 fallback 및 통나무 상태 복구 (1.1.7)

- 사용자 요청에 따라 직전 감사의 두 확인된 결함을 수정했다. `tools.js`에서 기준 시청자 이상 방송이 없으면 Git HEAD에 있던 인기 목록 fallback을 복구한다. 기준 이상 방송이 있으면 현재 필터 결과를 쓰고, fallback 항목에는 급상승 표시를 붙이지 않는다. `test/tools.test.js`는 최초·후속 조회와 표시 수 제한을, `qa/regression.cjs`는 기존의 잘못된 빈 목록 기대를 바꾸어 검사한다.
- `content.js`에서 `log-power.active === false` 이후 1초 DOM 검사만 중지하고 30초 상태 조회는 유지한다. 같은 방송에서 `active === true`를 확인하면 기존 1초 검사 하나를 재시작한다. 임시 네트워크 오류 또는 HTTP 오류가 비활성 상태를 임의로 해제하지 않도록 했고, 이전 채널 응답이나 비활성 배지 재시도 타이머가 새 채널 상태를 덮지 않게 채널 ID를 확인한다. 기존 획득·로그·시계·API 주기는 보존했다.
- `qa/regression.cjs`는 `false → 요청 실패 → true`를 가짜 API/타이머로 재현해 30초 조회 타이머가 해제되지 않고 1초 검사가 정확히 한 번 재개됨을 확인한다. `npm run test:all`: 단위 57/57, 기본 회귀 16/16, 오디오 14/14, UI 15/15 통과. 변경 JavaScript 4개 문법 검사, 관련 `git diff --check` 통과. 추적 파일 삭제는 없다.
- 빌드 `dist/chzzk-all-in-one-firefox-v1.1.7.zip` 및 `.xpi` 생성. manifest/package/package-lock 루트와 루트 패키지/XPI 내부 manifest 버전이 모두 `1.1.7`; 두 패키지 SHA-256 동일. 기존 1.1.6 빌드와 바탕화면 자료는 보존했고 push, 릴리스, 업로드하지 않았다.
- 아직 Firefox 및 실제 CHZZK에서 트렌드 인원 부족 상황, 통나무 `active false → true` 전환, 채널 이동과 버튼 자동 획득을 확인하지 못했다. 특히 서버가 실제로 같은 방송에서 활성 상태를 바꾸는지와 보상 지급 성공은 자동 테스트로 검증할 수 없다. 직전 감사의 팔로잉 사이드바 갱신 DOM 후보는 이번 수정 범위 밖이며 사용자 실제 환경 확인이 필요하다.

## 2026-09-25 후속 수정: 팔로잉 미리보기 검은 화면 (1.1.8)

- 사용자 실환경 보고: 1.1.7에서 팔로잉 채널 hover 팝업 틀은 나오지만 이미지 영역은 검다. 이전 구현은 사이드바 이미지가 없더라도 팝업을 만든 뒤 `img.src = ""`로 두었고, 팔로잉 목록의 `liveInfo.liveImageUrl`이 비었거나 조회/이미지 로딩이 실패하면 검은 CSS 배경만 남을 수 있었다. 실제 계정의 응답/이미지 네트워크 오류는 받지 못했으므로 사용자 사례의 세부 원인을 단정하지 않는다.
- 기존 팔로잉 방송 알림의 전체 목록 조회는 그대로 두고, hover에서 채널별 `service/v3.3/channels/{id}/live-detail`을 한 번 조회해 `liveImageUrl`과 방송 제목을 받는다. 라이브 썸네일 → 기본 썸네일 → 기존 사이드바 이미지 순으로 이미지 오류 시 대체한다. 이미지 로딩 전과 모든 이미지 실패 후에는 `<img>`를 숨겨 영구적인 검은 직사각형을 피하고, 실패 문구를 표시한다. hover 종료, 채널 변경, 설정 OFF 뒤 늦은 응답은 무시한다. 새 폴링/observer는 추가하지 않았다.
- 현재 공개 원본 프로젝트의 [CHZZK API 정리](https://github.com/ouor/cloudstream-chzzk/blob/master/API.md)는 v3.3 live-detail의 `liveImageUrl`과 `defaultThumbnailImageUrl`을 기록한다. 이는 비공식 자료이며, 이 환경의 직접 HTTPS 요청은 로컬 TLS 자격 오류로 실패했다. 따라서 실제 CHZZK에서 이 endpoint/이미지의 성공은 아직 미검증이다.
- `qa/regression.cjs`의 UI fixture를 팔로잉 전체 목록 가정에서 채널별 live-detail 응답으로 바꾸고, 이미지 성공 및 순차 실패 후 `<img hidden>`을 확인했다. `npm run test:all`: 단위 57/57, 기본 회귀 16/16, 오디오 14/14, UI 15/15 통과. `tools.js`와 QA JS 문법 검사, 관련 `git diff --check` 통과. 추적 파일 삭제는 없다.
- 빌드 `dist/chzzk-all-in-one-firefox-v1.1.8.zip` 및 `.xpi` 생성. manifest/package/package-lock 루트와 루트 패키지/XPI 내부 manifest 모두 `1.1.8`, ZIP/XPI SHA-256 동일. 기존 빌드와 바탕화면 자료 보존. push, 릴리스, 외부 업로드 없음. 사용자의 Firefox에서 실제 방송 썸네일 표시/실패 문구를 확인해야 한다. 이 팝업은 현재 코드상 정적 방송 썸네일이며 영상 재생 미리보기는 구현된 적이 없다.

## 2026-09-25 후속 수정: 팔로잉 미리보기 썸네일 주기 갱신 (1.1.9)

- 사용자 요청: 팔로잉 채널 hover 미리보기 이미지의 갱신 주기를 개선. 1.1.8의 실제 코드는 hover 때 `live-detail`을 한 번 조회해 이미지 URL을 설정한 후 갱신하지 않았다. URL이 같으면 브라우저 캐시 때문에 hover를 다시 해도 오래된 프레임이 남을 수 있다.
- `tools.js`에서 hover가 유지될 때만 15초 간격으로 기존 `liveImageUrl`의 480형 썸네일을 새로 요청한다. 이미지 URL에 `_hanbi_preview` 시각 값을 넣어 같은 URL의 캐시를 우회한다. 새 이미지는 먼저 로드하고 성공할 때만 표시 중인 이미지를 교체하므로 네트워크 실패 시 현재 이미지가 남는다. 실패한 요청은 다음 15초에 다시 시도한다. 방송 상세 API는 hover 시작 시 한 번만 조회하며 반복 호출하지 않는다. 새 observer 또는 별도의 목록 조회는 추가하지 않았다.
- 하나의 타이머만 유지하고, 마우스를 떼거나 다른 채널로 이동하거나 기능을 끄거나 페이지가 닫히면 타이머를 해제한다. 늦게 끝난 이미지/상세 응답은 토큰과 현재 채널을 확인해 이전 팝업에 반영하지 않는다. 기존 사이드바 이미지, 기본 썸네일 및 이미지 실패 문구 fallback은 보존했다.
- `qa/regression.cjs`의 UI 흐름 검사에서 최초 이미지 실패, 15초 타이머 생성, 새 URL 요청 및 이미지 교체, hover 종료 시 타이머 해제와 늦은 완료 무시를 가짜 DOM/이미지 객체로 확인했다. `QA-CHECKLIST.md`에 실제 Firefox 확인 항목 EXT-09를 추가했다.
- 자동 확인: `npm run test:all` 단위 57/57, 기본 16/16, 오디오 14/14, UI 15/15 통과. `tools.js`와 `qa/regression.cjs` 문법 검사 및 관련 `git diff --check` 통과. 추적 파일 삭제 없음. 이 결과는 Firefox 화면이나 CHZZK 네트워크의 정상 동작을 보증하지 않는다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.9.zip`과 `.xpi` 생성. manifest/package/package-lock 루트 및 루트 패키지/XPI 내부 manifest 모두 `1.1.9`, ZIP/XPI SHA-256 동일. 기존 결과물과 바탕화면 자료 보존. Git push, 릴리스 및 외부 업로드 없음.
- 사용자 실환경 확인: 일반 생방송의 팔로잉 채널 링크에 30초 이상 hover하여 프레임이 실제로 갱신되는지 확인. 이미지 요청이 15초 전후마다 하나씩 생기고 `live-detail` API가 주기적으로 반복되지 않는지 확인. hover 종료/기능 OFF 후 추가 요청이 없는지, CDN이 `_hanbi_preview` 쿼리를 허용하는지 확인. 실제 썸네일 서버의 응답/캐시 정책과 이미지 내용 갱신 여부는 이 환경에서 확인하지 못했다.

## 2026-09-25 사용자 의도 정정: 팔로잉 hover **실시간 영상** 미리보기 (1.1.10)

- 사용자 실환경 피드백: 1.1.9의 썸네일 주기 갱신은 눈에 띄게 갱신되지 않았고, 원래 원한 기능은 정적 이미지가 아닌 방송 영상의 실시간 재생이었다. 1.1.9 해석은 잘못됐다. Git HEAD `b343393`와 당시 코드의 hover 미리보기는 사이드바 이미지를 확대하는 정적 구현이었다. 따라서 이 작업은 기존 정적 fallback을 보존하면서 영상 재생을 새로 추가한다.
- [현재 공개 CHZZK API 정리](https://github.com/ouor/cloudstream-chzzk/blob/master/API.md)와 [현행 타 확장의 팔로잉 영상 미리보기 구현](https://github.com/neder2/Cheese-spanner/blob/main/features/followingPreviewTooltip.js)을 비교했다. `live-detail.content.livePlaybackJson.media[].path`의 HLS 주소를 사용하는 경로를 확인했다. Firefox 확장 콘텐츠 스크립트의 동적 모듈 import와 접근성 조건은 [Mozilla 콘텐츠 스크립트 문서](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts) 및 [Firefox 버그 1803950](https://bugzilla.mozilla.org/show_bug.cgi?id=1803950)을 참고했다. 공개 자료만으로 이 사용자의 실제 방송 URL 성공을 입증하지는 못했다.
- `tools.js`에서 hover 팝업 안에 `<video>`를 추가했다. 방송 상세 응답의 HLS URL을 검증해 확장에 포함한 hls.js로 재생한다. 상세 응답에 재생 경로가 없고 숫자 `liveId`가 있으면 `auto-play-info`를 한 번 조회한다. 미리보기 영상은 무음으로 재생하며 첫 프레임 전에는 기존 썸네일을 보여준다. HLS/자동재생 실패 시 썸네일과 실패 문구를 유지한다. 1.1.9의 15초 썸네일 갱신 타이머는 사용자 의도에 맞지 않아 제거했다. 별도 주기 API 호출은 없다.
- 마우스를 떼거나 채널을 바꾸거나 설정을 끄거나 페이지가 닫히거나 hover 대상 링크가 DOM에서 제거되면 HLS 인스턴스를 파괴하고 video를 정지·해제한다. 늦은 응답은 토큰으로 무시한다. 기존 `video()`가 hover의 작은 영상을 녹화·스크린샷·컴프레서의 본방송 영상으로 잘못 고르지 않도록 제외했다. 제한 중계에서 가용하지 않은 1080p를 강제하지 않으며 기존 광고/GRID/화질/타임머신 경로는 변경하지 않았다.
- hls.js 1.7.3의 `hls.light.min.mjs`와 원본 LICENSE를 npm 배포 패키지에서 그대로 포함했다. hover 때만 동적 import하므로 초기 페이지 로드에는 이 라이브러리를 실행하지 않는다. 사용자가 별도 프로그램을 설치할 필요는 없다. `manifest.json`의 web accessible 범위는 CHZZK 도메인으로 제한했고 `NOTICE`에 저작권·라이선스·출처를 기록했다. `build.ps1`에도 두 파일을 포함했다.
- `qa/regression.cjs`는 HLS 주소 선택·무음 재생·썸네일 fallback·마우스 이탈 후 파괴·악성 호스트 배제·본방송 영상 선택 격리를 가짜 DOM/HLS 인스턴스로 확인한다. `QA-CHECKLIST.md`는 정적 이미지 갱신 기대를 실시간 영상 재생/중단/실패 항목으로 바꿨다. `npm run test:all`: 단위 57/57, 기본 16/16, 오디오 14/14, UI 17/17 통과. 새 hls.js ESM을 Node에서 import해 기본 export와 버전 1.7.3을 확인했다. 변경 JS 문법 및 관련 `git diff --check` 통과.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.10.zip` 및 `.xpi` 생성. manifest/package/package-lock 루트 및 루트 패키지/XPI 내부 manifest 버전이 모두 `1.1.10`; ZIP/XPI SHA-256 동일. HLS 모듈과 라이선스가 XPI 안에 있음을 확인했고 추적 파일 삭제는 없다. 현재 작업 트리의 다른 미완료 변경은 그대로 두었고 Git reset/rebase, push, 릴리스, 외부 업로드를 하지 않았다. 실제 Firefox·CHZZK에서 HLS 영상이 재생되는지, 썸네일에서 영상으로 전환되는지, 채널 이탈 시 요청이 멈추는지, 광고/GRID 설정 조합 및 제한 중계에서 정상 fallback하는지는 아직 확인하지 못했다. 사용자 검증 결과에 따라 HLS 네트워크·모듈 import 오류를 좁혀 수정한다.

## 2026-09-25 통나무 파워 동작 감사 (코드·빌드 변경 없음)

- 현재 소스의 실제 흐름을 확인했다. 라이브 페이지에서 `log-power` API를 최초 조회한 뒤 30초 간격으로 잔액·활성 상태·claims를 확인한다. `active: false`이면 1초 버튼 탐색을 멈추지만 30초 조회는 유지하고, 같은 채널이 다시 활성화되면 탐색을 재개한다. 배지와 예상 시각은 설정에 따라 표시된다. 비시청 claim은 PUT의 HTTP/응답 코드가 성공일 때 로그를 저장한다.
- **확인된 정확도 한계:** 1시간 시청 보상은 CHZZK 화면 버튼을 누른 직후 실제 지급 성공 여부를 확인하지 않고 `view` 로그를 기록한다. 버튼 클릭이 실패하거나 서버가 지급을 거절해도 로그가 성공처럼 남을 수 있다. 사이트 배지와 팝업의 다음 시각은 가장 최근 `view` 로그 +1시간에서 계산하므로 이 경우 같이 틀어진다. 이 시각은 서버가 알려준 다음 지급 시각이 아닌 추정값이다. 기존 획득 경로를 추측으로 교체하지 않고, 실제 버튼 클릭 전후 `log-power` 응답의 기준·지급 상태를 확보해 확인 가능한 방식으로 고쳐야 한다.
- **추가 개선 후보:** 활성 채널에서 1초 DOM 폴러와 별도 1초 배지 복구 폴러가 시계 갱신을 중복 요청한다. 배지 갱신은 매번 기존 버튼을 제거하고 재생성한다. 실제 UI 끊김 여부는 미확인이며, 기능 안정화 후 단일 폴러·기존 노드 갱신으로 정리할 수 있다. 서버 잔액 조회 자체는 30초 주기다.
- 자동 검사: 이번 작업에서 `node qa/regression.cjs` 기본 16/16 통과. 이는 가짜 API/DOM으로 검증한 것으로 실제 1시간 보상 지급, 잔액, 로그, 시각의 정확성은 입증하지 않는다. `QA-CHECKLIST.md` POWER/CLAIM 항목은 현장 확인 전까지 미체크다. 이번 감사는 소스·테스트·버전·빌드를 변경하지 않았다.

## 2026-09-25 통나무 우선순위 확정 (코드·빌드 변경 없음)

- 사용자 우선순위는 **채팅창 아래 보유량 표시와 자동 받기** 두 기능이다. 통나무 로그·다음 획득 예상 시각 등 부가 기능은 현 구현과 사용자 데이터를 보존한 채 후순위로 보관한다. 이 범위 결정은 다른 확장 기능을 제거하거나 비활성화한다는 뜻이 아니다.
- 코드상 자동 받기는 설정이 켜져 있을 때 라이브 채팅의 활성화된 1시간 보상 버튼을 1초 주기로 찾아 클릭하고, 다른 유형의 claim은 `PUT` 성공 응답을 확인한다. 보유량은 `log-power` 응답을 30초 주기로 반영한다. 이 경로의 가짜 DOM/API 회귀 검사는 직전 감사에서 16/16 통과했지만, 실제 CHZZK의 현재 버튼 DOM과 계정 지급 결과는 확인하지 못했다. 따라서 자동 받기를 실환경 정상으로 판정하지 않는다.
- 다음 현장 확인은 1시간 보상 직전/직후 잔액 변화와 버튼 소멸 여부에 집중한다. 로그·시계의 부정확성은 자동 받기 성공 여부와 분리해서 다루며, 검증 전 기존 획득 코드를 대체하거나 부가 기능·기록을 삭제하지 않는다.

## 2026-09-25 GitHub 재연결·영구 설치용 서명 준비

- 사용자가 기존 Git 원격의 GitHub 저장소가 404인 것을 확인한 뒤, 같은 이름의 공개 birowsi/CHZZK-All-in-One 저장소를 새로 만들었다. 연결된 GitHub API에서도 새 저장소가 비어 있고 계정에 push 권한이 있음을 확인했다. 사용자는 Codex 내 브라우저 로그인을 원하지 않는다. 현재 로컬 Git 이력을 보존해서 새 main으로 올릴 계획이다.
- 문제 원인: build.ps1은 ZIP을 XPI로 복사하므로 결과물이 미서명이다. [Mozilla 공식 문서](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)에 따라 일반 Firefox의 영구 설치에는 AMO 서명이 필요하다. sign.ps1을 추가해 현 버전을 다시 빌드하고 패키지만 별도 작업 폴더에 풀어 공식 web-ext 10.6.0의 unlisted 채널로 서명하게 했다. 입력은 WEB_EXT_API_KEY와 WEB_EXT_API_SECRET 환경 변수이고, 비밀값을 파일·명령 인수·Git에 넣지 않는다. 반환 XPI의 내부 버전과 Mozilla 서명 파일을 확인하며 작업 폴더는 검증된 dist 내부 경로만 정리한다. 이 서명 과정은 패키지를 Mozilla에 제출하므로 사용자가 키를 준비한 뒤 직접 실행해야 한다.
- README.md에 개발용 미서명 XPI와 영구 설치용 서명 XPI의 차이, 비공개 배포용 서명, 일반 Firefox 설치 절차를 명시했다. .gitignore는 새로 만든 빌드 결과와 개발 의존성만 무시하며, 이미 Git에 기록된 과거 배포 파일은 삭제하지 않는다.
- 검증: PowerShell 스크립트 문법 검사 및 키 누락 시 사전 차단 확인. 현재 1.1.10 ZIP을 공식 web-ext lint --self-hosted로 검사한 결과 오류 0, 경고 2(CSP의 WASM 실행 허용, 고정된 hls.js 경로의 동적 import). npm run test:all 전체 통과(단위 57, 기본 16, 오디오 14, UI 17). 실제 AMO 서명과 서명 XPI의 Firefox 영구 설치는 아직 확인하지 못했다. Mozilla 계정/API 키는 이 작업 환경에 없다.
- 추가 발견: 현재 1.1.10 개발용 XPI 파일은 사용 중이라 덮어쓸 수 없었다. 서명 절차에는 ZIP만 필요하므로 기존 build.ps1에 ZipOnly 선택지만 추가하고 sign.ps1은 이 경로를 쓴다. 기존 기본 빌드의 ZIP+개발용 XPI 생성 동작은 유지한다. ZipOnly 재빌드 성공, 새 ZIP 내부 manifest 및 manifest/package/lock 루트 버전 모두 1.1.10, JavaScript 22개 문법 검사 통과. 이미 열린 XPI는 강제로 닫거나 삭제하지 않았다.
- GitHub 업로드 상태: 전체 작업 트리를 로컬 main 커밋 62b7e04로 보존하고 인증 오류 기록을 3f5529e로 추가했다. 샌드박스에서는 Git Credential Manager가 Windows 자격 증명 저장소에 기록하지 못했고 장치 코드 시도에서도 TLS/인증서 오류가 났다. 사용자는 로그인 중 메모리 읽기 오류를 보고했다. 기존 69개 커밋을 잃는 GitHub API 스냅샷 업로드는 쓰지 않았다. 사용자의 승인하에 일반 Windows 실행 환경에서 Git push를 재실행해 새 공개 저장소의 main으로 기존 이력을 모두 올렸다. 별도 브라우저 로그인 창은 열지 않았고 원격 추적 브랜치는 origin/main으로 설정됐다. 이번 인수인계 수정은 후속 커밋으로 관리한다.
- 사용자는 AMO 개발자 계정이 없다. 따라서 sign.ps1은 준비됐지만 Mozilla 서명 요청을 실행하지 않았고 영구 설치용 서명 XPI는 없다. 현재 dist의 1.1.10 XPI는 미서명 개발용이다. AMO 계정/API 자격 증명이 준비되면 이 스크립트로 비공개 배포 서명을 진행하고 실제 Firefox 설치를 확인해야 한다.

## 2026-09-25 서명 절차 간소화

- 사용자는 쉽게 서명하기를 요청했다. 공식 AMO 개발자 허브의 수동 업로드 경로를 README의 첫 번째 방법으로 바꿨다. 평소 브라우저에서 Mozilla 계정을 만든 뒤 새 부가 기능 제출 → On your own(직접 배포) → 이미 생성된 1.1.10 ZIP 업로드 → 검증·심사 완료 후 서명 XPI 다운로드 순서다. API 키와 sign.ps1은 반복 서명용 선택 사항으로 남겼다. 별도 런타임 프로그램 설치, 기존 기능 삭제, 버전 변경은 없다.
- [Mozilla 제출 안내](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)는 웹 업로드와 직접 배포 옵션 및 서명 XPI 다운로드 경로를 설명한다. 일반 Firefox 서명에는 Mozilla 계정과 AMO 심사가 필요하므로 현 사용자의 계정이 없는 상태에서 서명 XPI를 만들 수 없다. 계정 생성·약관 동의·업로드는 수행하지 않았다.
- 검증은 문서와 기존 ZIP 존재 여부, 관련 Git diff 공백/삭제 확인으로 제한한다. 확장 실행 코드가 바뀌지 않아 자동 테스트와 빌드를 반복하지 않는다. 실제 서명 XPI 및 Firefox 영구 설치는 미확인이다.

## 2026-09-25 AMO 소스 제출 단계 및 검증 경고

- 사용자가 AMO 업로드 중 두 검증 경고(`MANIFEST_CSP`, `UNSAFE_VAR_ASSIGNMENT`)와 소스 코드 제출 여부 질문을 전달했다. 현재 `manifest.json`의 `script-src 'self' 'wasm-unsafe-eval'`은 녹화 변환용 패키지 내 FFmpeg WASM 컴파일에 필요하다. `tools.js`의 동적 `import()` 인자는 고정된 `browser.runtime.getURL('vendor/hls.light.min.mjs')`이고, 팔로잉 hover 영상에 쓰는 패키지 내 파일만 가리킨다. 공식 Mozilla 문서는 MV3 WebAssembly에 `wasm-unsafe-eval`이 필요하고 content script의 `moz-extension:` 모듈 동적 import를 허용한다고 명시한다. 두 경고는 검토 필요 상태이며 심사 통과를 보장하지 않는다.
- 당시 소스 제출 질문에 **Yes**를 권고했으나, 뒤에 사용자가 **No**로 제출한 1.1.10이 AMO에서 승인됐다. Yes가 반드시 필요하다는 판단은 정정한다. 확장 1차 코드는 읽을 수 있지만 배포 ZIP에 hls.js 축소본과 FFmpeg 코어/바이너리가 있으므로 원본·재현 절차를 준비해 뒀다. `AMO-SOURCE-README.md`에 Windows/PowerShell 패키징 명령, 의존성 버전·원본 링크, FFmpeg worker의 로컬 코어 import 적응 내용을 기록했다. 별도 소스 묶음 `dist/chzzk-all-in-one-firefox-v1.1.10-source.zip`을 만들었다. 기존 AMO 업로드용 `dist/chzzk-all-in-one-firefox-v1.1.10.zip`과 확장 코드·버전은 변경하지 않았다.
- 검증: 실제 업로드 ZIP 40개 항목이 소스 묶음에도 모두 있고, 각 항목 SHA-256이 일치한다. 소스 묶음은 61개 항목이며 `node_modules`, 구버전 `dist`, 기존 `firefox`/`example` 자료는 제외했다. hls.js 1.7.3 파일은 공식 npm 배포본과 SHA-256이 일치한다. FFmpeg 코어 ESM JS/WASM 및 wrapper의 6개 파일은 설치된 npm 배포본과 바이트 일치한다. `worker.js`는 로컬 코어를 정적 import하도록 적응한 차이를 소스 안내에 공개했다. `web-ext lint`로 기존 배포 ZIP을 재확인한 결과 오류 0, 경고 2이며 코드 실행·Firefox/CHZZK 실사용은 이번 문서·소스 제출 작업에서 확인하지 않았다.
- 1.1.10은 사용자가 No로 제출했으며 AMO 개발자 센터 화면에는 승인됨·오류 0·경고 2로 표시됐다. 준비한 소스 ZIP은 이 승인에 사용되지 않았다. 검토자 메모나 소스 제출은 향후 AMO가 별도 요청할 때 준비 자료를 활용한다. 로그인 필요 기능의 테스트 자격 증명은 채팅이나 저장소에 넣지 않는다. 서명 XPI의 Firefox 설치는 아직 미확인이다.

## 2026-09-25 REC WebM 화질 개선, 1.1.11

- 증상: 사용자가 1.1.10으로 녹화한 `원본 WebM`의 영상이 재생 화면보다 눈에 띄게 나쁘다고 보고했다. 이전에 보고된 4.1초·1.4 MB 녹화는 파일 전체 기준 평균 약 2.7 Mbps다. 코드상 REC는 본방송 video의 `mozCaptureStream`을 Firefox `MediaRecorder`에 전달해 VP8/Opus WebM으로 다시 인코딩하고, 생성자에 비트레이트를 지정하지 않았다. Mozilla 문서상 미지정 영상 비트레이트 기본값은 브라우저에 따라 2.5 또는 10 Mbps여서, 1080p 영상이 낮은 목표값으로 압축됐을 가능성이 높다. 출력 저장이나 MP4 변환 후단에서 WebM 화질을 되살릴 수는 없다.
- `tools.js`의 기존 녹화 시작 지점에 해상도 비례 `videoBitsPerSecond`를 지정했다. 1080p는 12 Mbps, 720p는 약 5.3 Mbps, 480p는 하한 3 Mbps, 4K는 상한 16 Mbps다. 영상 크기를 아직 모르면 12 Mbps를 요청한다. 오디오는 192 kbps를 요청한다. 기존 MIME 우선순위, Firefox 오디오 모니터·컴프레서 연결, 공유 캡처, 결과 창, 원본 저장/변환 흐름은 그대로 둔다. 선택값은 브라우저가 조정할 수 있고, 실제 인코딩 품질은 보장하지 않는다. 더 큰 파일·CPU 사용량 및 장시간 녹화 메모리 부담을 예상한다.
- `test/tools.test.js`에 해상도·상하한값 검사, `qa/regression.cjs --audio`의 녹화 시작 실패 경로에 실제 MediaRecorder 생성자 옵션 확인을 추가했다. QA 목록에 1080p 30초 이상 WebM 원본을 재생 화면과 비교하고 480p 제한 중계를 확인하는 항목을 추가했다. README에는 `원본 WebM`이 방송 전송 파일의 무손실 복사본이 아니라는 점을 설명했다. 사용자의 별도 프로그램 설치 요구는 없다.
- 검증: `npm run test:all` 단위 58/58, 기본 회귀 16/16, 오디오 14/14, UI 17/17 통과. 루트 JS 14개와 변경 QA/테스트 문법 통과. `build.ps1`로 1.1.11 ZIP과 미서명 XPI 생성. 이전 1.1.10 ZIP 대비 40개 패키지 항목 모두 유지(추가·삭제 0), ZIP 내부 manifest와 프로젝트 package/lock 버전 모두 1.1.11. `web-ext lint --self-hosted` 오류 0, 기존 경고 2. 실제 Firefox에서 새 WebM의 해상도·프레임·비트레이트·소리, 실제 CHZZK 영상과의 시각 비교, Mozilla 서명은 아직 확인하지 않았다. 기존 승인 1.1.10은 변경되지 않았다.

## 2026-09-25 HLS RAW 녹화 시험 경로, 1.1.12

- 사용자 확인: 1.1.11의 REC WebM 화질은 개선됐으나 재인코딩 없는 방송 원본 저장을 원한다. 출력은 원본 스트림 형식 그대로(.ts 또는 분할 MP4) 선택했다. 기존 REC는 `MediaRecorder`에서 VP8/Opus로 다시 인코딩하므로 비트레이트를 높여도 전송된 H.264/AAC 조각의 바이트 그대로는 될 수 없다.
- 변경: 기존 `timeshift.js`의 본방송 HLS 탐색을 재사용해 `hlsFragLoaded` 이벤트를 RAW 녹화가 켜진 동안에만 듣는다. 새 fetch/XHR/webRequest 후킹이나 별도 플레이어·폴링은 추가하지 않았다. 주 플레이어가 받은 `main` 조각의 ArrayBuffer를 즉시 복사한다. MPEG-TS는 순서대로 `.ts`, fMP4는 HLS 초기화 조각과 연속 미디어 조각을 `.mp4`로 연결한다. 압축 영상·오디오 페이로드를 재인코딩하지 않는다. 플레이어 도구에 `RAW` 버튼을 별도로 추가했으며 `STOP` 시 해당 파일을 직접 다운로드한다. 기존 `REC`의 오디오 모니터, WebM, 결과 창, MP4/GIF/WebP 변환은 변경하지 않았다.
- 보호: 광고 플레이어와 팔로잉 hover 플레이어가 아닌 본방송 HLS 인스턴스만 사용한다. 별도 오디오 조각, 암호화, 저지연 부분 조각, 지원하지 않는 형식, 화질/포맷 전환, 시퀀스 누락을 감지하면 중단한다. 방송/플레이어 교체와 탭 종료에도 중단한다. 이미 받은 연속 구간이 있으면 부분 파일 다운로드를 시도하고 사용자에게 이유를 보여준다. 이 방식은 녹화 시작 전에 이미 버퍼에 있던 구간을 저장하지 않으며, 전체 Blob을 탭 메모리에 모으므로 장시간 녹화의 메모리 한계가 있다. 자동 다운로드 요청의 실제 저장 성공은 Firefox 다운로드 목록 확인이 필요하다.
- 검증(자동): `npm run test:all` 단위 60/60, 기본 회귀 16/16, 오디오 14/14, UI 17/17 통과. RAW 단위 테스트에서 TS/fMP4 바이트 보존, 초기화 조각 포함, 시퀀스 누락 시 부분 파일, 이벤트 리스너 해제를 확인했다. MAIN/isolated 도구 명령의 모의 DOM 흐름에서 본방송 HLS 연결, 원본 다운로드 이름, 종료 응답을 확인했다. 변경 JS 문법 검사와 `git diff --check` 통과. FFmpeg로 생성한 H.264/AAC fMP4 샘플에서 init+조각 연결 파일이 `ffprobe`와 디코딩을 통과했다. 방송 중간부터 결합한 샘플도 디코딩됐지만 시작 시간이 0이 아니고 컨테이너 길이에 앞부분이 포함됐다. 이는 RAW 파일 탐색·길이 표시가 실제 재생 시간과 다를 수 있는 한계다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.12.zip`과 미서명 `.xpi`를 생성했다. 이전 1.1.11 패키지 대비 항목 40개가 모두 유지됐고 추가·삭제는 없다. manifest/package/package-lock 및 ZIP 내부 manifest 모두 1.1.12, ZIP/XPI SHA-256 동일. `web-ext lint --self-hosted`: 오류 0, 기존 경고 2(CSP WASM, 고정 경로 dynamic import). 공식 AMO 승인본 1.1.10과 별개다.
- **실제 미확인**: Firefox의 MAIN world에서 CHZZK 플레이어가 `hlsFragLoaded` 이벤트를 이 형태로 내보내는지, 일반 방송 fMP4의 초기화 조각·오디오가 한 파일로 재생되는지, 스포츠 TS의 오디오·화질, 페이지 출처의 Blob 다운로드 허용, 30분 이상 녹화의 메모리, 시작 시간/탐색 UI를 확인하지 못했다. 사용자 Firefox에서 `QA-CHECKLIST.md`의 RAW-01~05를 먼저 확인한다. 실패한다면 받은 파일 형식·재생 오류·대략 길이만 기록하고 토큰이 있는 URL은 공유하지 않는다. 실방송 확인 전 AMO 업로드/릴리스/원격 push는 하지 않았다.

## 2026-09-25 타임머신 과거 버퍼 제한 해제, 1.1.13

- 사용자 요청: 타임머신 버퍼를 거의 무제한으로 보존. 작업 전 `main`/HEAD `dacc340`, 이전 1.1.12 RAW 시험 경로의 미커밋 변경 10개 파일을 확인했다. 해당 변경은 보존하고 그 위에서 수정했다. 현재 Git 원격 반영 및 AMO 승인본은 여전히 1.1.11/1.1.10 상태이며 이 작업에서는 push/업로드하지 않았다.
- 원인: `timeshift.js`가 TM 활성화 시 본방송 HLS `backBufferLength`를 300초로 지정했다. 이는 Firefox 메모리와 관계없이 확장 코드가 약 5분 이전의 버퍼를 제거하게 만드는 제한이다. `cheese-knife` 원본은 `Infinity`를 사용하고 있었고, hls.js 공식 API 문서도 `Infinity`를 HLS의 과거 버퍼 자동 제거 제한 없음으로 설명한다. 별도의 `maxBufferSize`/`maxBufferLength`/`maxMaxBufferLength`는 전방 버퍼 설정이다.
- 수정: 기존 `createTimeShift().enable()`의 `backBufferLength`만 `Infinity`로 바꿨다. 전방 버퍼 수치, 타임머신 패널과 탐색 범위, LIVE 복귀, 플레이어 교체와 실패 시 원본 설정 복원, 광고/GRID/화질/REC/RAW/오디오 경로는 변경하지 않았다. 사용자가 TM 패널을 열어 버퍼 유지 모드를 켰을 때 적용되고, LIVE·패널 닫기에서 기존대로 원래 HLS 설정으로 돌아간다. 이미 버려진 과거 구간을 다시 가져오지는 않는다.
- 검증: `test/timeshift.test.js`에서 활성화 후 값이 `Infinity`임을 확인하도록 바꿨고, 기존 LIVE/닫기/교체 복원 테스트를 유지했다. `npm run test:all` 통과: 단위 60/60, 기본 회귀 16/16, 오디오 14/14, UI 17/17. 변경 JavaScript 및 QA 문법 검사, `git diff --check` 통과. 추적 파일 삭제 없음. 1.1.13 ZIP/XPI를 빌드했으며 이전 1.1.12 패키지의 40개 항목을 모두 유지했다. ZIP 내부 manifest와 루트 manifest/package/lock 버전 모두 1.1.13, ZIP/XPI 바이트 동일. 이전 1.1.12 `web-ext lint`는 오류 0·기존 경고 2였고 이 숫자 설정 변경 뒤에는 반복 실행하지 않았다.
- 실제 제한과 남은 확인: hls.js가 제거하지 않아도 Firefox의 MSE 메모리 관리가 오래된 구간을 제거할 수 있다. 장시간 켜둘수록 메모리 사용과 버퍼 압박이 늘 수 있다. 실제 Firefox/CHZZK에서 10분 이상 `buffered` 시작·끝 시각, TM 패널의 저장 시간, 재생/소리, LIVE 복귀, 플레이어 교체, 브라우저 메모리를 아직 확인하지 못했다. `QA-CHECKLIST.md` 25절의 수동 항목으로 확인한다. 1.1.13 XPI는 미서명 시험 빌드다.

## 2026-09-25 채팅 글자 크기·통나무 로그·GIF 프로필 정리, 1.1.14

- 작업 전 상태: 작업 루트 `C:\Users\hanbi\Documents\ChatGPT\치지직\chzzk-all-in-one`, `main` HEAD `dacc340`/원격 `origin/main`. 1.1.12 RAW 및 1.1.13 TM 작업의 미커밋 파일을 보존했다. 이번 변경은 그 위에 적용했으며 Git push·AMO 업로드·서명·릴리스는 하지 않았다.
- 채팅 원인: 현재 CHZZK 라이브 페이지의 채팅 DOM에서 기존 `[class*='live_chatting_message_text'], [data-message-text]` 선택자는 0개, 새 `aside#aside-chatting [role='log'] [class*='_chatting_message_'] > [class*='_text_']` 선택자는 14개 메시지와 일치했다. 해당 사이트 DOM은 2026-09-25 공개 페이지에서 읽기 전용으로 확인했다. `tools.js`의 기존 스타일 규칙에 새 선택자를 추가하고 이전 선택자는 유지했다. 설정 저장·즉시 반영 흐름, 채팅 입력·닉네임은 변경하지 않았다.
- 통나무 원인과 수정: 직접 `view` 버튼 클릭과 확장의 PUT 성공 경로만 로그를 작성했다. 직접 사이트 버튼으로 획득하거나 PUT 응답에 유효한 획득 수량이 없으면 성공 후에도 로그가 없을 수 있었다. 기존 `log-power` 잔액 조회 시 같은 채널의 이전 잔액보다 증가한 양에서 그 사이 이미 기록한 양을 빼고, 남은 양만 `OTHERS`(기타) 로그로 저장한다. 채널 첫 조회·잔액 감소·비활성 상태/재활성 직후는 증가 기록으로 보지 않는다. 새 폴링/API 패치는 없고 기존 30초 조회를 재사용한다. 기존 view/FOLLOW/prediction 상세 로그와 저장된 기록은 유지한다. 서버의 잔액이 다른 이유로 증가하면 보완 기록은 `기타`로 표시되며 구체적인 지급 종류는 추정하지 않는다.
- 사용자 요청에 따라 움직이는 GIF 프로필 자동 재생 설정·URL 변경 코드·전용 MutationObserver를 제거했다. `movingGifProfile`의 기존 저장값은 삭제하지 않았고 비활성 데이터로 남는다. 파워 배지, 보유량, 자동 획득, 로그 창, 프로필 기본 표시 등 다른 경로는 유지했다.
- 검증: `npm run test:all` 단위 60/60, 기본 회귀 18/18, 오디오 14/14, UI 17/17 통과. 이후 비활성 전환에 관한 작은 가드를 추가해 기본 회귀 18/18을 다시 통과했다. `content.js`, `tools.js`, `popup.js`, `qa/regression.cjs` 문법 검사와 `git diff --check` 통과. `qa/regression.cjs`는 새/기존 채팅 선택자와 잔액 증가, 기존 로그 공제, 채널 변경·감소·비활성 제외를 확인한다. 추적 파일 삭제 없음.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.14.zip` 및 동일 바이트 미서명 `.xpi` 생성. manifest/package/lockfile 루트/lock 루트 패키지/ZIP 내부 manifest 버전 모두 1.1.14. 1.1.13 패키지의 40개 항목 모두 유지했다. 기존 빌드·Git 이력·사용자 데이터는 보존했다.
- 실제 미확인: 현재 사이트의 메시지 DOM 선택자는 확인했지만 수정한 확장을 Firefox에 설치해 글자 크기를 바꾸는 동작은 테스트하지 않았다. 로그인 계정의 통나무 실제 획득·잔액 증가·로그 창 반영, 수동 획득의 기록 종류, 여러 탭이 같은 채널을 볼 때 중복 기록 여부는 Firefox/실제 CHZZK에서 확인이 필요하다. `QA-CHECKLIST.md`의 EXT-06, CLAIM-10/10A, POWER-08을 사용한다.

## 2026-09-28 일시정지 버퍼 유지와 REC 음소거 독립 회귀 고정, 1.1.15

- 인수인계 작업(2026-09-28). 작업 전 상태: 이 문서에 기록된 1.1.12 RAW·1.1.13 TM 무제한 버퍼·1.1.14 채팅/통나무 변경이 모두 미커밋 working tree에 있었고, 1.1.15 작업(일시정지 버퍼 유지)은 코드·테스트·README/QA 문서까지 완료돼 있었으나 HANDOFF 섹션과 1.1.15 빌드가 없었다. 이 섹션이 그 빈 부분을 채운다. 안전 patch 사본은 `qa/session-start-20260928.patch`, 시작 상태 기록은 `qa/session-start.md`에 있다.
- 기능 내용(기존 working tree에서 확인): 본방송이 일시정지되면 TM 패널을 열지 않아도 `timeshift.js`의 `keepPausedBuffering`이 HLS 앞쪽 버퍼 목표(`maxBufferLength`/`maxMaxBufferLength`)를 3600초로 올리고 `resumeBuffering`/`startLoad(currentTime, true)`으로 조각 로딩을 재개한다. 재생이 재개되면 원래 적용값으로 되돌리고 `pausedValues`를 비운다. hls.js가 메모리 압박으로 목표를 낮춘 값은 재상향하지 않는다. `restore`는 `pausedValues`에 적용된 값을 기준으로 원래 설정을 복원한다. 서버 DVR 위조가 아니라 로컬 버퍼 유지이며, 실제 보존 길이는 Firefox 메모리·MSE 한도에 좌우된다.
- REC 음소거 독립은 기존 구현 동작(캡처 스트림은 시청 음소거와 분리, 시청용 모니터만 음소거)을 `qa/regression.cjs --audio`의 `AUDIO-MUTED-REC`와 QA-CHECKLIST REC-06A로 회귀 고정했다. 코드 변경은 없다.
- 검증(자동, 2026-09-28): `npm test` 단위 63/63, `npm run test:audit` 기본 회귀 18/18·오디오 15/15·UI 17/17 통과. 루트 JS 14개 `node --check` 통과. 일시정지 버퍼 테스트는 조각 로딩 재개·목표 상향·재개 시 복원·메모리 압박 하향 보존을 가짜 HLS로 확인한다. 이는 Firefox/실제 방송 검증이 아니다.
- 빌드: `dist/chzzk-all-in-one-firefox-v1.1.15.zip` 및 미서명 `.xpi` 생성. manifest/package/lockfile 루트/lock 루트 패키지/XPI 내부 manifest 모두 1.1.15.
- 실제 미확인: Firefox에서 6분 이상 일시정지 후 `buffered.end` 전진, 재생 재개 지점, LIVE 복귀, 음소거 상태 REC 파일의 소리는 `QA-CHECKLIST.md` 25절·REC-06A의 수동 확인이 필요하다.

## 2026-09-28 실제 Firefox E2E·성능 세션 (코드 변경 없음)

이 섹션은 2026-09-28 자동화 세션의 실측 기록이다. 이 세션에서 확장 소스·버전은 변경하지 않았다. 모든 산출물은 `qa/` 아래에 있고 Git push·커밋은 하지 않았다.

### E2E harness (qa/firefox-e2e/, 프로젝트 코드와 분리)

- 구성: geckodriver 0.36.0 + Selenium WebDriver + 실제 설치된 Firefox 156.0.1 (프로덕션 바이너리). Firefox는 세션별 임시 프로필로 띄우고, WebDriver BiDi `webExtension.install`로 프로젝트 루트(언팩 상태)를 temporary add-on으로 설치한다. 사용자의 실제 Firefox 프로필은 건드리지 않는다.
- BiDi 사용법 메모: 세션 생성 시 `webSocketUrl: true` capability가 필요하고, `webExtension.install`의 파라미터는 `{ extensionData: { type: "path"|"archivePath", path } }` 형태다. `archivePath`(XPI) 설치는 Firefox 156에서 `nsIZipReader.open` 실패(NS_ERROR_FAILURE)로 동작하지 않았고(빌드 ZIP을 이용한 BiDi 설치의 알려진 제한, AMO/수동 설치와는 무관), 언팩 디렉터리 `path` 설치는 성공했다. `--websocket-port`는 0(자동 할당)으로 두고 응답의 `webSocketUrl`을 쓴다. 고정 포트는 다른 프로그램과 충돌할 수 있다(9777 충돌 사례).
- 재생 시작: CHZZK는 소리 있는 autoplay를 막는다. 합성 MouseEvent는 무신뢰(untrusted)라 무시되며, WebDriver의 신뢰 클릭(플레이 버튼/video)과 space 키 입력으로 재생을 시작한다.

### 핵심 E2E 결과 (qa/firefox-e2e-results.json, 7/7 PASS)

실제 라이브(EOE 방송, 1080p)에서 확장 설치 후:

1. PLAY: 1080p 재생, currentTime 진행, readyState 4, paused=false.
2. UI-01: `#hanbi-player-tools` 1세트, 버튼 REC/RAW/SHOT/Q 1080p/TM (Q 버튼 텍스트에 실제 디코딩 높이 표시), 중복 없음.
3. QUALITY: 실제 `videoHeight`=1080 확인.
4. AD-MODAL: 관찰 구간에서 광고 차단 경고·치트키 모달 없음. (실광고/실경고 유발은 강제 불가 — fixture 회귀 테스트로 보완, 실광고 검증은 아님)
5. SPA-DUP: 채널 3회 이동 반복에서 툴바 항상 1개, `id^=hanbi` 중복 0.
6. SPA-PLAY: 이동 후 재생 회복(1080p, 프레임 진행).
7. CONSOLE: 세션 중 미처리 오류 0.

### 1.1.15 일시정지 버퍼 실측 (qa/firefox-e2e-pause-results.json)

일반 라이브에서 TM 패널을 열지 않고 space로 일시정지, 6분 관찰:

- **작동 확인**: 일시정지 직후 조각 로딩이 재개돼 `buffered.end`가 47.0→62.0초로 전진했다(일시정지 시점 +15초). `buffered.start`는 26.0→44.0으로 전진해 MSE가 가장 오래된 구간을 트리밍하는 동안 일시정지 지점(45.3초) 구간은 끝까지 보존됐다.
- `currentTime`은 6분 내내 45.27315초로 완전 동결(변화 0).
- **발견(미해결)**: (a) `buffered.end`는 +15초 진행 후 더 이상 전진하지 않았다. 라이브 에지가 6분간 계속 전진했음에도 일시정지 중 추가 로딩이 멈췄는데, hls.js가 일시정지 중 라이브 에지 추적 로딩을 하지 않는 동작으로 보인다. QA-CHECKLIST 25절의 "`buffered.end` 계속 전진" 기대는 관찰 첫 15초만 충족됐다. (b) 재생 재개 시 멈춘 지점이 아니라 라이브 에지(410초)로 이동했다. 일시정지 지점 버퍼는 남아 있었으므로 확장이 재개 시점에 seek 보정을 하면 멈춘 지점 재개가 가능할 수 있으나, 이는 1.1.15의 계약(README: 재개 시 앞쪽 버퍼 목표만 복원)에 없는 동작이라 이번 세션에서 구현하지 않았다. 사용자 판단이 필요하다.
- 이 테스트의 PAUSE-RESUME 시나리오는 위 발견 때문에 FAIL로 남겨뒀다. 테스트 조건을 약화해 PASS로 바꾸지 않았다.

### 성능 측정 (qa/performance-results.json + perf-off/on.json)

동일 방송(에게리 같이보기, 480p)에서 10분씩 연속 실행, 확장 OFF → ON. CPU/메모리는 QA 세션 Firefox 프로세스만 집계(사용자 브라우저 PID 차집합).

| 지표 | OFF | ON | delta |
|---|---|---|---|
| paused 샘플 (600초/600샘플) | 0 | 0 | 0 |
| currentTime 진행 | 610.2s | 625.5s | +15.3s |
| dropped frames | 0 | 0 | 0 |
| 프레임 간격 p50/p95/p99 (ms) | 6.06/6.06/6.08 | 6.06/6.06/6.08 | 동일 |
| hitch 윈도(>50ms 프레임) | 0/3 | 0/3 | 0 |
| QA Firefox CPU (평균, 1코어 기준) | 29.3% | 37.0% | +7.7%p |
| QA Firefox 메모리 증가 | +38MB | +141MB | +103MB |
| api.chzzk.naver.com 응답 | 64회 | 94회 | +30회 |
| 확장 DOM 중복 id | 0 | 0 | 0 |

- CPU 증가(+7.7%p)는 10분 세 구간에서 20.94→21.12→20.71 s/min으로 평탄하다 — 상승 추세(누수형)가 아닌 일정 오버헤드다. 메모리는 +34MB/10분의 완만한 추가 증가가 있어 30분 이상 soak에서의 추이 확인이 남아 있다.
- +30회/10분의 API 증가는 통나무 30초 폴링(20회)+트렌드 갱신 1분(10회) 주기와 정확히 일치한다. 폴링 폭주 없음.
- stall 이벤트 수(18/2)는 측정 창 경계의 인위적 gap이 포함된 수치라 절대 비교용이 아니다(진행률이 걸린 실정체는 0).
- 첫 시도(EEO 방송 종료, 화질 불일치)는 무효라 `perf-*-run1.json`으로 보존만 했고 비교에서 제외했다.

### 이 세션에서 검증하지 못한 것

- 실제 광고(pre/mid-roll)·광고 차단 경고 모달이 실제로 뜨는 방송, GRID 사용 방송, 제한 중계(스포츠)의 실환경 검증 — 재현 가능한 방송이 없었다. fixture 기반 회귀 테스트(단위 63/63, 회귀 18/18, 오디오 15/15, UI 17/17)가 유일한 근거다.
- REC/RAW 녹화·결과 창·변환의 실제 파일 출력, 음소거 REC 오디오(REC-06A), 팔로잉 알림/로그인 필요 기능, 통나무 실제 획득.
- 30분 이상 soak, 다중 탭, TM 패널을 연 상태의 장시간 버퍼 유지.
- 블랙박스 사람 관점 UI 테스트는 WebDriver가 코드를 읽지 않고 실제 클릭/키 입력으로 수행한 위 E2E가 대체하며, 로그인 필요 흐름은 제외다.

## 2026-09-29 바탕화면 QA 통합·TM 실제 회귀 수정·ZIP 빌드 검증, 1.1.16

### 작업 상태와 통합 범위

- 두 경로의 실제 확장 저장소는 각각 내부 `chzzk-all-in-one`이다. 두 저장소 모두 `main`, HEAD `dacc340`, 같은 origin URL이며 소스 버전은 시작 시 1.1.15였다. 바깥 폴더의 Git은 커밋이 없는 별도 래퍼 저장소다. 해당 래퍼는 변경하지 않았다.
- 추적 파일 해시 비교에서 두 복사본의 차이는 `HANDOFF.md`뿐이었다. 바탕화면 추가 내용은 2026-09-28 실환경 QA 도구/측정 JSON/세션 시작 patch와 문서였다. 문서의 추가 기록과 QA 파일 20개를 기준 저장소로 통합했다. 기존 1.1.12~1.1.15 미커밋 기능 코드와 사용자 변경은 보존했다. 최종 실행 JS/CSS/HTML을 바탕화면과 재대조한 결과 이번 작업에서 달라진 실행 파일은 `timeshift.js`뿐이다.
- 바탕화면 파일은 수정·삭제하지 않았다. Git commit/push/태그/릴리스/외부 업로드/서명은 수행하지 않았다. 생산 코드와 빌드는 바탕화면 경로에 의존하지 않는다. E2E 실행 때만 이미 설치되어 있던 바탕화면 Selenium/Geckodriver를 일회성 NODE_PATH로 참조했다. 추가 프로그램/패키지 설치는 하지 않았다.

### 실제 원인 및 수정

1. **일시정지 버퍼가 약 15초 후 멈춤**: 실제 Firefox에서 HLS 1.6.13-alpha.15의 `maxBufferLength=3600`인데 `maxMaxBufferLength=15`가 되는 것을 확인했다. 현재 CHZZK 배포 `player-vendor-BYg0wCyN.js`의 `_updateHlsConfig`/`applyStreamingProfile` 호출 스택에서 사이트 profile이 상한을 15초로 덮었다. 기존 코드는 모든 외부 하향을 메모리 압박으로 간주해 이 덮어쓰기도 유지했다.
2. `findHls`가 찾은 `_mediaController`를 WeakMap에 기록하고, TM 활성 상태에서 그 인스턴스의 `_updateHlsConfig`에만 호환 처리를 적용했다. 사이트가 요청한 설정은 기존 함수와 userConfig에 정상 전달하면서 TM이 관리 중인 네 버퍼 값을 유지하고, 해제할 원래 값에는 최신 사이트 요청을 기록한다. HLS 자체의 메모리 오류 회복용 하향은 이 사이트 함수를 통하지 않으므로 그대로 존중한다. LIVE·패널 닫기·플레이어 교체·연결 실패 시 함수와 설정을 복원한다. 추가 네트워크 후킹, polling, 별도 플레이어는 없다.
3. **재개 시 강제로 라이브 끝 이동**: 같은 실제 bundle의 `_attachPlayer`가 pause 다음 play에서 `live.timeMachine === false`인 일반 라이브를 사이트 `seekable.end`로 이동시키는 것을 호출 스택과 원문으로 확인했다. 기존 `synchronizeToLiveEdge` 패치만으로는 이 별도 경로가 차단되지 않았다. play 이벤트 처리 동안에만 본방송 video의 currentTime 접근자를 임시 연결해, 저장된 위치가 아직 버퍼에 있고 사이트가 바로 라이브 끝으로 이동시키는 첫 할당만 제한한다. 다음 task에서 원래 접근자를 복원한다. 사이트 seekable은 native video.seekable에서 지연 보정된 값이므로 `_mediaController.seekable`을 기준으로 한다. 일반 위치 탐색·명시적인 확장 LIVE·버퍼 소실 시 기본 회복은 유지한다. API timeMachine 자격/플래그를 위조하지 않았다.
4. **바탕화면 1.1.15 ZIP/XPI 설치 실패**: 두 파일 모두 257바이트 위치에서 `ustar` 서명을 확인했다. `.zip/.xpi` 이름의 실제 TAR이며 .NET ZIP reader가 central directory 없음으로 거부했다. 이전 문서의 Firefox 156 archivePath 자체 제한이라는 설명은 철회한다. `build.ps1`은 `--format=zip`을 명시하고 tar 종료 코드, ZIP reader 열기, 40개 항목의 이름/개수 및 내부 manifest 버전을 검증한 뒤 XPI를 복사한다. 잘못된 기존 파일을 덮거나 삭제하지 않았다.

### 자동 검증과 실제 Firefox 검증을 구분

- `npm run test:all`: 단위 **66/66**, 기본 회귀 **18/18**, 오디오 **15/15**, UI **17/17** 통과. 사이트 profile 재적용, userConfig/원래 설정 복원, HLS 자체 하향 유지, 지연 보정된 seekable 재개, 접근자 해제, 버퍼 소실/플레이어 교체/LIVE 회귀를 추가했다. 이는 가짜 DOM/API 기반 검사이며 실제 소리 확인이 아니다.
- 루트 JavaScript 전부, 수정 단위/E2E 테스트의 문법 검사 및 PowerShell build.ps1 구문 분석 통과. `git diff --check` 통과. 추적 파일 삭제 없음. 기존 PIP 주석 처리, RAW/REC, 광고, GRID, 화질, 변환, 통나무, 설정, 라이선스/아이콘은 이번 수정에서 변경하지 않았다.
- **실제 Firefox 156.0.1, headless 임시 프로필, CHZZK 일반 라이브 1080p**: 수정 후보 1분 검사에서 currentTime 36.165816초가 유지되고 buffered.end가 50→110.010687초로 전진했다. 재개 2.5초 뒤 currentTime 38.525607초로 멈춘 위치에서 진행했다. 이 결과는 버전 번호 변경 직전 `qa/firefox-e2e-pause-results-1.1.15.json`이며 구버전 원본의 결과가 아니다.
- **최종 소스 6분 검사** `qa/firefox-e2e-pause-results-1.1.16.json`: currentTime 36.892606초가 유지됐고 재개 후 39.096793초에서 정상 진행했다. 그러나 buffered.end는 52.005333→183.994645초까지만 늘고 멈췄으므로 지속 수집 항목은 **FAIL**이다. 이 실패를 숨기거나 테스트 조건을 완화하지 않았다. 15초 덮어쓰기와 재개 점프는 해결됐지만 6분 전체 버퍼 수집은 아직 충족하지 못한다.
- 기존 E2E의 `last.be > pausePoint.be + 5`는 첫 15초만 증가해도 6분 내내 수집했다고 판정했다. 시작 직후 한 번의 증가만으로 통과하지 않도록 첫 샘플 이후 경과 시간 대비 실제 전진량과 모든 샘플의 고정 위치를 확인하도록 수정했다. 실패는 종료 코드 1이다. 이전 바탕화면 결과는 역사 자료로 남긴다.

### 빌드와 재현 자료

- manifest/package/package-lock 루트 및 packages[""]/ZIP 내부 manifest 모두 **1.1.16**. 정상 이전 1.1.14와 비교해 40개 패키지 항목 모두 유지했고, 압축 안의 모든 파일 해시가 소스와 일치함을 확인했다. ZIP/XPI는 동일 바이트이며 마지막 명시적 ZIP 빌드의 SHA-256은 `8A3BC3C9CCCC509AEEC3763F81666AEAB18176F425409EABEFB5CB08C4B2CC17`이다.
- 결과물: `dist/chzzk-all-in-one-firefox-v1.1.16.zip`, `dist/chzzk-all-in-one-firefox-v1.1.16.xpi`. 미서명이다. AMO 승인/영구 설치 가능 여부와 분리한다.
- 참고한 배포 코드: https://ssl.pstatic.net/static/nng/glive/resource/p/static/js/player-vendor-BYg0wCyN.js (2026-09-29 실제 요청/호출 스택에서 확인). HLS 공식 구현: https://github.com/video-dev/hls.js/blob/v1.6.13/src/controller/base-stream-controller.ts . 사이트 bundle 내부 API는 향후 변경될 수 있으므로 현재 계약을 찾지 못하면 기존 HLS 동작을 유지한다.
- 아직 실제 확인하지 않은 범위: 로그인 계정 통나무 획득/로그, 음소거 REC 파일의 실제 오디오, RAW 및 변환 결과, 광고 전후/스포츠 제한 중계, 공식 서버 타임머신, 사이트 자체 LIVE 버튼/수동 화질 변경과 재개 보호의 조합, 30분 이상 버퍼/메모리와 다중 탭. 이 목록을 정상이라고 선언하지 않는다.

### 추가 실측: 장시간 제한 확정 및 XPI 설치

- 같은 일반 라이브의 3분 재검증에서 **`bufferFullError` / `QuotaExceededError` 5회**를 기록했다. HLS `maxMaxBufferLength`가 3600→145.844554초로 낮아지고 buffered.end는 182.266666초에서 정체됐다. 현재 재생 위치 34.422112초는 유지됐고 재개 시 36.752382초로 진행했다. 로딩/버퍼링 상태는 true였으며 HLS는 IDLE이었다. 이 중단은 Firefox MSE 버퍼 용량 한도에 도달한 결과다. 확장이 quota 회복 하향을 되돌리지 않음을 실제로 확인했다.
- `qa/firefox-e2e-pause-results-1.1.16-quota.json`에 토큰/미디어 URL 없이 상태와 오류명을 저장했다. 이 시험은 전체 평균 전진량 기준으로 PAUSE-BUFFER를 PASS 출력했지만, 마지막 45초 정체/Quota 오류가 있어 지속 수집 충족이 아니다. 원시 결과는 보존하고 `assessment`에 실패 판정을 추가했다. 재발 방지를 위해 E2E에 마지막 4샘플 전진량·bufferFullError 실패 조건을 추가하고 모든 샘플을 저장한다. 기존 6분 실패 기록도 보존한다. 같은 브라우저 시험을 다시 반복하지 않고 저장된 자료로 판정 보강을 검증했다.
- 같은 임시 Firefox 156.0.1에서 기존 언팩 확장을 제거한 뒤 **1.1.16 XPI를 BiDi archivePath로 설치 성공**, 확장 ID `chzzk-all-in-one@hanbi` 확인. `qa/firefox-xpi-install-1.1.16.json` 기록. 이는 **임시 설치**이며 Mozilla 서명/영구 설치 승인이 아니다.
- **남은 최우선 과제**: 무제한에 가까운 일시정지 수집은 미완료다. 현재 구현은 Firefox MSE 메모리에만 저장하고, 이 1080p 시험에서는 대략 2분대 한도에 도달했다. 방송 비트레이트·브라우저 환경에 따라 한도는 달라진다. 한도를 억지로 재상향하거나 버퍼링 실패를 성공으로 표시하지 않았다. 더 긴 보존은 별도 로컬 디스크 조각 저장/재생 설계 등 MSE 밖 저장 경로를 검토해야 한다. 그 작업은 기존 REC/RAW 및 타임머신 조작을 보존하면서 별도로 구현·검증해야 하며 이번 통합판에 완료됐다고 주장하지 않는다.
- 마무리 중 자동 승인 검토가 크레딧 부족으로 중단되어 마지막 QA/문서 보강이 적용되지 않았었다. 사용자의 재개 요청 후 파일 상태를 확인하고 보강을 반영했다. 이 재개 단계에서는 배포 코드 변경이나 실방송 재시험 없이 기존 실측 자료의 판정과 최종 파일 상태를 확인했다.

## 2026-09-29 통나무 점검 및 불필요한 지급/조회 반복 수정, 1.1.17

- 사용자 요청: 버퍼 외 개선점, 특히 통나무가 실제로 잘 동작하는지 점검. 기준 저장소 main/HEAD dacc340 및 기존 미커밋 변경을 보존했다. content.js의 보유량 조회·DOM 자동 받기·PUT 지급·잔액 증가 보완 로그와 log-store.js, 해당 QA만 조사했다. 로그인 계정의 실제 획득은 실행하지 않았다.
- **코드로 확인한 원인**: `fetchAndUpdatePowerAmount`는 claims가 하나라도 있으면 지급 결과와 무관하게 1초 후 자신을 다시 호출했다. 자동 획득 OFF, WATCH_1_HOUR처럼 PUT에서 건너뛰는 항목만 있음, HTTP/서버 오류일 때도 claims가 남아 있으면 이 재조회가 계속됐다. `claimPower`는 지급 성공 여부를 반환하지 않았고, pendingClaims는 요청 중에만 중복을 막아서 성공한 보상이 서버 목록에 잠시 남으면 같은 PUT을 다시 보낼 수 있었다.
- **최소 수정**: claimPower는 명시적으로 성공/실패를 반환한다. HTTP 및 응답 code=200을 확인한 지급만 true다. 최근 성공한 채널/보상 ID를 탭 메모리의 최대 200개 Set으로 보존해 중복 지급 요청을 막는다. 실패는 성공 집합에 들어가지 않아 기존 정기 조회에서 재시도할 수 있다. 기존 WATCH_1_HOUR DOM 자동 받기 경로는 유지한다.
- 활성/비활성 채널 모두 성공한 지급이 있을 때만 기존 1초 잔액 새로고침을 예약한다. 예약 후 다른 채널로 이동하면 이전 콜백을 무시한다. 기존 30초 상태/보유량 조회, 1초 DOM 버튼 감지, 자동 획득 설정, 비활성→재활성 감지, 배지와 로그 UI는 유지한다. 팔로우 감지의 후속 지급 조회도 실제 지급 성공 때만 진행하도록 했다. 새 polling/observer/timer는 추가하지 않았다.
- **검증**: 수정 전 새 QA 두 항목이 실패하고 기존 18항목은 통과함을 재현했다. 수정 후 `npm run test:all`: 단위 66/66, 기본 회귀 20/20, 오디오 15/15, UI 17/17 통과. 자동 획득 OFF/시간 보상 제외/HTTP 실패, 성공 ID 재요청 억제, 활성 및 비활성 채널 재조회, 채널 이동 콜백을 확인했다. content.js/qa/regression.cjs 문법과 git diff --check 통과. 추적 파일 삭제 없음. 자동 테스트는 모의 서버/DOM 검사이며 실제 CHZZK 지급 검증과 구분한다.
- **빌드**: manifest/package/package-lock 두 위치/ZIP 내부 manifest를 모두 1.1.17로 맞췄다. `dist/chzzk-all-in-one-firefox-v1.1.17.zip` 및 미서명 XPI 생성. 1.1.16의 40개 패키지 항목 유지, 모든 압축 파일과 현재 소스 해시 일치, ZIP/XPI 동일 바이트 확인. 이번 판의 실제 Firefox 설치와 로그인 계정 지급은 확인하지 않았다. 1.1.16의 설치 성공을 1.1.17 실험 결과로 대신 표기하지 않는다.
- **남은 통나무 문제/우선순위**: (1) DOM 시청 보상은 클릭 직후 구독 등급에서 추정한 100/120/200을 view 로그로 남긴다. 클릭과 실제 지급 성공은 다르므로 성공하지 않은 획득 로그·다음 시간 표시가 생길 수 있다. (2) recordPowerBalance는 저장 성공 전에 기준 잔액을 갱신하므로 저장 실패 후 같은 잔액을 다시 읽으면 누락 로그가 재시도되지 않는다. (3) 여러 탭의 같은 잔액 증가 보완(OTHERS)은 claim ID가 없어서 중복 가능성이 있다. 이 세 경로는 이번 PUT/조회 반복 수정으로 해결됐다고 주장하지 않는다. 실제 서버 지급 신호와 로그를 결합하는 작업을 다음 우선순위로 둔다. 보유량 표시와 자동 받기 기능을 삭제하거나 로그를 임의로 축소하지 않았다.
- 실제 사용자 확인은 자동 받기 ON에서 보상 지급 뒤 보유량 증가와 로그가 일치하는지, OFF에서는 클릭/PUT이 없는지다. 이 작업에서 방송 접속·외부 검색·사용자 계정 조작·push·서명·업로드는 하지 않았다. 상세 버퍼 제한 및 다른 기능의 미확인 사항은 직전 1.1.16 기록을 유지한다.
