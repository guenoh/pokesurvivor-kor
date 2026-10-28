# 원작 업데이트 운영

원작은 `JPTER78/pokesurvivor`의 `main`을 추적하며 현재 기준은 `5c97df2e764a11f7a99b46c2104413a073f117ad`입니다. 한국판 추가 게임 콘텐츠와 자체 평가·화면 개편은 제거했습니다.

## 남기는 차이

- 한국어 사전·자연스러운 조사·갈무리 폰트와 언어 선택.
- 한국어 서버의 메타데이터·권리/개인정보 안내·크레딧.
- 독립 계정·저장·친구·협동 통신·랭킹 연결.
- 작은 가입 안내, 공지·보상·후원·로그아웃·저장 복구 운영 모듈.
- 삭제된 콘텐츠의 저장 호환 처리. 새 콘텐츠는 등록하지 않습니다.

원작 96개 소스 중 직접 수정은 7개입니다. `dev.html`, `js/boot.js`, `js/core/db.js`, `js/core/firebase-config.js`, `js/core/i18n.js`, `js/core/locales.js`, `js/systems/mons.js`이며 이유와 검토 해시는 `upstream-boundary.json`에 있습니다. 나머지 89개 소스는 기준 원작과 바이트 단위로 같습니다. 원작 CSS와 모든 게임 UI 소스도 포함됩니다.

독립 서비스의 실행 연결은 `service-adapter.cjs`가 별도로 관리합니다. 원작 `coop.js`, `social-ui.js`, `ranking-ui.js` 소스는 수정하지 않고 빌드 시 서비스 규약만 연결합니다. 소스 보존이 호환성 검토를 없앤다는 뜻은 아닙니다. 전투·탄환·스폰·기술·보스에 연결 코드를 넣는 기존 콘텐츠 어댑터는 제거했습니다.

`node kor/upstream-boundary.cjs`, `node kor/module-source.cjs`, 전체 테스트, 빌드, `node kor/coverage.cjs`로 검사합니다. 원작 기준 갱신은 `node kor/upstream-boundary.cjs --refresh-baseline <commit>`입니다. 직접 수정 파일의 검토 해시는 자동 승인하지 않습니다.

## 동기화·배포

Daily upstream sync는 매일 20:17 UTC, 다음 날 한국 시간 05:17에 실행합니다. 변경이 없으면 종료하고 변경이 있으면 병합 PR과 CI를 준비합니다. 생성물만 자동 해결하고 소스 충돌은 이슈로 남깁니다. Git 자동 병합만으로 서비스 호환을 보장하지 않으므로 관련 테스트와 검토가 필요합니다.

PR 병합으로 공개 서버가 자동 배포되지는 않습니다. 서버 저장소의 `client-release.json`에 검증한 클라이언트 커밋을 고정하고, 실제 PostgreSQL·고정 클라이언트·컨테이너 CI와 암호화 백업 후 수동 승인 배포합니다. 원작 Firebase·TURN·랭킹 인프라를 한국판 계정에 연결하지 않습니다.

계정·재화·천장·아이템·친구·생존 기록과 기존 선물 장부를 유지합니다. 아머드뮤츠 이벤트 종료 보상은 서버에 저장된 영구 강화 투자 비용의 5배이며 계정당 한 번입니다. 종료 정리는 별도 SQL 스키마 변경 없이 기존 저장과 지급 장부를 사용하며, 이전 데이터는 백업 및 `retiredKor`에서 복구할 수 있습니다. 자세한 내용은 [CONTENT.md](CONTENT.md)를 참고하세요.
