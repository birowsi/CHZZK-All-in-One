# Chrome PIP·녹화·오디오 검사 (1.1.23)

CHZZK에 접속할 수 없는 환경에서 Chrome 빌드를 실제 Chromium에 설치해 확인하는 보조 검사다. 실제 방송 검증이 아니다.

1. `python3 build_chrome.py <출력폴더>`: build.ps1과 같은 파일 목록·manifest 변환으로 압축 해제 Chrome 빌드 생성
2. 같은 폴더에 `test.webm`(1280x720 testsrc2 + 440Hz)과 `audio.webm`(1초마다 0.01/0.9 배 음량 전환) 준비 (ffmpeg 명령은 HANDOFF 1.1.23 절)
3. `xvfb-run -a python3 pip_test.py <빌드폴더>`: REC → PIP → 더 큰 영상 등장 → SPA 이동 → 탭 전환 → STOP → 결과 창 길이 확인
4. `probe.js`를 tools.js 앞에 붙인 임시 빌드로 `audio_test.py`: COMP ON/OFF/게인2 출력 레벨, 음소거 녹화의 원본 소리 확인

필요: Python Playwright, Chromium, Xvfb, ffmpeg. 결과는 `../chrome-pip-audio-1.1.23.json`.
