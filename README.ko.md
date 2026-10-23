# PokéSurvivor 한국어 독립판

비공식·비상업 파생판입니다. 원작과 계정·데이터·배포를 공유하지 않습니다.
원작: [JPTER78/pokesurvivor](https://github.com/JPTER78/pokesurvivor).
기준 커밋: `6f0f4409f68adcc5bc31a77cafaf8ba9a0318397`.
원작 공식 사이트: https://pokesurvivor.com.

Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)

## 현재 구현

- 원본 Git 이력을 보존한 별도 저장소. 기존 `GuenohPark/pokesurvivor`는 변경하지 않습니다.
- 한국어 기본 언어, 한글 폰트 대체, 게임 내 포켓몬 966종 한국어 명칭, 주요 UI 및 기술·도구 번역.
- `kor/selfhost-db.js`가 독립 Node.js/PostgreSQL 백엔드의 로그인·회원가입·저장·삭제 API에 연결합니다.
- 비밀번호 12~128자, 이름 3~16자(한글 포함), 7일 HttpOnly 세션 쿠키.
- 저장 시 수정 번호를 검사하며 다른 기기의 변경을 덮어쓰지 않습니다. 저장 충돌 시 설정에서 브라우저 백업을 내보낸 뒤 서버 저장을 다시 불러옵니다.
- 원본 Firebase 설정 제거, 원본 서비스용 개인정보 안내 교체, API 응답의 PWA 캐시 저장 제외.
- 매일 한국 시간 05:17 upstream 확인 → 병합 브랜치·PR 생성 → CI. 충돌은 이슈로 남기며 수동 해결합니다.
- 배포는 수동 실행과 `production` 환경 승인 후 가능합니다. 아직 서버가 없어 `DEPLOY_ENABLED=false`로 잠가 둡니다.

## 미완료

- 전체 한국어화는 완료되지 않았습니다. `kor/translation-coverage.json`에 영어 사전 대비 미번역 목록이 있습니다. 이 집계는 `lang-en.js` 일반 문구만 대상으로 하며, 게임 데이터·문맥별 번역 전체를 뜻하지 않습니다.
- 친구·협동·랭킹은 Firebase API에 의존하므로 비활성화했습니다. 독립 서버용 구현이 필요합니다.
- Google 로그인, 비밀번호 복구, 원본 계정·저장 데이터 자동 이전은 지원하지 않습니다.
- 현재 저장 데이터는 클라이언트가 제출합니다. 서버가 전투나 재화를 검증하는 구조가 아니므로 경쟁 랭킹 구현 전 별도 검증이 필요합니다.
- 운영 서버, 도메인, TLS, 백업 보존 기간과 운영자 안내는 실제 배포 전에 확정해야 합니다.
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

스프라이트는 **CC BY-NC 4.0**으로 작가 표시와 비상업 조건을 지켜야 합니다. `CREDITS.md`를 보존합니다. Pixelify Sans는 **OFL 1.1**이며 폰트 라이선스를 함께 제공합니다. 한국어 명칭의 출처와 다운로드 파일 해시는 `kor/NAME-SOURCES.json`에 기록했습니다.

Pokémon 상표·캐릭터의 권리는 Nintendo, Creatures Inc., GAME FREAK, The Pokémon Company 등 각 권리자에게 있습니다. 코드·스프라이트 라이선스는 상표·캐릭터 사용에 대한 별도 승인을 뜻하지 않습니다. 수익화나 별도 권리 허락이 필요한 사용은 권리자 확인이 필요합니다.
