# PokéSurvivor 한국어 독립판

비공식·비상업 파생판입니다. 원작과 계정·데이터·배포를 공유하지 않습니다.
원작 코드·음악: [Jonathan Piera Torregrosa (JPTER78)](https://github.com/JPTER78/pokesurvivor).
한글화·한국판 개발: **박근오** (guenoh).
기준 커밋: `6f0f4409f68adcc5bc31a77cafaf8ba9a0318397`.
원작 공식 사이트: https://pokesurvivor.com.

Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)

## 현재 구현

- 원본 Git 이력을 보존한 별도 저장소. 기존 `GuenohPark/pokesurvivor`는 변경하지 않습니다.
- 한국어 기본 언어, 한글 픽셀 폰트 갈무리, 게임 내 포켓몬 966종·특성·성격 한국어 명칭, 전체 영어 기준 UI 문구와 원작 업데이트 기록 번역.
- `kor/selfhost-db.js`가 독립 Node.js/PostgreSQL 백엔드의 로그인·회원가입·저장·삭제 API에 연결합니다.
- 비밀번호 4~128자, 이름 3~16자(문자·숫자·밑줄), 7일 HttpOnly 세션 쿠키. 한국어 독립판의 가입 화면에 규칙과 비밀번호 확인을 표시하며 불일치 시 요청을 보내지 않습니다.
- 한국판 업데이트 공지와 오픈 선물. 10회 뽑기권 100장·150,000코인을 서버에서 지급하고 기존 저장과 함께 기록합니다. 이미 받은 뽑기권은 재지급하지 않고 추가 코인만 받을 수 있습니다. 후원 링크는 독립 서버의 공지 설정에서 관리하며 후원 여부는 게임 혜택이나 선물 수령에 영향을 주지 않습니다.
- 저장 시 수정 번호를 검사하며 다른 기기의 변경을 덮어쓰지 않습니다. 저장 충돌 시 설정에서 브라우저 백업을 내보낸 뒤 서버 저장을 다시 불러옵니다.
- 원본 Firebase 설정 제거, 원본 서비스용 개인정보 안내 교체, API 응답의 PWA 캐시 저장 제외.
- 매일 한국 시간 05:17 upstream 확인 → 병합 브랜치·PR 생성 → CI. 충돌은 이슈로 남기며 수동 해결합니다.
- [Render + Neon 무료 시험 운영](https://pokesurvivor-kor.onrender.com/). 후속 배포는 서버 저장소의 `Manual Render deployment` 테스트와 `production` 환경 수동 승인을 거칩니다. 기존 SSH 배포는 `DEPLOY_ENABLED=false`로 유지합니다.

## 미완료

- 한국어 회귀 검사는 영어 기준 UI 1,563개, 포켓몬 966종, 성격·특성 이름, 원작 업데이트 기록을 대상으로 합니다. 새 upstream에서 추가되는 문구는 별도 번역이 필요하며, 미번역이 들어오면 테스트가 실패합니다.
- 친구·협동·랭킹은 Firebase API에 의존하므로 비활성화했습니다. 독립 서버용 구현이 필요합니다.
- Google 로그인, 비밀번호 복구, 원본 계정·저장 데이터 자동 이전은 지원하지 않습니다.
- 현재 저장 데이터는 클라이언트가 제출합니다. 서버가 전투나 재화를 검증하는 구조가 아니므로 경쟁 랭킹 구현 전 별도 검증이 필요합니다.
- 무료 시험 운영의 한도·매일 암호화 백업·복구 방법은 서버 저장소의 [Render + Neon 안내](https://github.com/guenoh/pokesurvivor-kor-server/blob/main/RENDER-NEON.md)를 따릅니다. 개인 도메인과 정식 운영 정책은 별도 확정이 필요합니다.
- 이전 대화의 `/mnt/data/pokesurvivor-selfhost-starter.zip`은 이 작업에서 실제 파일을 확보하지 못했습니다. 재사용했다고 가정하지 않았습니다.

## 개발

Node.js 24와 pnpm 11.25.0을 사용합니다.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node --test tests/*.test.cjs
node tools/build.js --sin-seo
node kor/coverage.cjs
node kor/package.cjs
```

`dev.html`이 원본이며 `index.html`은 생성물입니다. 원본 게임 코드는 가능한 그대로 두고 독립판 코드를 `kor/`에 둡니다. DB 모듈에 저장 데이터 초기화용 `openSelfhost` 연결점, 언어·빌드 모듈에 한국어 등록을 추가했습니다. 소수 원본 파일 변경도 upstream과 충돌할 수 있으므로 무충돌 자동 병합을 보장하지 않습니다.

정적 파일만 GitHub Pages에 올려도 독립 계정은 동작하지 않습니다. 프런트엔드와 `/api`를 같은 HTTPS 출처로 제공해야 합니다. 배포 구성은 서버 저장소 [운영 가이드](https://github.com/guenoh/pokesurvivor-kor-server/blob/main/DEPLOYMENT.md)를 따릅니다.

## 라이선스

현재 원본 코드와 음악은 **PolyForm Noncommercial 1.0.0**입니다. `LICENSE`, `LICENSE-NONCOMMERCIAL.md`, Required Notice를 보존해야 하며 게임 판매·유료 아이템·유료 플레이·광고 수익화를 허용한 것으로 해석하면 안 됩니다. `b297089`까지의 MIT 조건은 이후 커밋에 적용되지 않습니다.

스프라이트는 **CC BY-NC 4.0**으로 작가 표시와 비상업 조건을 지켜야 합니다. `CREDITS.md`를 보존합니다. Pixelify Sans와 한글 픽셀 폰트 Galmuri11은 **OFL 1.1**이며 각 폰트 라이선스를 함께 제공합니다. 한글화 기준과 폰트 출처는 `kor/LOCALIZATION.md`, `kor/FONT-SOURCES.json`에 기록했습니다. 한국어 명칭의 출처와 다운로드 파일 해시는 `kor/NAME-SOURCES.json`에 기록했습니다.

Pokémon 상표·캐릭터의 권리는 Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company 등 각 권리자에게 있습니다. 코드·스프라이트 라이선스는 상표·캐릭터 사용에 대한 별도 승인을 뜻하지 않습니다. 수익화나 별도 권리 허락이 필요한 사용은 권리자 확인이 필요합니다.

### 모바일 화면 크기

설정 → 그래픽 → 메뉴 크기에서 자동·80%·90%·100%·110%를 선택할 수 있습니다. 자동은 작은 화면에서 85%로 표시합니다. 선택은 기기별 브라우저에 저장되며, 게임 월드와 터치 조작 범위는 바뀌지 않습니다. 사파리 주소창이 차지하는 높이를 반영하고 화면 확대 제스처는 유지합니다. 슬롯 한글은 도트 캔버스와 분리해 화면 해상도로 표시합니다.
