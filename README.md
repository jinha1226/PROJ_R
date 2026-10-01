# PROJ_R

이름 없는 초보 모험가 한 명으로 시작해 동료를 영입하고, 최고의 용병단으로 성장하는
로그라이크 오토배틀 RPG입니다. (개발 중 — 1차 마일스톤: 수직 슬라이스)

- 플레이: https://jinha1226.github.io/PROJ_R/
- 설계서: [docs/superpowers/specs](docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md)
- 구현 계획: [docs/superpowers/plans](docs/superpowers/plans/)

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
