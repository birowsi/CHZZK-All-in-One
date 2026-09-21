# CHZZK All-in-One by hanbi

Firefox 우선으로 만든 비공식 CHZZK 통합 확장 프로그램입니다.

## 주요 기능

- GRID/P2P 우회, 1080p 최고 화질 선택
- SSAI 광고 및 광고 차단 경고 팝업 제거
- 녹화 중 청취, 녹화 결과 미리보기, WebM 원본 및 MP4/GIF/WebP 변환·자르기·분할
- 스크린샷 미리보기·저장, 네이티브 PIP
- 통나무 파워 자동 획득·보유량·로그·승부예측 기록
- 확인 가능한 블라인드 채팅 원문 표시
- 실시간 트렌드와 썸네일 미리보기
- 팔로잉 사이드바의 방송 시작을 감지하는 페이지 내 팝업
- 방향키 탐색, 오디오 컴프레서, 밝기·대비·선명도, 채팅·사이드바 보조 기능

## Firefox 설치

`dist/chzzk-all-in-one-firefox-v1.0.2.xpi`는 개발·검사용 패키지입니다. 일반 Firefox에 영구 설치하려면 Mozilla Add-ons 서명이 필요합니다. 서명 전에는 `about:debugging#/runtime/this-firefox`의 **임시 부가 기능 로드**에서 `manifest.json`을 선택해 테스트할 수 있습니다.

## 개발 및 검사

```powershell
npm test
.\build.ps1
```

전체 수동 점검 항목은 `QA-CHECKLIST.md`에 있습니다.

## 출처와 라이선스

통합·수정판 저자는 `hanbi`입니다. `NOTICE`에는 배포물에 실제로 포함된 제3자 코드와 바이너리의 필수 고지만 기록했습니다. GPL-3.0 코드가 포함된 결합 저작물이므로 전체 배포물은 **GPL-3.0-or-later**로 배포합니다.

NAVER 또는 CHZZK의 공식 프로그램이 아닙니다.
