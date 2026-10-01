# PROJ_R

이름 없는 초보 모험가 한 명으로 시작해 동료를 영입하고, 최고의 용병단으로 성장하는
로그라이크 오토배틀 RPG입니다. (개발 중 — 1차 마일스톤: 수직 슬라이스)

- 플레이: https://jinha1226.github.io/PROJ_R/
- 설계서: [docs/superpowers/specs](docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md)
- 구현 계획: [docs/superpowers/plans](docs/superpowers/plans/)

## 지금 플레이할 수 있는 것: 전투 샌드박스

아군 프리셋(혼자인 견습 / 기본 5인 / 원소 연계)과 적 프리셋(해골 졸개 / 산적단 / 해골 부대 / 보스)을 고르고
시드를 정해 자동 전투를 관전합니다. 같은 시드는 항상 같은 전투를 재현합니다.

- `Space` 일시정지 · `1` `2` `3` 속도 1x/2x/4x · `후퇴` 버튼
- 상단 이름표나 캐릭터를 클릭하면 현재 의도와 그 이유(전술·상황)를 보여줍니다.
- 전투 기록의 `연계·구출만`으로 중요한 순간만 볼 수 있습니다.

## 개발

Node.js 22 이상.

```sh
npm ci
npm run dev        # 개발 서버
npm test           # 단위·시뮬레이션 테스트 (Vitest)
npm run lint       # ESLint + 파일 길이(300줄) 검사
npm run typecheck  # TypeScript 검사
npm run build      # dist/ 정적 빌드
npm run e2e        # Playwright 브라우저 테스트 (빌드 후)
npm run assets     # KayKit 원본에서 public/assets 재생성
```

`main`에 푸시하면 GitHub Actions가 검사를 모두 통과한 빌드를 GitHub Pages에 배포합니다.
