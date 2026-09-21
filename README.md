# Dubipoly

한국·페루 여행 테마의 2인용 모바일 웹 보드게임. 같은 기기에서 번갈아 플레이하거나, 서로 다른 기기에서 방을 만들어 함께 플레이할 수 있다. UI는 영어(최초 기본값)·한국어·스페인어를 지원한다.

- **배포 대상:** https://dubipoly.ostrichick.workers.dev
- **현재 검증 범위:** 로컬 자동 테스트 및 빌드 통과. 해당 URL에 최신 커밋이 정상 배포됐는지, 실제 운영 D1과 안드로이드 2대에서 정상 동작하는지는 별도로 확인해야 한다. 현황은 [`PROGRESS.md`](PROGRESS.md) 참고.

## 로컬 실행

Node.js **22.13 이상**이 필요하다.

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

출력된 로컬 주소로 접속한다. 같은 Wi-Fi의 휴대전화에서는 PC의 사설 IPv4 주소와 동일한 포트를 사용하며, 필요하면 Windows 개인 네트워크 방화벽을 허용한다. 로컬 PC를 종료하면 로컬 서버도 종료된다. 방 없이 시작한 게임은 해당 브라우저의 로컬 저장소를 사용하고, 온라인 방은 서버를 통해 동기화한다.

## 검사

```bash
npm test
npx tsc --noEmit
npm run lint
git diff --check
```

`npm run build`는 프로덕션 빌드이므로 실제 `CLOUDFLARE_D1_DATABASE_ID`가 설정되어야 통과한다. **임시 UUID로 만든 빌드는 절대 배포하지 않는다.**

## 두 기기에서 플레이

첫 기기에서 방을 만든 뒤 10자리 코드 또는 공유 링크를 다른 기기에 보낸다. 두 번째 플레이어가 참가하면 방장이 시작한다. 기존 2자리 코드는 해당 방이 만료될 때까지만 호환된다. 방은 **마지막 활동으로부터 6시간** 동안 비활성일 때 만료된다. 각 기기의 참가 토큰은 해당 브라우저에 저장되므로 같은 기기·브라우저에서 새로고침하면 기존 자리로 복귀할 수 있다. 서버 연결이 끊기면 입력이 제한되며, 상태가 오래됐다는 안내가 나오면 `상태 새로고침`으로 동기화한다.

현재 규칙은 **40라운드**, 플레이어당 시작 자금 1,500 Dubi이며, 구매·건설·통행료·더블·공항·항구·이벤트 규칙의 상세 내용은 [`SPEC.md`](SPEC.md)에 있다. 모바일에서는 턴에 맞는 버튼이 화면 하단에 표시된다.

## GitHub / Cloudflare 배포 전 확인

`main`에 푸시하면 [배포 워크플로](.github/workflows/deploy.yml)가 린트·테스트·빌드 후 Cloudflare Workers 배포를 시도한다. 푸시 **전에** 아래를 확인한다.

1. GitHub Actions의 `CLOUDFLARE_D1_DATABASE_ID`가 **실제 운영 D1 UUID**인지 확인한다. `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`도 워크플로에 필요하다. 값·토큰을 문서나 로그에 기록하지 않는다.
2. 운영 DB에 [`drizzle/0000_create_rooms.sql`](drizzle/0000_create_rooms.sql), [`drizzle/0001_room_presence.sql`](drizzle/0001_room_presence.sql)의 테이블이 적용됐는지 확인한다. **워크플로는 마이그레이션을 자동 실행하지 않는다.**
3. 빌드 결과 `dist/server/wrangler.json`에 실제 D1의 `DB` 바인딩이 있는지 확인한다. 시험용 UUID 빌드를 재사용하지 않는다.
4. 배포 완료 여부를 GitHub Actions에서 확인한 뒤, 운영 환경에서 방 생성·상태 복원과 안드로이드 기기 2대의 동시 플레이·재접속·재대전을 검증한다.

## 문서 안내 — 내용의 정본

| 문서 | 역할 |
| --- | --- |
| [`SPEC.md`](SPEC.md) | 현재 제품 요구사항, 게임 규칙, 저장·멀티플레이 계약 |
| [`COLLABORATION.md`](COLLABORATION.md) | 소스 구조, 서버 동기화, 아키텍처와 협업 경계 |
| [`PLAN.md`](PLAN.md) | 다음 작업 및 미완료 수용 기준 |
| [`PROGRESS.md`](PROGRESS.md) | 최근 검증 상태와 압축된 변경 이력 |
| [`AGENTS.md`](AGENTS.md) | 코딩 AI용 공통 개발 지침; 도구별 지침 파일의 단일 원본 |

규칙과 배포 설정을 변경했다면 해당 정본 문서를 수정하고 다른 문서에는 링크만 남긴다. 두부 캐릭터 이미지는 현재 임시 아트이므로 룰 변경과 별도로 교체한다.
