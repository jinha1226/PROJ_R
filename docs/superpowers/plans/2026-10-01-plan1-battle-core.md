# Plan 1 — 전투 코어 + 관전 가능한 3D 전투 샌드박스

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결정론적 헤드리스 전투 시뮬레이션과, 그것을 three.js 쿼터뷰로 재생하는 "전투 샌드박스"를 GitHub Pages에 배포한다.

**Architecture:** `core → data → sim → app → view/ui` 단방향 의존. `sim`은 순수 TS(20틱/초 고정, 시드 RNG)로 스냅샷+이벤트를 내보내고, `view`는 이를 보간·연출만 한다. 유틸리티 AI의 고려 요소(consideration)와 능력치 보정(stat modifier)은 레지스트리로 만들어 Plan 2(성격·관계)가 끼워 넣을 수 있게 한다.

**Tech Stack:** Vite 8, TypeScript ~6.0.3, three 0.186, Vitest 5, ESLint 10 + typescript-eslint 8, Playwright 1.63, @gltf-transform 4.5(에셋 준비 스크립트 전용).

**Spec:** `docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md`

### 전체 로드맵 (Plan 1 이후)
| Plan | 내용 |
|---|---|
| 1 (이 문서) | 스캐폴드·CI, 전투 시뮬레이션 전체 규칙, 유틸리티 AI·전술, 6직업+견습 기본 키트, 적·보스, KayKit 에셋 파이프라인, 3D 재생·연출, 전투 샌드박스 UI, E2E |
| 2 | 성격 특성 12종, 감정 상태, 관계(친구/전우/라이벌/반목/사제), 전우 연계기, 관계 가시화 |
| 3 | 용병 생성, 레벨업 3택·스킬 풀 36종, 전술 카드 획득, 장비 30종·외형, 연대기·별명·부상·흉터·사망 |
| 4 | 런 구조(지도·노드·만남·사건·휴식·상점·보스), 전투 준비·용병단·관계도·결과 화면, 저장, 명예의 전당 |
| 5 | 연출 폴리시(슬로모션·사운드), 밸런스 튜닝, 전체 런 E2E |

## Global Constraints
- 파일당 300줄 이하 (`scripts/check-file-length.mjs`가 `src/ tests/ scripts/`를 검사).
- `src/core`, `src/data`, `src/sim`은 `three`, DOM API, `src/app|view|ui`를 import 금지. `src/core`는 다른 src 폴더 import 금지. `src/data`는 `src/sim` import 금지.
- `sim`의 모든 난수는 `core/rng`의 시드 RNG만 사용. `Math.random`, `Date.now` 금지(ESLint `no-restricted-properties`).
- 틱: 초당 20 (`DT = 0.05`). 결정 주기 5틱. 최대 90초 후 광폭화(+50%, 10초마다 +25%). 안전 상한 300초 → `defeat`.
- 피해 = atk × 배율 × 100/(100+def) × (치명 1.5) × 보정, 최소 1. 회피 상한 0.5.
- 기세: 준 피해/대상 maxHp × 40, 받은 피해/자신 maxHp × 60, 상한 100.
- 쓰러짐: 아군만. 생명선 = maxHp × 0.5. 구출 1m·2초(40틱)·HP 25%·유닛당 전투 1회. 적은 HP 0이면 즉사.
- 화면 문자열은 `src/ui/i18n/ko.ts`에만. 데이터 파일엔 id만, 이름은 ko.ts.
- Vite `base: '/PROJ_R/'`. Pages URL `https://jinha1226.github.io/PROJ_R/`.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **같은 시드 재실행 시 결과 불일치** — 객체 순회 순서, 배열 정렬 안정성, 부동소수 누적으로 결정론이 깨지는 경우. → Task 9 결정론 테스트가 이벤트 흐름 전체를 직렬화해 비교.
2. **유닛 0명 / 한쪽만 있는 전투 설정** — 샌드박스에서 빈 프리셋을 넣으면 즉시 종료되어야 함(무한 루프·예외 없음). → Task 4 테스트.
3. **목표가 행동 도중 죽거나 쓰러짐** — 선딜 중 목표 사망 시 행동 취소, 투사체는 소멸, 위험 범위는 그대로 발동. → Task 6·7 테스트.
4. **탭 비활성화 후 복귀 시 큰 dt** — 한 프레임에 수백 틱이 돌며 멈추는 현상. → Task 11 `battlePlayer`가 프레임당 최대 8틱으로 제한, 단위 테스트.
5. **WebGL 미지원/에셋 로드 실패** — 빈 화면 대신 오류 메시지 표시. → Task 12 E2E와 `loadAssets` 실패 처리 테스트.

---

## 파일 구조

```
.github/workflows/ci.yml              verify(lint·typecheck·test·build·e2e) + main이면 deploy
scripts/check-file-length.mjs         300줄 검사
scripts/prepare-assets.mjs            KayKit 원본 다운로드→애니메이션 분리·압축→public/assets
index.html, vite.config.ts, tsconfig.json, eslint.config.js, vitest.config.ts, playwright.config.ts
src/core/rng.ts                       mulberry32 시드 RNG
src/core/vec2.ts                      2D 벡터 함수
src/data/types.ts                     ClassDef, EnemyDef, SkillDef, Effect, TagId, Stats, AnimKey, GearVisual
src/data/tags.ts                      태그 정의(부정적 여부 등)
src/data/classes.ts                   7직업(견습 포함) 기본치·키트·모델·기본 장비 외형
src/data/enemies.ts                   적 9종 + 보스 페이즈
src/data/skills/{basic,warrior,berserker,rogue,crossbow,mage,priest,enemy,index}.ts
src/data/tactics.ts                   전술 10종 id
src/data/presets.ts                   샌드박스용 아군/적 프리셋
src/sim/battle/constants.ts           수치 상수
src/sim/battle/types.ts               UnitSetup, BattleSetup, UnitState, BattleState, BattleEvent, Snapshot, Intent
src/sim/battle/setup.ts               프리셋/데이터 → UnitSetup, 진형 → 좌표, 초기 상태 생성
src/sim/battle/stats.ts               실효 능력치 + statModifier 레지스트리
src/sim/battle/events.ts              이벤트 emit 헬퍼
src/sim/battle/snapshot.ts            스냅샷 생성
src/sim/battle/movement.ts            조향·분리·장애물·경계·강제이동
src/sim/battle/engagement.ts          교전·기회 공격
src/sim/battle/damage.ts              피해 공식·회피·치명·기세·쓰러짐/사망 처리
src/sim/battle/actions.ts             행동 3단계 진행·쿨타임
src/sim/battle/effects.ts             효과 실행기 + 반응(reacts)
src/sim/battle/tags.ts                태그 부여·지속·틱 피해
src/sim/battle/areas.ts               원/부채꼴/직선 판정
src/sim/battle/telegraphs.ts          위험 범위 생성·발동
src/sim/battle/projectiles.ts         투사체 이동·명중
src/sim/battle/rescue.ts              구출 진행
src/sim/battle/rules.ts               광폭화·보스 페이즈·승패·후퇴
src/sim/battle/battle.ts              Battle 클래스(step), runHeadless
src/sim/battle/ai/candidates.ts       후보 행동 생성
src/sim/battle/ai/considerations.ts   고려 요소 레지스트리 + 기본 고려 요소
src/sim/battle/ai/tactics.ts          전술별 가중치 고려 요소
src/sim/battle/ai/decide.ts           점수화·선택·의도(근거) 생성
src/app/main.ts, src/app/router.ts
src/view/scene/{renderer,camera,lighting,arena}.ts
src/view/actors/{assets,modelManifest,animMap,actorFactory,actor}.ts
src/view/playback/{battlePlayer,eventRouter,interpolate}.ts
src/view/fx/{telegraphFx,projectileFx,slashFx,hitFx,shieldFx}.ts
src/view/overlay/{unitOverlay,damageNumbers}.ts
src/ui/i18n/ko.ts
src/ui/screens/{sandboxScreen,battleScreen}.ts
src/ui/hud/{controls,inspectPanel,battleLog,resultOverlay}.ts
src/ui/styles/main.css
tests/unit/*.test.ts, tests/sim/*.test.ts, tests/e2e/sandbox.spec.ts
public/assets/models/..., public/assets/ART.md
```

---

### Task 1: 스캐폴드·도구·CI (기존 RAIDBOUND 제거)

**Files:**
- Delete: `src.js battle-view.js build.mjs server.mjs index.html style.css tests/ vendor/ assets/characters-v2.webp assets/stone-v3.webp .github/workflows/pages.yml .github/workflows/test.yml README.md`
- Move: `assets/models/KAYKIT-LICENSE.txt` → `public/assets/KAYKIT-LICENSE.txt` (나머지 `assets/` 삭제 — 모델은 Task 10에서 원본으로 재생성)
- Create: `package.json, tsconfig.json, vite.config.ts, vitest.config.ts, eslint.config.js, playwright.config.ts, index.html, src/app/main.ts, src/ui/styles/main.css, scripts/check-file-length.mjs, .github/workflows/ci.yml, .gitignore, README.md, tests/unit/smoke.test.ts, tests/e2e/boot.spec.ts`

- [ ] **Step 1: 기존 파일 삭제·라이선스 이동**

```bash
git rm -rq src.js battle-view.js build.mjs server.mjs index.html style.css tests vendor .github/workflows README.md assets/characters-v2.webp assets/stone-v3.webp assets/ART.md assets/models/*.glb
mkdir -p public/assets && git mv assets/models/KAYKIT-LICENSE.txt public/assets/KAYKIT-LICENSE.txt
```

- [ ] **Step 2: package.json**

```json
{
  "name": "proj-r",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . && node scripts/check-file-length.mjs",
    "test": "vitest run",
    "e2e": "playwright test",
    "assets": "node scripts/prepare-assets.mjs"
  }
}
```
설치: `npm i three@0.186.1 && npm i -D typescript@~6.0.3 vite@^8 vitest@^5 @types/three@0.186.0 @types/node@^22 eslint@^10 typescript-eslint@^8 @eslint/js@^10 globals @playwright/test@1.63.0 @gltf-transform/core@^4.5 @gltf-transform/functions@^4.5`

- [ ] **Step 3: 설정 파일**

`tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"], "strict": true,
    "noUncheckedIndexedAccess": true, "noImplicitOverride": true,
    "skipLibCheck": true, "isolatedModules": true, "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`
```ts
import { defineConfig } from 'vite';
export default defineConfig({ base: '/PROJ_R/', build: { target: 'es2022', chunkSizeWarningLimit: 1500 } });
```

`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'], environment: 'node' } });
```

`eslint.config.js`
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const PURE = ['src/core/**', 'src/data/**', 'src/sim/**'];
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'test-artifacts', '.asset-cache', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: PURE,
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*'], message: 'pure layer: no three.js' },
        { group: ['**/app/**', '**/view/**', '**/ui/**'], message: 'pure layer: no app/view/ui' },
      ] }],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'use core/rng' },
        { object: 'Date', property: 'now', message: 'sim must be deterministic' }],
      'no-restricted-globals': ['error', 'window', 'document', 'performance'],
    },
  },
  { files: ['src/core/**'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/data/**', '**/sim/**', '**/app/**', '**/view/**', '**/ui/**', 'three'], message: 'core imports nothing' }] }] } },
  { files: ['src/data/**'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/sim/**', '**/app/**', '**/view/**', '**/ui/**', 'three'], message: 'data imports only core' }] }] } },
);
```

`scripts/check-file-length.mjs`
```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const MAX = 300, ROOTS = ['src', 'tests', 'scripts'], EXT = new Set(['.ts', '.js', '.mjs', '.css']);
const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.has(extname(p))) {
      const n = readFileSync(p, 'utf8').split('\n').length;
      if (n > MAX) bad.push(`${p}: ${n} lines`);
    }
  }
};
ROOTS.forEach((r) => { try { walk(r); } catch { /* root may not exist */ } });
if (bad.length) { console.error(`Files over ${MAX} lines:\n${bad.join('\n')}`); process.exit(1); }
console.log('file length OK');
```

`playwright.config.ts`
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', outputDir: 'test-artifacts/results', timeout: 120_000,
  use: { baseURL: 'http://localhost:4173/PROJ_R/', viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173/PROJ_R/', reuseExistingServer: true, timeout: 60_000 },
});
```

`.gitignore`
```
node_modules
dist
test-artifacts
playwright-report
.asset-cache
```

- [ ] **Step 4: 최소 앱**

`index.html`
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PROJ_R</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/app/main.ts"></script>
  </body>
</html>
```

`src/app/main.ts`
```ts
import '../ui/styles/main.css';
const root = document.getElementById('app');
if (root) root.innerHTML = '<h1 class="boot-title">PROJ_R</h1>';
```

`src/ui/styles/main.css`
```css
:root { --bg: #1b1a1f; --panel: #26242c; --text: #ece6da; --accent: #e0a64a; --danger: #d0533f; --ally: #4aa3e0; font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); overflow: hidden; }
#app { position: relative; width: 100%; height: 100%; }
.boot-title { text-align: center; margin-top: 30vh; letter-spacing: 0.3em; }
```

- [ ] **Step 5: 스모크 테스트 2개 작성**

`tests/unit/smoke.test.ts`
```ts
import { describe, it, expect } from 'vitest';
describe('toolchain', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

`tests/e2e/boot.spec.ts`
```ts
import { test, expect } from '@playwright/test';
test('app boots', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#app')).not.toBeEmpty();
});
```

- [ ] **Step 6: CI 워크플로**

`.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: e2e-screenshots, path: test-artifacts/, if-no-files-found: ignore }
      - uses: actions/upload-pages-artifact@v4
        if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
        with: { path: dist }
  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    concurrency: { group: github-pages, cancel-in-progress: false }
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 7: README** — 프로젝트 한 줄 소개, `npm run dev / test / e2e / assets`, 플레이 URL, 스펙·계획 문서 링크 (한국어, 30줄 이내).

- [ ] **Step 8: 검증**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npx playwright install chromium && npm run e2e`
Expected: 모두 통과.

- [ ] **Step 9: Commit**
```bash
git add -A && git commit -m "Replace RAIDBOUND with Vite+TS scaffold, lint rules, and CI/Pages workflow"
```

---

### Task 2: core — RNG, Vec2

**Files:** Create `src/core/rng.ts`, `src/core/vec2.ts`; Test `tests/unit/rng.test.ts`, `tests/unit/vec2.test.ts`

**Interfaces — Produces:**
```ts
// rng.ts
export interface Rng { next(): number; int(min: number, maxInclusive: number): number; chance(p: number): boolean; pick<T>(arr: readonly T[]): T; shuffle<T>(arr: T[]): T[]; getState(): number; }
export function createRng(seed: number): Rng;
// vec2.ts
export interface Vec2 { x: number; y: number }
export const v: (x: number, y: number) => Vec2;
export function add(a: Vec2, b: Vec2): Vec2; export function sub(a: Vec2, b: Vec2): Vec2;
export function scale(a: Vec2, s: number): Vec2; export function len(a: Vec2): number;
export function dist(a: Vec2, b: Vec2): number; export function norm(a: Vec2): Vec2; // 0벡터면 {0,0}
export function clampLen(a: Vec2, max: number): Vec2; export function dot(a: Vec2, b: Vec2): number;
export function angleOf(a: Vec2): number; export function fromAngle(rad: number): Vec2;
export function lerp(a: Vec2, b: Vec2, t: number): Vec2; export function perp(a: Vec2): Vec2; // (-y, x)
```

- [ ] **Step 1: 실패 테스트**

`tests/unit/rng.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42);
    const sa = Array.from({ length: 5 }, () => a.next()), sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = createRng(1), b = createRng(2);
    expect(a.next()).not.toBe(b.next());
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) { const x = r.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('int is inclusive and pick/shuffle use all items', () => {
    const r = createRng(3); const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(['a']).toContain(r.pick(['a']));
  });
});
```

`tests/unit/vec2.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { v, add, sub, len, norm, clampLen, dist, angleOf, fromAngle, perp } from '../../src/core/vec2';
describe('vec2', () => {
  it('basic ops', () => {
    expect(add(v(1, 2), v(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(v(1, 2), v(3, 4))).toEqual({ x: -2, y: -2 });
    expect(len(v(3, 4))).toBe(5); expect(dist(v(0, 0), v(3, 4))).toBe(5);
  });
  it('norm of zero is zero, clampLen caps', () => {
    expect(norm(v(0, 0))).toEqual({ x: 0, y: 0 });
    expect(len(clampLen(v(10, 0), 2))).toBeCloseTo(2);
  });
  it('angles and perp', () => {
    const a = fromAngle(angleOf(v(0, 1))); expect(a.x).toBeCloseTo(0); expect(a.y).toBeCloseTo(1);
    expect(perp(v(1, 0))).toEqual({ x: -0, y: 1 });
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/unit` → FAIL (module not found)

- [ ] **Step 3: 구현**

`src/core/rng.ts`
```ts
export interface Rng {
  next(): number; int(min: number, maxInclusive: number): number; chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T; shuffle<T>(arr: T[]): T[]; getState(): number;
}
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => { if (arr.length === 0) throw new Error('pick from empty'); return arr[Math.floor(next() * arr.length)]!; },
    shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j]!, arr[i]!]; } return arr; },
    getState: () => s,
  };
}
```

`src/core/vec2.ts`
```ts
export interface Vec2 { x: number; y: number }
export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => { const l = len(a); return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }; };
export const clampLen = (a: Vec2, max: number): Vec2 => { const l = len(a); return l <= max ? a : scale(a, max / l); };
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export const fromAngle = (rad: number): Vec2 => ({ x: Math.cos(rad), y: Math.sin(rad) });
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
```

- [ ] **Step 4:** `npx vitest run tests/unit` → PASS
- [ ] **Step 5:** `git add src/core tests/unit && git commit -m "Add seeded RNG and vec2 core modules"`

---

### Task 3: 데이터 — 타입, 태그, 직업, 스킬, 적, 전술, 프리셋, 한국어 이름

**Files:** Create `src/data/types.ts, tags.ts, classes.ts, enemies.ts, tactics.ts, presets.ts, skills/{basic,warrior,berserker,rogue,crossbow,mage,priest,enemy,index}.ts, src/ui/i18n/ko.ts`; Test `tests/unit/data.test.ts`

**Interfaces — Produces (`src/data/types.ts`, 그대로 작성):**
```ts
export type ClassId = 'novice' | 'warrior' | 'berserker' | 'rogue' | 'crossbow' | 'mage' | 'priest';
export type Role = 'vanguard' | 'striker' | 'skirmisher' | 'ranged' | 'caster' | 'support';
export type TagId = 'marked' | 'knockdown' | 'wet' | 'stun' | 'burn' | 'bleed' | 'slow' | 'shield' | 'taunted';
export type TacticId = 'weakHunt' | 'guardBack' | 'casterHunt' | 'keepDistance' | 'markHunt' | 'vanguard' | 'dangerFirst' | 'rescueDowned' | 'useCover' | 'followLeader';
export type ModelId = 'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Rogue_Hooded' | 'Skeleton_Warrior' | 'Skeleton_Mage' | 'Skeleton_Rogue' | 'Skeleton_Minion';
export type AnimKey = 'idle' | 'run' | 'walkBack' | 'attack1h' | 'attack1hStab' | 'attack2h' | 'attack2hSpin' | 'attackDual' | 'shoot1h' | 'shoot2h' | 'cast' | 'castRaise' | 'castLong' | 'block' | 'hit' | 'dodgeL' | 'dodgeR' | 'dodgeB' | 'death' | 'downed' | 'standUp' | 'cheer' | 'throw' | 'spawn' | 'taunt' | 'leapChop';
export interface Stats { maxHp: number; atk: number; def: number; atkSpeed: number; range: number; moveSpeed: number; dodge: number; crit: number }
export type AreaShape = { shape: 'circle'; radius: number; center: 'self' | 'target' } | { shape: 'cone'; radius: number; angleDeg: number } | { shape: 'line'; length: number; width: number };
export type Effect =
  | { type: 'damage'; mult: number }
  | { type: 'heal'; mult: number }                       // mult × 시전자 atk
  | { type: 'addTag'; tag: TagId; duration: number; value?: number } // burn/bleed: value=초당 피해 배율(×시전자 atk)
  | { type: 'knockback'; distance: number }
  | { type: 'dash'; distance: number; stopShort?: number } // 시전자가 목표 방향으로 이동
  | { type: 'shield'; pctMaxHp: number; duration: number }  // 대상 maxHp 비율
  | { type: 'taunt'; duration: number }
  | { type: 'cleanse' }
  | { type: 'summon'; enemyId: string; count: number };
export interface Reaction { tag: TagId; consume: boolean; effects: Effect[] }
export type TargetKind = 'enemy' | 'ally' | 'self';
export type AiHint = 'heal' | 'shield' | 'cc' | 'aoe' | 'gapClose' | 'execute' | 'taunt' | 'summon';
export interface SkillDef {
  id: string; kind: 'basic' | 'active' | 'ultimate';
  cooldown: number; windup: number; active: number; recovery: number; // 초
  range: number; target: TargetKind; area?: AreaShape; telegraph?: boolean;
  projectile?: { speed: number; visual: 'bolt' | 'arrow' | 'fireball' | 'holy' | 'dark' };
  effects: Effect[]; reacts?: Reaction[]; anim: AnimKey; aiValue: number; hints?: AiHint[];
}
export interface GearVisual { weapon: string; offhand?: string; helmet: boolean; cape: boolean }
export interface ClassDef { id: ClassId; role: Role; base: Stats; growth: Partial<Stats>; basic: string; actives: string[]; ultimate: string; model: ModelId; gear: GearVisual }
export interface BossPhase { hpBelow: number; statMult: Partial<Stats>; areaMult: number }
export interface EnemyDef { id: string; role: Role; base: Stats; basic: string; actives: string[]; ultimate?: string; model: ModelId; gear: GearVisual; tint?: string; scale?: number; elite?: boolean; boss?: boolean; phases?: BossPhase[] }
```

**태그(`tags.ts`):** `export const TAGS: Record<TagId, { negative: boolean; blocksAction: boolean; moveMult: number }>` — knockdown/stun `blocksAction: true`; wet moveMult 0.9, slow 0.6, 나머지 1. negative: shield만 false.

**직업(`classes.ts`) — `export const CLASSES: Record<ClassId, ClassDef>`:**

| id | role | maxHp | atk | def | atkSpeed | range | moveSpeed | dodge | crit | basic | actives | ultimate | model | gear |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| novice | striker | 120 | 14 | 8 | 1.0 | 1.3 | 3.2 | .05 | .05 | novice_slash | [novice_lunge] | novice_desperate | Knight | weapon '1H_Sword', helmet false, cape false |
| warrior | vanguard | 180 | 13 | 25 | 0.9 | 1.3 | 3.0 | .03 | .05 | warrior_strike | [shield_bash, taunt_shout] | bulwark | Knight | '1H_Sword' + offhand 'Round_Shield', helmet true |
| berserker | striker | 150 | 20 | 10 | 0.95 | 1.5 | 3.4 | .03 | .10 | cleave | [charge, whirlwind] | bloodrage | Barbarian | '2H_Axe' |
| rogue | skirmisher | 110 | 17 | 8 | 1.3 | 1.2 | 4.0 | .20 | .15 | stab | [mark_for_death, shadow_step] | assassinate | Rogue | 'Knife' + offhand 'Knife_Offhand' |
| crossbow | ranged | 100 | 16 | 6 | 0.9 | 7.0 | 3.2 | .08 | .10 | bolt_shot | [crippling_shot, piercing_bolt] | volley | Rogue_Hooded | '2H_Crossbow' |
| mage | caster | 90 | 18 | 5 | 0.8 | 6.5 | 3.0 | .05 | .05 | arcane_bolt | [water_splash, fireball] | thunderstorm | Mage | 'Staff' |
| priest | support | 100 | 9 | 8 | 0.9 | 6.0 | 3.0 | .05 | .05 | smite | [heal, judgment] | sanctuary | Mage | 'Wand' + offhand 'Spellbook' |

growth(레벨당): 전 직업 `{ maxHp: base×0.10, atk: base×0.08, def: base×0.05 }` 반올림. (무기 메시 이름은 Task 10에서 실제 노드명으로 확정하고 `modelManifest`에서 매핑하므로 여기 문자열은 논리 키다.)

**스킬 — 전부 정의(`skills/*.ts`가 `SkillDef[]` export, `index.ts`가 `SKILLS: Record<string, SkillDef>`와 `getSkill(id)`(없으면 throw)):**
기본 타이밍: 근접 basic windup .35 / active .1 / recovery .45, 원거리 basic .45/.1/.55, active 스킬은 표에 명시. cooldown 단위 초. basic의 cooldown 0, aiValue 10.

| id | kind | cd | 타이밍(w/a/r) | range | target | area/telegraph/projectile | effects | reacts | anim | aiValue | hints |
|---|---|---|---|---|---|---|---|---|---|---|---|
| novice_slash | basic | 0 | 근접 | 1.3 | enemy | — | dmg 1.0 | — | attack1h | 10 | |
| novice_lunge | active | 7 | .3/.1/.4 | 5 | enemy | — | dash 5 stopShort 1, dmg 1.2 | — | attack1hStab | 22 | gapClose |
| novice_desperate | ultimate | 0 | .4/.1/.5 | 1.5 | enemy | — | dmg 1.8, knockback 2 | — | attack1h | 60 | |
| warrior_strike | basic | 0 | 근접 | 1.3 | enemy | — | dmg 1.0 | — | attack1h | 10 | |
| shield_bash | active | 8 | .3/.1/.5 | 1.5 | enemy | — | dmg 1.0, addTag knockdown 1 | — | block | 25 | cc |
| taunt_shout | active | 12 | .4/.1/.4 | 4 | self | circle r4 center self | taunt 3, shield 0.15 (자신에게만 — area 대상이 적이면 taunt, 시전자에게 shield: `selfEffects` 필드 사용, 아래 참고) | — | taunt | 28 | taunt, aoe |
| bulwark | ultimate | 0 | .5/.1/.5 | 5 | ally | circle r5 center self | shield 0.2 dur 6 | — | castRaise | 60 | shield, aoe |
| cleave | basic | 0 | 근접 | 1.5 | enemy | cone r1.8 90° | dmg 1.0 | — | attack2h | 10 | |
| charge | active | 9 | .35/.15/.5 | 7 | enemy | — | dash 7 stopShort 1, dmg 1.3, knockback 1.5 | slow: consume false, dmg 1.0 | attack2h | 26 | gapClose |
| whirlwind | active | 10 | .3/.4/.5 | 2.5 | enemy | circle r2.5 center self | dmg 0.9, addTag bleed 4 value 0.15 | knockdown: consume true, dmg 1.5 | attack2hSpin | 24 | aoe |
| bloodrage | ultimate | 0 | .4/.5/.6 | 3 | enemy | circle r3 center self | dmg 1.8, addTag bleed 5 value 0.2 | — | attack2hSpin | 60 | aoe |
| stab | basic | 0 | 근접 | 1.2 | enemy | — | dmg 1.0 | — | attackDual | 10 | |
| mark_for_death | active | 7 | .25/.1/.35 | 1.4 | enemy | — | dmg 1.2, addTag marked 6 | — | attack1hStab | 22 | |
| shadow_step | active | 8 | .2/.1/.4 | 6 | enemy | — | dash 6 stopShort 0.8, dmg 1.5 | marked: consume true, dmg 1.5 | attackDual | 24 | gapClose, execute |
| assassinate | ultimate | 0 | .5/.1/.5 | 1.5 | enemy | — | dmg 3.0 | knockdown: consume false, dmg 1.5; marked: consume true, dmg 1.5 | attack1hStab | 60 | execute |
| bolt_shot | basic | 0 | 원거리 | 7 | enemy | projectile 18 arrow | dmg 1.0 | — | shoot2h | 10 | |
| crippling_shot | active | 6 | .4/.1/.4 | 7 | enemy | projectile 18 arrow | dmg 1.1, addTag slow 3 | — | shoot2h | 22 | cc |
| piercing_bolt | active | 9 | .7/.1/.4 | 8 | enemy | line len 8 w 1, telegraph | dmg 1.4 | marked: consume true, dmg 1.0 | shoot2h | 26 | aoe |
| volley | ultimate | 0 | 1.0/.2/.5 | 8 | enemy | circle r3 center target, telegraph | dmg 1.5, addTag slow 3 | — | shoot2h | 60 | aoe |
| arcane_bolt | basic | 0 | 원거리 | 6.5 | enemy | projectile 12 bolt | dmg 1.0 | — | cast | 10 | |
| water_splash | active | 8 | .8/.1/.4 | 6.5 | enemy | circle r2.5 center target, telegraph | dmg 0.6, addTag wet 6 | — | castRaise | 24 | aoe |
| fireball | active | 9 | .6/.1/.5 | 6.5 | enemy | projectile 10 fireball + circle r1.8 center target(명중 지점) | dmg 1.4, addTag burn 4 value 0.2 | wet: consume true, dmg 0.5 (증기 — 화상은 정상 적용) | cast | 26 | aoe |
| thunderstorm | ultimate | 0 | 1.2/.2/.6 | 7 | enemy | circle r3 center target, telegraph | dmg 1.4 | wet: consume true, dmg 1.0 + addTag stun 1.5 | castLong | 60 | aoe, cc |
| smite | basic | 0 | 원거리 | 6 | enemy | projectile 12 holy | dmg 0.8 | — | cast | 10 | |
| heal | active | 4 | .5/.1/.4 | 6 | ally | — | heal 3.5 | — | castRaise | 20 | heal |
| judgment | active | 10 | .6/.1/.5 | 6.5 | enemy | — (즉발 번개) | dmg 1.6 | wet: consume true, dmg 1.2 + addTag stun 1 | cast | 26 | cc |
| sanctuary | ultimate | 0 | .8/.2/.6 | 6 | ally | circle r6 center self | heal 3.0, cleanse | — | castLong | 60 | heal, aoe |
| dirty_strike | active | 8 | .3/.1/.4 | 1.3 | enemy | — | dmg 1.2, addTag slow 2 | — | attack1hStab | 22 | cc |
| hex | active | 9 | .5/.1/.4 | 6 | enemy | projectile 10 dark | dmg 0.8, addTag marked 6 | — | cast | 20 | |
| ground_slam | active | 9 | 1.2/.1/.6 | 3 | enemy | circle r2.5 center target, telegraph | dmg 1.6, addTag knockdown 1 | — | attack2h | 30 | aoe, cc |
| grave_bolt | active | 7 | .5/.1/.4 | 6.5 | enemy | projectile 10 dark | dmg 1.3, addTag slow 2 | — | cast | 22 | cc |
| heavy_cleave | basic | 0 | .5/.1/.6 | 2.2 | enemy | cone r2.5 100° | dmg 1.2 | — | attack2h | 10 | |
| crushing_slam | active | 8 | 1.5/.1/.7 | 4 | enemy | circle r3 center target, telegraph | dmg 2.2, addTag knockdown 1.2 | — | leapChop | 40 | aoe, cc |
| ashen_charge | active | 11 | 1.2/.4/.6 | 9 | enemy | line len 9 w 1.6, telegraph | dash 9 stopShort 0, dmg 1.6, knockback 2 | — | attack2h | 35 | aoe, gapClose |
| raise_dead | active | 20 | 1.5/.1/.5 | 0 | self | — | summon skeleton_minion 3 | — | castLong | 30 | summon |

`taunt_shout` 처리: SkillDef에 선택 필드 `selfEffects?: Effect[]`를 추가한다(시전자에게 발동 시 적용). taunt_shout = `effects: [taunt 3]`, `selfEffects: [shield 0.15 dur 4]`. 타입 정의에 `selfEffects?: Effect[]` 포함.

**적(`enemies.ts`) — `export const ENEMIES: Record<string, EnemyDef>`:**

| id | role | hp | atk | def | as | range | move | dodge | crit | basic | actives | model | gear | 기타 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bandit_cutthroat | skirmisher | 90 | 11 | 6 | 1.1 | 1.2 | 3.6 | .10 | .10 | stab | [dirty_strike] | Rogue | 'Knife' | tint '#8a6a4a' |
| bandit_archer | ranged | 70 | 10 | 4 | .85 | 6.5 | 3.2 | .05 | .05 | bolt_shot | [crippling_shot] | Rogue_Hooded | '1H_Crossbow' | tint '#7a5a3a' |
| bandit_hexer | caster | 70 | 12 | 4 | .8 | 6 | 3.0 | .05 | .05 | arcane_bolt | [hex] | Mage | 'Wand' | tint '#6a4a6a' |
| bandit_chief | striker | 320 | 18 | 15 | .9 | 1.5 | 3.2 | .05 | .10 | cleave | [ground_slam, charge] | Barbarian | '2H_Axe', helmet true | elite, tint '#a05a3a', scale 1.15 |
| skeleton_minion | striker | 50 | 8 | 4 | 1.0 | 1.2 | 3.0 | 0 | .05 | warrior_strike | [] | Skeleton_Minion | 'Blade' | |
| skeleton_warrior | vanguard | 120 | 12 | 18 | .9 | 1.3 | 2.8 | 0 | .05 | warrior_strike | [shield_bash] | Skeleton_Warrior | 'Axe' + 'Shield_Small' | |
| skeleton_archer | ranged | 70 | 11 | 5 | .85 | 7 | 3.0 | .05 | .05 | bolt_shot | [] | Skeleton_Rogue | 'Crossbow' | |
| skeleton_mage | caster | 70 | 13 | 5 | .8 | 6.5 | 2.9 | 0 | .05 | arcane_bolt | [grave_bolt] | Skeleton_Mage | 'Staff' | |
| ashen_knight | vanguard | 1600 | 24 | 25 | .8 | 2.2 | 2.8 | 0 | .05 | heavy_cleave | [crushing_slam, ashen_charge, raise_dead] | Skeleton_Warrior | 'Axe' + 'Shield_Large' | boss, scale 1.8, phases [{hpBelow .5, statMult {atkSpeed 1.25, moveSpeed 1.15}, areaMult 1.3}] |

**전술(`tactics.ts`):** `export const TACTICS: readonly TacticId[]`(10종 전부), `export const STARTER_TACTICS: TacticId[] = ['weakHunt','guardBack','keepDistance','vanguard']`.

**프리셋(`presets.ts`):**
```ts
export interface AllyPresetMember { classId: ClassId; col: 0 | 1 | 2; row: 0 | 1 | 2 | 3; tactics: TacticId[]; color: string; name: string }
export interface EnemyPresetMember { enemyId: string; col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 }
export const ALLY_PRESETS: Record<string, AllyPresetMember[]>;
export const ENEMY_PRESETS: Record<string, { stage: number; members: EnemyPresetMember[] }>;
```
- `ALLY_PRESETS.solo`: 견습 1명(col 2 row 1, tactics ['vanguard'], '#e0c04a', '이름 없는 모험가').
- `ALLY_PRESETS.standard`: 전사(2,1,['guardBack']), 광전사(2,2,['vanguard']), 석궁수(0,1,['keepDistance']), 마법사(0,2,['keepDistance']), 사제(1,1,['weakHunt'] — 사제에겐 영향 적음). 이름: 브란, 카엘, 리아, 세린, 오웬. 색: #4aa3e0 #e05a4a #6ac46a #b07ae0 #f0f0f0.
- `ALLY_PRESETS.elemental`: 마법사, 사제, 도적, 전사, 석궁수(도적 tactics ['markHunt']).
- `ENEMY_PRESETS.bandits`: stage 1, cutthroat×2(col 2), archer×2(col 0), hexer(col 1).
- `ENEMY_PRESETS.skeletons`: stage 3, warrior×2, minion×2, archer, mage.
- `ENEMY_PRESETS.tutorial`: stage 1, minion×2.
- `ENEMY_PRESETS.boss`: stage 12, ashen_knight(col 1 row 1), skeleton_archer×2.
- `ENEMY_PRESETS.empty`: stage 1, members [] (Review Focus 2용).

**`src/ui/i18n/ko.ts`:** `export const KO = { class: Record<ClassId,string>, skill: Record<string,string>, enemy: Record<string,string>, tactic: Record<TacticId,string>, tag: Record<TagId,string>, reason: Record<string,string>, ui: Record<string,string> }` + `export function t(path: string, vars?: Record<string,string|number>): string` (점 경로, `{name}` 치환, 없으면 path 그대로 반환). 이름 예: novice 견습 모험가, warrior 전사, berserker 광전사, rogue 도적, crossbow 석궁수, mage 마법사, priest 사제; 스킬은 위 표 id마다 한국어 이름(예: shield_bash 방패 강타, water_splash 물보라, judgment 심판의 번개, ashen_charge 잿빛 돌진). reason 키는 Task 8에서 채운다(이 Task에선 빈 객체 허용 아님 — Task 8 목록을 미리 넣는다: `attack, skill, approach, kite, dodge, rescue, guard, retreat, idle, focusLow, focusMarked, focusCaster, combo, heal, protectBack, followLeader, cover, taunted, threat`).

- [ ] **Step 1: 실패 테스트** `tests/unit/data.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import { SKILLS, getSkill } from '../../src/data/skills';
import { ALLY_PRESETS, ENEMY_PRESETS } from '../../src/data/presets';
import { KO } from '../../src/ui/i18n/ko';

const kitOf = (d: { basic: string; actives: string[]; ultimate?: string }) => [d.basic, ...d.actives, ...(d.ultimate ? [d.ultimate] : [])];
describe('data integrity', () => {
  it('every class/enemy skill exists', () => {
    for (const c of Object.values(CLASSES)) for (const s of kitOf(c)) expect(() => getSkill(s), `${c.id}:${s}`).not.toThrow();
    for (const e of Object.values(ENEMIES)) for (const s of kitOf(e)) expect(() => getSkill(s), `${e.id}:${s}`).not.toThrow();
  });
  it('summons reference existing enemies', () => {
    for (const s of Object.values(SKILLS)) for (const ef of s.effects) if (ef.type === 'summon') expect(ENEMIES[ef.enemyId]).toBeDefined();
  });
  it('presets reference existing defs', () => {
    for (const p of Object.values(ALLY_PRESETS)) for (const m of p) expect(CLASSES[m.classId]).toBeDefined();
    for (const p of Object.values(ENEMY_PRESETS)) for (const m of p.members) expect(ENEMIES[m.enemyId]).toBeDefined();
  });
  it('every id has a Korean name', () => {
    for (const id of Object.keys(CLASSES)) expect(KO.class[id as keyof typeof KO.class]).toBeTruthy();
    for (const id of Object.keys(SKILLS)) expect(KO.skill[id], id).toBeTruthy();
    for (const id of Object.keys(ENEMIES)) expect(KO.enemy[id], id).toBeTruthy();
  });
  it('timings are positive and basics have no cooldown', () => {
    for (const s of Object.values(SKILLS)) {
      expect(s.windup).toBeGreaterThan(0); expect(s.active).toBeGreaterThan(0); expect(s.recovery).toBeGreaterThan(0);
      if (s.kind === 'basic') expect(s.cooldown).toBe(0);
    }
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/unit/data.test.ts` → FAIL
- [ ] **Step 3:** 위 표대로 모든 데이터 파일과 ko.ts 작성. 각 파일 300줄 이하(스킬은 직업별 파일로 분할되어 있음).
- [ ] **Step 4:** `npx vitest run && npm run lint && npm run typecheck` → PASS
- [ ] **Step 5:** `git add src/data src/ui/i18n tests/unit/data.test.ts && git commit -m "Add battle data: classes, skills, enemies, tactics, presets, Korean names"`

---

### Task 4: 시뮬레이션 타입·설정·스냅샷·Battle 뼈대

**Files:** Create `src/sim/battle/{constants,types,setup,stats,events,snapshot,battle}.ts`; Test `tests/sim/setup.test.ts`

**Interfaces — Produces:**

`constants.ts`
```ts
export const TICK_RATE = 20; export const DT = 1 / TICK_RATE; export const DECISION_INTERVAL = 5;
export const ARENA = { minX: -12, maxX: 12, minY: -7, maxY: 7 } as const;
export const UNIT_RADIUS = 0.45; export const SEPARATION_RADIUS = 0.9; export const MELEE_ENGAGE = 1.2; export const DISENGAGE_DIST = 1.6;
export const PROXIMITY = 4; export const RESCUE_RANGE = 1.0; export const RESCUE_TICKS = 40; export const RESCUE_HP = 0.25;
export const LIFELINE_PCT = 0.5; export const BERSERK_TICK = 90 * TICK_RATE; export const BERSERK_STEP_TICKS = 10 * TICK_RATE;
export const MAX_TICKS = 300 * TICK_RATE; export const MOMENTUM_MAX = 100; export const DODGE_CAP = 0.5; export const CRIT_MULT = 1.5;
export const STAGE_SCALE = 0.08; // 적 능력치: base × (1 + 0.08 × (stage-1)) — maxHp, atk에만 적용
export const secToTicks = (s: number): number => Math.max(1, Math.round(s * TICK_RATE));
```

`types.ts`
```ts
import type { Vec2 } from '../../core/vec2';
import type { Rng } from '../../core/rng';
import type { Stats, TagId, TacticId, ModelId, GearVisual, Role, BossPhase } from '../../data/types';
export type Team = 'ally' | 'enemy';
export type Line = 'front' | 'mid' | 'back';
export interface UnitSetup {
  id: string; name: string; team: Team; role: Role; defId: string; // classId 또는 enemyId
  stats: Stats; basic: string; actives: string[]; ultimate?: string; tactics: TacticId[];
  slot: { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 }; color: string; model: ModelId; gear: GearVisual;
  tint?: string; scale?: number; isLeader?: boolean; elite?: boolean; boss?: boolean; phases?: BossPhase[];
  extra?: Record<string, unknown>; // Plan 2/3 확장(특성·관계 등)
}
export interface Obstacle { pos: Vec2; radius: number; kind: 'rock' | 'pillar' }
export interface BattleSetup { seed: number; allies: UnitSetup[]; enemies: UnitSetup[]; obstacles?: Obstacle[] }
export interface TagInstance { tag: TagId; ticksLeft: number; value: number; srcId: string }
export interface ActionState { skillId: string; targetId?: string; targetPos?: Vec2; phase: 'windup' | 'active' | 'recovery'; ticksLeft: number; totalTicks: number; telegraphId?: number }
export type IntentKind = 'attack' | 'skill' | 'approach' | 'kite' | 'dodge' | 'rescue' | 'guard' | 'retreat' | 'idle';
export interface Intent { kind: IntentKind; skillId?: string; targetId?: string; dest?: Vec2; reason: string; detail?: string[] }
export interface ForcedMove { vel: Vec2; ticksLeft: number; kind: 'knockback' | 'dash' | 'roll' }
export interface UnitState {
  id: string; setup: UnitSetup; team: Team; line: Line; pos: Vec2; facing: number; vel: Vec2;
  hp: number; maxHp: number; shield: number; momentum: number; alive: boolean; downed: boolean; lifeline: number;
  action: ActionState | null; cooldowns: Record<string, number>; tags: TagInstance[]; intent: Intent | null;
  decisionIn: number; forced: ForcedMove | null; engagedWith: string | null; threat: Record<string, number>;
  rescueUsed: boolean; rescueProgress: number; rescueTarget: string | null; phaseIndex: number; summoned: boolean;
  stats: { kills: number; damageDealt: number; healingDone: number; dodges: number };
}
export interface Telegraph { id: number; srcId: string; skillId: string; team: Team; area: import('../../data/types').AreaShape; origin: Vec2; dir: Vec2; firesAt: number; startedAt: number; areaMult: number }
export interface Projectile { id: number; srcId: string; skillId: string; targetId: string; pos: Vec2; speed: number; visual: string }
export type Outcome = 'victory' | 'defeat' | 'retreat';
export type BattleCommand = { type: 'retreat' };
export interface BattleEvent { tick: number; type: string; src?: string; dst?: string; skillId?: string; amount?: number; tag?: string; crit?: boolean; reason?: string; pos?: Vec2; data?: Record<string, unknown> }
export interface BattleState {
  tick: number; rng: Rng; units: UnitState[]; telegraphs: Telegraph[]; projectiles: Projectile[]; obstacles: Obstacle[];
  events: BattleEvent[]; outcome: Outcome | null; pending: BattleCommand[]; nextId: number; berserkMult: number;
}
export interface UnitSnap { id: string; x: number; y: number; facing: number; hp: number; maxHp: number; shield: number; momentum: number; alive: boolean; downed: boolean; lifeline: number; action: { skillId: string; phase: string; progress: number } | null; tags: string[]; intent: Intent | null; forced: string | null }
export interface Snapshot { tick: number; units: UnitSnap[]; telegraphs: { id: number; skillId: string; team: Team; area: import('../../data/types').AreaShape; origin: Vec2; dir: Vec2; progress: number; areaMult: number }[]; projectiles: { id: number; x: number; y: number; visual: string }[] }
export interface StepResult { snapshot: Snapshot; events: BattleEvent[] }
```

`setup.ts`
```ts
export function slotToPos(team: Team, col: number, row: number): Vec2; // ally: x = -5 - (2-col)*2.5, enemy: x = +5 + (2-col)*2.5; y = -4.5 + row*3
export function lineOf(col: number): Line; // 2 front, 1 mid, 0 back
export function allyFromClass(m: AllyPresetMember, index: number, level?: number): UnitSetup; // id `a${index}`, level 기본 1, growth×(level-1) 적용, index 0이면 isLeader
export function enemyFromDef(enemyId: string, col: 0|1|2, row: 0|1|2|3, stage: number, index: number): UnitSetup; // id `e${index}`, STAGE_SCALE 적용, color '#d0533f'
export function setupFromPresets(seed: number, allyKey: string, enemyKey: string): BattleSetup; // obstacles: rng(seed)로 0~3개, 배치칸(|x|>=4) 피해서 x∈[-3,3], radius 0.6~1.0
export function createState(setup: BattleSetup): BattleState; // UnitState 초기화: facing ally 0, enemy π; decisionIn = index % DECISION_INTERVAL(동시 결정 분산)
export function makeUnitState(setup: UnitSetup, pos: Vec2, index: number, summoned: boolean): UnitState;
```

`stats.ts`
```ts
export type StatMods = Partial<Record<keyof Stats, number>>; // 곱연산 배율
export type StatModifier = (u: UnitState, s: BattleState) => StatMods | null;
export const statModifiers: StatModifier[]; // 기본 등록: 태그 이동 배율(TAGS.moveMult), 보스 페이즈 statMult
export function registerStatModifier(m: StatModifier): void;
export function effectiveStats(u: UnitState, s: BattleState): Stats; // base × Π mods, dodge ≤ DODGE_CAP
export type DamageModifier = (src: UnitState, dst: UnitState, s: BattleState) => number; // 곱연산
export const damageModifiers: DamageModifier[]; // 기본 등록: 광폭화 s.berserkMult
export function registerDamageModifier(m: DamageModifier): void;
```

`events.ts`: `export function emit(s: BattleState, e: Omit<BattleEvent, 'tick'>): void` (s.events.push({tick: s.tick, ...e})).

`snapshot.ts`: `export function makeSnapshot(s: BattleState): Snapshot` (action.progress = 1 - ticksLeft/totalTicks; telegraph.progress = (tick-startedAt)/(firesAt-startedAt)).

`battle.ts` (이 Task에선 뼈대: 틱 증가 + 승패 판정만, 이후 Task에서 단계 추가)
```ts
export class Battle {
  readonly state: BattleState;
  constructor(setup: BattleSetup);
  step(): StepResult;           // outcome이 있으면 아무것도 하지 않고 마지막 스냅샷·빈 이벤트 반환
  command(cmd: BattleCommand): void; // state.pending에 push, 다음 step 시작 시 처리
  get outcome(): Outcome | null;
}
export function runHeadless(setup: BattleSetup, commands?: { tick: number; cmd: BattleCommand }[]): { outcome: Outcome; ticks: number; events: BattleEvent[]; final: Snapshot };
```
step 순서(최종형, 각 Task가 해당 줄을 채움): `processCommands → updateRules(광폭화·페이즈) → tickTags → tickCooldowns → decide(AI) → advanceActions → updateTelegraphs → updateProjectiles → move → engagement → rescue → checkOutcome → tick++ → snapshot`.
승패: 적 alive 0 → victory; 아군 중 `alive && !downed` 0 → defeat; tick ≥ MAX_TICKS → defeat. 판정 시 `emit({type:'battle_end', data:{outcome}})`.

- [ ] **Step 1: 실패 테스트** `tests/sim/setup.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { slotToPos, lineOf, setupFromPresets, createState } from '../../src/sim/battle/setup';
import { Battle, runHeadless } from '../../src/sim/battle/battle';
describe('battle setup', () => {
  it('maps formation slots symmetrically', () => {
    expect(slotToPos('ally', 2, 0)).toEqual({ x: -5, y: -4.5 });
    expect(slotToPos('ally', 0, 3)).toEqual({ x: -10, y: 4.5 });
    expect(slotToPos('enemy', 2, 0)).toEqual({ x: 5, y: -4.5 });
    expect(lineOf(2)).toBe('front'); expect(lineOf(0)).toBe('back');
  });
  it('builds state with leader and stage-scaled enemies', () => {
    const s1 = createState(setupFromPresets(1, 'standard', 'bandits'));
    const s5 = createState(setupFromPresets(1, 'standard', 'skeletons'));
    expect(s1.units.filter((u) => u.team === 'ally')).toHaveLength(5);
    expect(s1.units[0]!.setup.isLeader).toBe(true);
    const war = s5.units.find((u) => u.setup.defId === 'skeleton_warrior')!;
    expect(war.maxHp).toBe(Math.round(120 * (1 + 0.08 * 2)));
  });
  it('empty enemy side ends immediately with victory', () => {
    const r = runHeadless(setupFromPresets(1, 'solo', 'empty'));
    expect(r.outcome).toBe('victory'); expect(r.ticks).toBeLessThanOrEqual(1);
  });
  it('empty ally side ends immediately with defeat', () => {
    const setup = setupFromPresets(1, 'solo', 'tutorial'); setup.allies = [];
    expect(new Battle(setup).step().events.some((e) => e.type === 'battle_end')).toBe(true);
  });
  it('obstacles stay out of deploy zones', () => {
    for (let seed = 0; seed < 30; seed++) for (const o of setupFromPresets(seed, 'solo', 'tutorial').obstacles ?? []) expect(Math.abs(o.pos.x)).toBeLessThanOrEqual(3);
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/sim` → FAIL
- [ ] **Step 3:** 위 인터페이스대로 구현.
- [ ] **Step 4:** `npx vitest run && npm run lint && npm run typecheck` → PASS
- [ ] **Step 5:** `git commit -am "Add battle state types, formation setup, snapshot, and Battle skeleton"` (새 파일 `git add` 포함)

---

### Task 5: 이동·교전

**Files:** Create `src/sim/battle/movement.ts`, `src/sim/battle/engagement.ts`; Modify `battle.ts`(move, engagement 단계 연결); Test `tests/sim/movement.test.ts`

**Interfaces — Produces:**
```ts
// movement.ts
export function steerToward(u: UnitState, dest: Vec2, s: BattleState, stopDist: number): void; // u.vel 설정 (moveSpeed × DT 단위가 아닌 m/s)
export function steerAway(u: UnitState, from: Vec2, s: BattleState): void;
export function moveUnits(s: BattleState): void;
// - forced가 있으면 vel=forced.vel, ticksLeft--, 장애물·경계만 적용
// - 행동 중(action != null)이거나 blocksAction 태그면 vel=0 (forced 제외)
// - 쓰러짐/사망은 이동 없음
// - 그 외: vel + 분리력(SEPARATION_RADIUS 내 살아있는 유닛에게서 밀어냄, 세기 = (R - d)/R × moveSpeed) 후 moveSpeed로 clamp
// - pos += vel × DT; 장애물(원)과 겹치면 바깥으로 밀어냄; ARENA 경계 clamp(UNIT_RADIUS 여유)
// - |vel| > 0.05면 facing = angleOf(vel) (행동 중 facing은 actions가 목표 방향으로 설정)
export function unitsInRadius(s: BattleState, center: Vec2, r: number, pred?: (u: UnitState) => boolean): UnitState[]; // id 오름차순 정렬 반환(결정론)
// engagement.ts
export function updateEngagement(s: BattleState): void;
// - 근접(range ≤ 2) 유닛이 MELEE_ENGAGE 내 적과 있고 그 적을 intent.targetId로 삼으면 engagedWith = 적 id
// - engagedWith 대상과의 거리가 DISENGAGE_DIST 초과 && forced.kind !== 'roll'/'dash' && 이동 원인이 자발적이면:
//   상대(살아있고 행동 불가 태그 없음)가 즉시 기본 공격 1회(applyBasicHit: Task 6의 damage.dealDamage 사용, 배율 1.0) → emit 'opportunity'; engagedWith=null
```
※ Task 6 이전이므로 engagement의 기회 공격은 `damage.ts`의 `dealDamage` 시그니처를 먼저 만들어 두고(Task 6에서 완성) 호출한다. 이 Task에서는 `dealDamage`를 `src/sim/battle/damage.ts`에 최소 구현(hp 감소 + 'damage' 이벤트)으로 생성.

- [ ] **Step 1: 실패 테스트** `tests/sim/movement.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { setupFromPresets, createState } from '../../src/sim/battle/setup';
import { steerToward, moveUnits } from '../../src/sim/battle/movement';
import { dist, v } from '../../src/core/vec2';
const solo = () => createState(setupFromPresets(1, 'solo', 'empty'));
describe('movement', () => {
  it('moves toward destination at moveSpeed', () => {
    const s = solo(); const u = s.units[0]!; const start = { ...u.pos };
    for (let i = 0; i < 20; i++) { steerToward(u, v(0, 0), s, 0.1); moveUnits(s); }
    expect(dist(start, u.pos)).toBeCloseTo(3.2, 1);
  });
  it('never leaves the arena', () => {
    const s = solo(); const u = s.units[0]!;
    for (let i = 0; i < 200; i++) { steerToward(u, v(-50, 50), s, 0); moveUnits(s); }
    expect(u.pos.x).toBeGreaterThanOrEqual(-12); expect(u.pos.y).toBeLessThanOrEqual(7);
  });
  it('is pushed out of obstacles', () => {
    const s = solo(); s.obstacles = [{ pos: v(-3, -1.5), radius: 1, kind: 'rock' }]; const u = s.units[0]!;
    for (let i = 0; i < 100; i++) { steerToward(u, v(0, -1.5), s, 0.1); moveUnits(s); expect(dist(u.pos, v(-3, -1.5))).toBeGreaterThanOrEqual(1 + 0.45 - 1e-6); }
  });
  it('separates overlapping allies', () => {
    const s = createState(setupFromPresets(1, 'standard', 'empty')); const [a, b] = s.units;
    a!.pos = v(0, 0); b!.pos = v(0.1, 0);
    for (let i = 0; i < 20; i++) moveUnits(s);
    expect(dist(a!.pos, b!.pos)).toBeGreaterThan(0.6);
  });
  it('does not move while acting or stunned', () => {
    const s = solo(); const u = s.units[0]!; const p = { ...u.pos };
    u.tags.push({ tag: 'stun', ticksLeft: 10, value: 0, srcId: 'x' });
    steerToward(u, v(0, 0), s, 0); moveUnits(s); expect(u.pos).toEqual(p);
  });
});
```
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현 → **Step 4:** `npx vitest run && npm run lint && npm run typecheck` PASS
- [ ] **Step 5:** `git add -A && git commit -m "Add steering movement, obstacles, separation, and engagement"`

---

### Task 6: 피해·행동 3단계·기본 공격·쓰러짐

**Files:** Create/complete `src/sim/battle/{damage,actions}.ts`; Modify `battle.ts`; Test `tests/sim/damage.test.ts`, `tests/sim/actions.test.ts`

**Interfaces — Produces:**
```ts
// damage.ts
export function computeDamage(atk: number, mult: number, def: number, crit: boolean, otherMult: number): number; // max(1, round(atk*mult*100/(100+def)*(crit?1.5:1)*otherMult))
export interface HitOpts { mult: number; canDodge: boolean; canCrit: boolean; skillId: string; reason?: string }
export function dealDamage(s: BattleState, src: UnitState, dst: UnitState, opts: HitOpts): number; // 실제 피해량 반환(회피 시 0)
// 순서: 회피 판정(canDodge && rng.chance(dst dodge)) → emit 'miss', dst.stats.dodges++ → return 0
//  치명(rng.chance(src crit)) → computeDamage(…, Π damageModifiers) → 보호막 먼저 차감 → hp 감소
//  기세: src += dmg/dst.maxHp*40, dst += dmg/dst.maxHp*60 (MOMENTUM_MAX 상한)
//  threat: dst.threat[src.id] += dmg
//  emit 'damage' {src,dst,amount,crit,skillId}; src.stats.damageDealt += dmg
//  쓰러진 아군이 맞으면 hp 대신 lifeline 감소, lifeline ≤ 0 → killUnit
//  hp ≤ 0: ally → downUnit, enemy → killUnit (src.stats.kills++)
export function heal(s: BattleState, src: UnitState, dst: UnitState, amount: number, skillId: string): number; // 쓰러짐/사망 대상 불가, maxHp 상한, emit 'heal'
export function downUnit(s: BattleState, u: UnitState, by: UnitState | null): void; // downed=true, hp=0, lifeline=maxHp*LIFELINE_PCT, action/forced/tags(shield 제외 전부) 정리, emit 'downed'
export function killUnit(s: BattleState, u: UnitState, by: UnitState | null): void; // alive=false, downed=false, 관련 telegraph(시전자) 제거, emit 'died'
// actions.ts
export function startAction(s: BattleState, u: UnitState, skillId: string, targetId?: string, targetPos?: Vec2): void;
// - phase windup, ticksLeft = secToTicks(windup / (basic ? atkSpeed : 1)), facing → 목표
// - skill.telegraph면 createTelegraph(Task 7) 호출해 telegraphId 저장(이 Task에선 telegraph 없는 스킬만 테스트)
// - emit 'action_start' {src, dst, skillId}
export function advanceActions(s: BattleState): void;
// - 각 유닛 action.ticksLeft--; 0이 되면 다음 단계:
//   windup→active: 목표 유효성 검사(목표가 죽었거나 아군 대상 스킬인데 쓰러졌으면 취소 → emit 'action_cancel', action=null; telegraph 스킬은 취소하지 않음)
//                  → fireSkill(s, u, skill, target) (Task 7의 effects.fireSkill; 이 Task에서는 basic 근접/투사체 없는 dmg 효과만 처리하는 최소 버전) → cooldown 설정(cd × TICK_RATE), ultimate면 momentum=0
//   active→recovery, recovery→끝(action=null, decisionIn=0)
// - 행동 불가 태그(knockdown/stun)가 붙으면 action 즉시 취소(telegraph도 제거)
export function tickCooldowns(s: BattleState): void; // 모든 cooldowns 값 -1, 0 하한
export function isReady(u: UnitState, skillId: string): boolean; // cooldown 0 && (ultimate면 momentum ≥ 100)
```

- [ ] **Step 1: 실패 테스트** `tests/sim/damage.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { computeDamage, dealDamage } from '../../src/sim/battle/damage';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
const duel = () => { const s = createState(setupFromPresets(5, 'solo', 'tutorial')); return { s, a: s.units[0]!, e: s.units[1]! }; };
describe('damage', () => {
  it('follows the formula with floor of 1', () => {
    expect(computeDamage(20, 1, 100, false, 1)).toBe(10);
    expect(computeDamage(20, 1, 0, true, 1)).toBe(30);
    expect(computeDamage(1, 0.1, 500, false, 1)).toBe(1);
  });
  it('kills enemies outright and downs allies', () => {
    const { s, a, e } = duel();
    e.hp = 1; dealDamage(s, a, e, { mult: 10, canDodge: false, canCrit: false, skillId: 'test' });
    expect(e.alive).toBe(false); expect(s.events.some((x) => x.type === 'died')).toBe(true);
    a.hp = 1; dealDamage(s, e, a, { mult: 10, canDodge: false, canCrit: false, skillId: 'test' });
    expect(a.alive).toBe(true); expect(a.downed).toBe(true); expect(a.lifeline).toBe(a.maxHp * 0.5);
  });
  it('drains lifeline when downed and then dies', () => {
    const { s, a, e } = duel(); a.hp = 1; dealDamage(s, e, a, { mult: 10, canDodge: false, canCrit: false, skillId: 't' });
    for (let i = 0; i < 50 && a.alive; i++) dealDamage(s, e, a, { mult: 5, canDodge: false, canCrit: false, skillId: 't' });
    expect(a.alive).toBe(false);
  });
  it('shield absorbs first, momentum grows, threat accrues', () => {
    const { s, a, e } = duel(); a.shield = 1000; const hp = a.hp;
    dealDamage(s, e, a, { mult: 1, canDodge: false, canCrit: false, skillId: 't' });
    expect(a.hp).toBe(hp); expect(a.momentum).toBeGreaterThan(0); expect(a.threat[e.id]).toBeGreaterThan(0);
  });
});
```
`tests/sim/actions.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { startAction, advanceActions } from '../../src/sim/battle/actions';
import { v } from '../../src/core/vec2';
describe('actions', () => {
  it('runs windup → active (hit) → recovery → done', () => {
    const s = createState(setupFromPresets(5, 'solo', 'tutorial')); const a = s.units[0]!, e = s.units[1]!;
    a.pos = v(0, 0); e.pos = v(1, 0); const hp = e.hp;
    startAction(s, a, 'novice_slash', e.id);
    let ticks = 0; while (a.action && ticks < 100) { advanceActions(s); ticks++; }
    expect(e.hp).toBeLessThan(hp); expect(ticks).toBe(Math.round(0.35 * 20) + Math.round(0.1 * 20) + Math.round(0.45 * 20));
  });
  it('cancels when the target dies during windup', () => {
    const s = createState(setupFromPresets(5, 'solo', 'tutorial')); const a = s.units[0]!, e = s.units[1]!;
    startAction(s, a, 'novice_slash', e.id); e.alive = false;
    for (let i = 0; i < 20; i++) advanceActions(s);
    expect(s.events.some((x) => x.type === 'action_cancel')).toBe(true); expect(a.action).toBeNull();
  });
  it('stun interrupts an action', () => {
    const s = createState(setupFromPresets(5, 'solo', 'tutorial')); const a = s.units[0]!, e = s.units[1]!;
    startAction(s, a, 'novice_slash', e.id); a.tags.push({ tag: 'stun', ticksLeft: 5, value: 0, srcId: e.id });
    advanceActions(s); expect(a.action).toBeNull();
  });
});
```
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** 전체 테스트·lint·typecheck PASS
- [ ] **Step 5:** `git add -A && git commit -m "Add damage formula, downed/lifeline, and three-phase actions"`

---

### Task 7: 효과·반응·태그·영역·위험 범위·투사체

**Files:** Create `src/sim/battle/{effects,tags,areas,telegraphs,projectiles}.ts`; Modify `actions.ts`(fireSkill 위임), `battle.ts`; Test `tests/sim/effects.test.ts`, `tests/sim/telegraphs.test.ts`

**Interfaces — Produces:**
```ts
// areas.ts
export function inArea(area: AreaShape, origin: Vec2, dir: Vec2, p: Vec2, mult: number): boolean; // circle: dist ≤ r*mult; cone: dist ≤ r*mult && 각도 ≤ angleDeg/2; line: origin에서 dir 방향 0..length*mult, 수직거리 ≤ width*mult/2. 유닛 반경 UNIT_RADIUS만큼 관대하게.
export function areaOrigin(area: AreaShape, caster: UnitState, target: UnitState | undefined, targetPos: Vec2 | undefined): Vec2; // circle center self → caster.pos, target → target.pos/targetPos, cone/line → caster.pos
// tags.ts
export function addTag(s: BattleState, dst: UnitState, tag: TagId, durationSec: number, value: number, srcId: string): void; // 같은 태그면 지속시간 max로 갱신, emit 'tag_add'
export function hasTag(u: UnitState, tag: TagId): boolean;
export function removeTag(s: BattleState, u: UnitState, tag: TagId): void; // emit 'tag_remove'
export function tickTags(s: BattleState): void; // ticksLeft--, 0이면 제거; burn: 매 20틱 value×시전자 atk 피해(canDodge false); bleed: 이동 중일 때만 매 20틱; shield 태그 만료 시 u.shield=0
export function isActionBlocked(u: UnitState): boolean;
// effects.ts
export function fireSkill(s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState | undefined, targetPos: Vec2 | undefined): void;
// - projectile 있으면 spawnProjectile 후 return(명중 시 applyToTargets)
// - telegraph 스킬은 telegraphs.ts가 발동 시 applyToTargets 호출(fireSkill에서는 아무것도 안 함)
// - area 있으면 inArea로 대상 수집(target 종류 enemy→적팀, ally→아군팀(쓰러짐 제외), self→자신), 없으면 단일 target
// - selfEffects는 시전자에게 적용
export function applyToTargets(s: BattleState, caster: UnitState, skill: SkillDef, targets: UnitState[]): void;
// 대상별: reacts 먼저 검사(대상에 태그 있으면 반응 effects 실행, consume이면 태그 제거, emit 'combo' {src,dst,skillId,tag}) → 기본 effects 실행
export function applyEffect(s: BattleState, caster: UnitState, dst: UnitState, ef: Effect, skill: SkillDef): void;
// damage: dealDamage(mult, canDodge = !skill.area && !skill.telegraph, canCrit true)
// heal: heal(mult × caster atk); addTag: addTag(…, value ?? 0); knockback: dst.forced = {vel: norm(dst-caster)×distance/0.2s, ticksLeft 4, kind 'knockback'}
// dash: caster.forced = 목표 방향, 거리 = min(distance, dist-stopShort), 4틱
// shield: dst.shield += pctMaxHp×dst.maxHp, addTag shield duration; taunt: dst.threat[caster.id] = 1e6, addTag taunted duration srcId caster
// cleanse: 부정적 태그 전부 제거; summon: caster 주변 원형 배치로 enemyFromDef(…, summoned=true) 추가, emit 'summon'
// telegraphs.ts
export function createTelegraph(s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState | undefined, targetPos: Vec2 | undefined): number; // origin 고정(시전 시점), firesAt = tick + windupTicks, areaMult = 보스 페이즈 areaMult, emit 'telegraph_start'
export function updateTelegraphs(s: BattleState): void; // firesAt 도달 시: 시전자가 살아있으면 영역 내 대상에 applyToTargets, emit 'telegraph_fire', 제거. 시전자 죽으면 제거만.
export function telegraphThreatFor(u: UnitState, s: BattleState): { tel: Telegraph; ticksLeft: number } | null; // u가 들어있는 적 telegraph 중 가장 임박한 것
// projectiles.ts
export function spawnProjectile(s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState): void; // emit 'projectile'
export function updateProjectiles(s: BattleState): void; // 목표 추적 이동(speed×DT), 0.3m 내 도달 시: 단일이면 applyToTargets([target]), area(circle center target)면 명중 지점 기준 영역 대상; 목표가 죽었거나(쓰러진 아군은 유효) 사라지면 소멸 emit 'projectile_fizzle'
```

- [ ] **Step 1: 실패 테스트** `tests/sim/effects.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { applyToTargets } from '../../src/sim/battle/effects';
import { addTag, hasTag, tickTags } from '../../src/sim/battle/tags';
import { updateProjectiles, spawnProjectile } from '../../src/sim/battle/projectiles';
import { getSkill } from '../../src/data/skills';
import { v } from '../../src/core/vec2';
const party = () => { const s = createState(setupFromPresets(9, 'elemental', 'bandits')); const by = (id: string) => s.units.find((u) => u.setup.defId === id)!; return { s, by }; };
describe('effects & reactions', () => {
  it('wet + judgment triggers combo, consumes wet, stuns', () => {
    const { s, by } = party(); const priest = by('priest'), foe = by('bandit_cutthroat');
    addTag(s, foe, 'wet', 6, 0, 'x'); const hp = foe.hp;
    applyToTargets(s, priest, getSkill('judgment'), [foe]);
    expect(hasTag(foe, 'wet')).toBe(false); expect(hasTag(foe, 'stun')).toBe(true);
    expect(s.events.some((e) => e.type === 'combo' && e.tag === 'wet')).toBe(true);
    expect(hp - foe.hp).toBeGreaterThan(0);
  });
  it('same skill without the tag deals less and no combo', () => {
    const a = party(), b = party();
    const fa = a.by('bandit_cutthroat'), fb = b.by('bandit_cutthroat');
    addTag(a.s, fa, 'wet', 6, 0, 'x');
    a.s.rng = b.s.rng; // 동일 난수 흐름이 아닐 수 있으므로 치명 영향을 없애기 위해 crit 0
    a.by('priest').setup.stats.crit = 0; b.by('priest').setup.stats.crit = 0;
    applyToTargets(a.s, a.by('priest'), getSkill('judgment'), [fa]); applyToTargets(b.s, b.by('priest'), getSkill('judgment'), [fb]);
    expect(fa.maxHp - fa.hp).toBeGreaterThan(fb.maxHp - fb.hp); expect(b.s.events.some((e) => e.type === 'combo')).toBe(false);
  });
  it('burn ticks damage each second and expires', () => {
    const { s, by } = party(); const foe = by('bandit_archer'); addTag(s, foe, 'burn', 2, 0.2, by('mage').id); const hp = foe.hp;
    for (let i = 0; i < 45; i++) tickTags(s);
    expect(foe.hp).toBeLessThan(hp); expect(hasTag(foe, 'burn')).toBe(false);
  });
  it('projectile fizzles if target dies', () => {
    const { s, by } = party(); const mage = by('mage'), foe = by('bandit_hexer'); mage.pos = v(-8, 0); foe.pos = v(8, 0);
    spawnProjectile(s, mage, getSkill('arcane_bolt'), foe); foe.alive = false;
    updateProjectiles(s); expect(s.projectiles).toHaveLength(0); expect(s.events.some((e) => e.type === 'projectile_fizzle')).toBe(true);
  });
  it('shield and cleanse', () => {
    const { s, by } = party(); const w = by('warrior'), p = by('priest');
    applyToTargets(s, w, getSkill('bulwark'), [p]); expect(p.shield).toBeGreaterThan(0);
    addTag(s, p, 'slow', 5, 0, 'x'); applyToTargets(s, p, getSkill('sanctuary'), [p]); expect(hasTag(p, 'slow')).toBe(false);
  });
});
```
`tests/sim/telegraphs.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { createTelegraph, updateTelegraphs } from '../../src/sim/battle/telegraphs';
import { inArea } from '../../src/sim/battle/areas';
import { getSkill } from '../../src/data/skills';
import { v } from '../../src/core/vec2';
describe('telegraphs & areas', () => {
  it('area shapes', () => {
    expect(inArea({ shape: 'circle', radius: 2, center: 'target' }, v(0, 0), v(1, 0), v(2.3, 0), 1)).toBe(true); // 반경+유닛반경
    expect(inArea({ shape: 'cone', radius: 2, angleDeg: 90 }, v(0, 0), v(1, 0), v(0, 1.5), 1)).toBe(false);
    expect(inArea({ shape: 'line', length: 8, width: 1 }, v(0, 0), v(1, 0), v(6, 0.6), 1)).toBe(true);
    expect(inArea({ shape: 'line', length: 8, width: 1 }, v(0, 0), v(1, 0), v(-1, 0), 1)).toBe(false);
  });
  it('fires at the locked position: units that left are safe', () => {
    const s = createState(setupFromPresets(2, 'standard', 'boss')); const boss = s.units.find((u) => u.setup.boss)!;
    const [a, b] = s.units.filter((u) => u.team === 'ally'); a!.pos = v(0, 0); b!.pos = v(0.5, 0);
    createTelegraph(s, boss, getSkill('crushing_slam'), a, undefined);
    b!.pos = v(6, 6); const hpA = a!.hp, hpB = b!.hp;
    for (let i = 0; i < 40; i++) { updateTelegraphs(s); s.tick++; }
    expect(a!.hp).toBeLessThan(hpA); expect(b!.hp).toBe(hpB);
  });
});
```
- [ ] **Step 2:** FAIL → **Step 3:** 구현(actions.fireSkill 최소 버전을 effects.fireSkill로 교체) → **Step 4:** 전체 PASS
- [ ] **Step 5:** `git add -A && git commit -m "Add effects, tag reactions, areas, telegraphs, and projectiles"`

---

### Task 8: 유틸리티 AI·전술·의도(근거)

**Files:** Create `src/sim/battle/ai/{candidates,considerations,tactics,decide}.ts`; Modify `battle.ts`(decide 단계); Test `tests/sim/ai.test.ts`

**Interfaces — Produces:**
```ts
// candidates.ts
export type CandidateKind = 'skill' | 'approach' | 'kite' | 'dodge' | 'rescue' | 'guard' | 'retreat' | 'idle';
export interface Candidate { kind: CandidateKind; skillId?: string; target?: UnitState; dest?: Vec2; inRange?: boolean }
export function generateCandidates(u: UnitState, s: BattleState): Candidate[];
// - 준비된 스킬(isReady) × 유효 대상: enemy 스킬 → 살아있는 적 전부(taunted면 도발자만); ally → 살아있고 안 쓰러진 아군(자신 포함); self → 자신
//   거리 > range면 inRange=false (선택 시 approach로 처리)
// - kite: 원거리(range ≥ 4)이고 가장 가까운 적이 range×0.4 이내 → dest = 그 적 반대 방향 3m (useCover 전술이면 가장 가까운 장애물 뒤쪽 지점)
// - dodge: telegraphThreatFor가 있고 ticksLeft ≤ 15 → dest = 영역 밖으로 나가는 최단 지점(원: 중심 반대 방향 r*mult+0.8, 직선/부채꼴: dir의 수직 방향 width/2+0.8)
// - rescue: 아군(ally 팀)만, 쓰러졌고 rescueUsed=false인 아군마다
// - guard: guardBack 전술 보유 시, 후열 아군을 노리는(intent.targetId) 적마다 → dest = 그 적과 후열 아군 사이 지점
// - 항상 idle 1개
// considerations.ts
export interface Ctx { u: UnitState; s: BattleState; eff: Stats }
export interface Consideration { id: string; score(c: Candidate, ctx: Ctx): number; reason?: string } // reason: ko.reason 키, 점수 기여가 가장 큰 항목이 근거가 됨
export const considerations: Consideration[];
export function registerConsideration(c: Consideration): void; // Plan 2 확장 지점
// 기본 고려 요소(id: 점수 규칙):
// baseValue: skill → SkillDef.aiValue; approach 계열(inRange=false) → aiValue×0.6; kite 25; dodge 0(아래 danger가 담당); rescue 30; guard 15; idle 1; retreat 0
// distance: skill/approach → -1.5 × max(0, dist - range)
// lowHp (reason 'focusLow'): enemy 대상 → (1 - hp/maxHp) × 15
// healNeed (reason 'heal'): hints heal → 대상 hp비 > 0.85면 -100, 아니면 (1-hp비)×60; area heal은 영역 내 부상 아군 수 × 10 추가
// aoeCount: hints aoe → (영역 내 적 수 - 1) × 12 (영역 내 적 0이면 -100)
// tagReaction (reason 'combo'): 스킬 reacts의 tag를 대상이 갖고 있으면 +30
// tagRedundancy: addTag 효과의 태그를 이미 대상이 가짐 → -15
// stickiness: 현재 intent.targetId와 같으면 +8
// engagedSwitch: engagedWith가 있고 다른 대상이면 -10
// danger (reason 'dodge'): dodge 후보 → +80; 다른 후보는 telegraph 위협 중이면 -40
// threat (reason 'threat', 적 팀만): enemy 대상 → min(30, threat[target]/maxHp×50)
// shieldNeed: hints shield → 영역 내 아군 평균 hp비가 0.7 미만이면 +25, 아니면 -20
// rescueValue (reason 'rescue'): rescue → 주변 3m 적 수 × -8, 대상이 isLeader면 +15
// ultimateGate: ultimate 스킬 → 적 수 ≥ 2 또는 보스 대상이면 +10
// tactics.ts — 전술별 Consideration(reason 키 병기), 보유한 전술만 적용
// weakHunt(focusLow): lowHp 기여를 한 번 더(+ (1-hp비)×15) / casterHunt(focusCaster): 대상 role caster|ranged|support면 +25
// markHunt(focusMarked): 대상 marked면 +25 / vanguard: 가장 가까운 적 대상 +10, hints gapClose +15
// keepDistance(kite): kite +30 / dangerFirst(dodge): dodge +40 / rescueDowned(rescue): rescue +40
// guardBack(protectBack): guard +30, 후열 아군을 노리는 적 대상 +20 / useCover(cover): 원거리일 때 kite dest가 장애물 뒤(+10)
// followLeader(followLeader): 리더의 intent.targetId와 같은 대상 +30
// decide.ts
export function decide(s: BattleState): void;
// - 결정 대상: alive && !downed && !action && !forced && !isActionBlocked && decisionIn ≤ 0. decisionIn = DECISION_INTERVAL로 재설정.
//   (행동 없이 이동 중인 유닛도 매 5틱마다 재결정)
// - 후퇴 명령 중이면 intent retreat(dest = 자기 진영 끝 x=±12), 점수 계산 생략
// - 모든 후보 점수 = Σ consideration; 최고점 선택(동점이면 후보 생성 순서). 근거 = 가장 큰 양의 기여를 한 consideration의 reason(없으면 kind 기본 키), detail = 기여 상위 3개 reason
// - 실행: skill+inRange → startAction / skill+!inRange → intent approach + steerToward(target, range×0.9) /
//   kite·dodge·guard → steerToward(dest) (dodge이고 rogue 또는 dangerFirst면 forced roll: 0.3초 6m/s, emit 'dodge_roll') /
//   rescue → steerToward(target, RESCUE_RANGE×0.8), u.rescueTarget = target.id / idle → vel 0
// - intent가 바뀌면 emit 'intent' {src, reason, data:{kind, targetId}}
```

- [ ] **Step 1: 실패 테스트** `tests/sim/ai.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { Battle } from '../../src/sim/battle/battle';
import { createTelegraph } from '../../src/sim/battle/telegraphs';
import { addTag } from '../../src/sim/battle/tags';
import { decide } from '../../src/sim/battle/ai/decide';
import { getSkill } from '../../src/data/skills';
import { dist, v } from '../../src/core/vec2';
const ready = (s: ReturnType<typeof createState>) => s.units.forEach((u) => { u.decisionIn = 0; });
describe('utility AI', () => {
  it('melee approaches the nearest enemy with a reason', () => {
    const s = createState(setupFromPresets(3, 'solo', 'tutorial')); ready(s); decide(s);
    const me = s.units[0]!; expect(['approach', 'skill']).toContain(me.intent?.kind); expect(me.intent?.reason).toBeTruthy();
  });
  it('steps out of a telegraph about to fire', () => {
    const s = createState(setupFromPresets(3, 'standard', 'boss')); const boss = s.units.find((u) => u.setup.boss)!;
    const w = s.units.find((u) => u.setup.defId === 'warrior')!; w.pos = v(0, 0); boss.pos = v(2, 0);
    createTelegraph(s, boss, getSkill('crushing_slam'), w, undefined);
    s.tick += 20; ready(s); decide(s); expect(w.intent?.kind).toBe('dodge');
  });
  it('mage prefers a combo target (wet) for thunderstorm-like reactions', () => {
    const s = createState(setupFromPresets(3, 'elemental', 'bandits')); const priest = s.units.find((u) => u.setup.defId === 'priest')!;
    const foes = s.units.filter((u) => u.team === 'enemy'); priest.pos = v(0, 0); foes.forEach((f, i) => { f.pos = v(3, i - 2); });
    addTag(s, foes[3]!, 'wet', 6, 0, 'x'); priest.cooldowns = {}; s.units.forEach((u) => { if (u !== priest) u.decisionIn = 99; }); priest.decisionIn = 0;
    decide(s); expect(priest.intent?.targetId).toBe(foes[3]!.id); expect(priest.intent?.skillId).toBe('judgment');
  });
  it('priest heals a wounded ally over attacking', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits')); const p = s.units.find((u) => u.setup.defId === 'priest')!;
    const w = s.units.find((u) => u.setup.defId === 'warrior')!; w.hp = w.maxHp * 0.3; p.pos = v(-6, 0); w.pos = v(-3, 0);
    s.units.forEach((u) => { u.decisionIn = u === p ? 0 : 99; }); decide(s);
    expect(p.intent?.skillId).toBe('heal'); expect(p.intent?.targetId).toBe(w.id);
  });
  it('ranged with keepDistance kites a close enemy', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits')); const x = s.units.find((u) => u.setup.defId === 'crossbow')!;
    const foe = s.units.find((u) => u.team === 'enemy')!; x.pos = v(0, 0); foe.pos = v(1.5, 0);
    s.units.forEach((u) => { u.decisionIn = u === x ? 0 : 99; }); decide(s); expect(x.intent?.kind).toBe('kite');
  });
  it('allies try to rescue a downed friend', () => {
    const s = createState(setupFromPresets(3, 'standard', 'tutorial')); const [a, b] = s.units.filter((u) => u.team === 'ally');
    a!.downed = true; a!.hp = 0; a!.lifeline = 50; a!.pos = v(-4, 0); b!.pos = v(-5, 0);
    s.units.filter((u) => u.team === 'enemy').forEach((e) => { e.pos = v(10, 6); });
    s.units.forEach((u) => { u.decisionIn = u === b ? 0 : 99; }); b!.setup.tactics = ['rescueDowned']; decide(s);
    expect(b!.intent?.kind).toBe('rescue');
  });
  it('taunted enemies only target the taunter', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits')); const w = s.units.find((u) => u.setup.defId === 'warrior')!;
    const foe = s.units.find((u) => u.setup.defId === 'bandit_cutthroat')!; addTag(s, foe, 'taunted', 3, 0, w.id); foe.threat[w.id] = 1e6;
    s.units.forEach((u) => { u.decisionIn = u === foe ? 0 : 99; }); decide(s); expect(foe.intent?.targetId).toBe(w.id);
  });
  it('a full battle produces intents and ends', () => {
    const b = new Battle(setupFromPresets(11, 'standard', 'bandits')); let n = 0;
    while (!b.outcome && n < 20 * 300) { b.step(); n++; }
    expect(b.outcome).not.toBeNull(); expect(dist(v(0, 0), v(0, 0))).toBe(0);
  });
});
```
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** 전체 PASS
- [ ] **Step 5:** `git add -A && git commit -m "Add utility AI with considerations registry, tactics, and intent reasons"`

---

### Task 9: 전투 규칙 마무리·결정론·밸런스 스모크

**Files:** Create `src/sim/battle/{rescue,rules}.ts`; Modify `battle.ts`; Test `tests/sim/rules.test.ts`, `tests/sim/determinism.test.ts`, `tests/sim/balance.test.ts`

**Interfaces — Produces:**
```ts
// rescue.ts
export function updateRescue(s: BattleState): void; // rescueTarget이 있고 RESCUE_RANGE 내이며 행동 중이 아니면 rescueProgress++ (emit 'rescue_progress'는 10틱마다); RESCUE_TICKS 도달 시 대상 hp=maxHp×0.25, downed=false, rescueUsed=true, emit 'rescued' {src,dst}; 거리 벗어나면 progress 0
// rules.ts
export function processCommands(s: BattleState): void; // retreat → outcome 'retreat', emit 'battle_end'
export function updateRules(s: BattleState): void; // tick ≥ BERSERK_TICK: berserkMult = 1.5 + 0.25 × floor((tick-BERSERK_TICK)/BERSERK_STEP_TICKS); 단계 변화 시 emit 'berserk'
//   보스 페이즈: hp/maxHp < phases[phaseIndex].hpBelow → phaseIndex++, emit 'phase' {src, data:{index}}
export function checkOutcome(s: BattleState): void;
```

- [ ] **Step 1: 실패 테스트**

`tests/sim/rules.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { Battle, runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets, createState } from '../../src/sim/battle/setup';
import { updateRescue } from '../../src/sim/battle/rescue';
import { updateRules } from '../../src/sim/battle/rules';
import { v } from '../../src/core/vec2';
describe('rules', () => {
  it('rescue revives once at 25% after 2s', () => {
    const s = createState(setupFromPresets(1, 'standard', 'empty')); const [a, b] = s.units;
    a!.downed = true; a!.hp = 0; a!.lifeline = 40; a!.pos = v(0, 0); b!.pos = v(0.5, 0); b!.rescueTarget = a!.id;
    for (let i = 0; i < 40; i++) updateRescue(s);
    expect(a!.downed).toBe(false); expect(a!.hp).toBe(Math.round(a!.maxHp * 0.25)); expect(a!.rescueUsed).toBe(true);
  });
  it('berserk ramps after 90s', () => {
    const s = createState(setupFromPresets(1, 'solo', 'tutorial')); s.tick = 90 * 20; updateRules(s); expect(s.berserkMult).toBe(1.5);
    s.tick = 110 * 20; updateRules(s); expect(s.berserkMult).toBe(2.0);
  });
  it('boss enters phase 2 below 50%', () => {
    const s = createState(setupFromPresets(1, 'standard', 'boss')); const boss = s.units.find((u) => u.setup.boss)!;
    boss.hp = boss.maxHp * 0.49; updateRules(s); expect(boss.phaseIndex).toBe(1); expect(s.events.some((e) => e.type === 'phase')).toBe(true);
  });
  it('retreat command ends the battle', () => {
    const r = runHeadless(setupFromPresets(1, 'standard', 'bandits'), [{ tick: 30, cmd: { type: 'retreat' } }]);
    expect(r.outcome).toBe('retreat'); expect(r.ticks).toBeLessThanOrEqual(32);
  });
  it('step after outcome is a no-op', () => {
    const b = new Battle(setupFromPresets(1, 'solo', 'empty')); b.step(); const t = b.state.tick; b.step(); expect(b.state.tick).toBe(t);
  });
});
```

`tests/sim/determinism.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
describe('determinism', () => {
  for (const [a, e] of [['standard', 'bandits'], ['elemental', 'skeletons'], ['standard', 'boss']] as const) {
    it(`${a} vs ${e} replays identically`, () => {
      const r1 = runHeadless(setupFromPresets(1234, a, e)), r2 = runHeadless(setupFromPresets(1234, a, e));
      expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events)); expect(r1.outcome).toBe(r2.outcome);
    });
  }
  it('different seeds diverge', () => {
    const r1 = runHeadless(setupFromPresets(1, 'standard', 'bandits')), r2 = runHeadless(setupFromPresets(2, 'standard', 'bandits'));
    expect(JSON.stringify(r1.events)).not.toBe(JSON.stringify(r2.events));
  });
});
```

`tests/sim/balance.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
const sweep = (a: string, e: string, n: number) => {
  let wins = 0, maxTicks = 0, under90 = 0; const kinds = new Set<string>();
  for (let seed = 0; seed < n; seed++) {
    const r = runHeadless(setupFromPresets(seed, a, e)); if (r.outcome === 'victory') wins++;
    maxTicks = Math.max(maxTicks, r.ticks); if (r.ticks <= 90 * 20) under90++; r.events.forEach((x) => kinds.add(x.type));
  }
  return { rate: wins / n, maxTicks, under90: under90 / n, kinds };
};
describe('balance smoke', () => {
  it('standard party beats bandits most of the time, quickly', () => {
    const r = sweep('standard', 'bandits', 60); expect(r.rate).toBeGreaterThanOrEqual(0.6); expect(r.under90).toBeGreaterThanOrEqual(0.8);
  });
  it('lone novice vs tutorial is winnable but not free', () => {
    const r = sweep('solo', 'tutorial', 60); expect(r.rate).toBeGreaterThanOrEqual(0.3); expect(r.rate).toBeLessThanOrEqual(0.97);
  });
  it('every battle terminates and exercises core mechanics', () => {
    const r = sweep('elemental', 'skeletons', 40); expect(r.maxTicks).toBeLessThanOrEqual(300 * 20);
    for (const k of ['damage', 'downed', 'tag_add', 'telegraph_fire', 'projectile', 'intent']) expect(r.kinds.has(k), k).toBe(true);
  });
  it('boss fight terminates', () => { expect(sweep('standard', 'boss', 10).maxTicks).toBeLessThanOrEqual(300 * 20); });
});
```
- [ ] **Step 2:** FAIL → **Step 3:** 구현. balance 실패 시 **데이터 수치만** 조정(적 stage, hp/atk ±20% 범위)하고 조정 내역을 커밋 메시지에 기록.
- [ ] **Step 4:** `npm test && npm run lint && npm run typecheck` PASS (vitest 전체 30초 이내 목표)
- [ ] **Step 5:** `git add -A && git commit -m "Add rescue, berserk, boss phases, retreat; determinism and balance smoke tests"`

---

### Task 10: KayKit 에셋 파이프라인·액터

**Files:** Create `scripts/prepare-assets.mjs`, `public/assets/ART.md`, `public/assets/models/**`(생성물 커밋), `src/view/actors/{assets,modelManifest,animMap,actorFactory,actor}.ts`; Test `tests/unit/animMap.test.ts`, `tests/unit/modelManifest.test.ts`

**에셋 준비 스크립트 동작(`npm run assets`):**
1. 고정 리비전에서 다운로드해 `.asset-cache/`에 저장:
   - Adventurers `672074b73ba276876a19e8816ecdc5241817ab47`: `Characters/gltf/{Knight,Barbarian,Mage,Rogue,Rogue_Hooded}.glb`
   - Skeletons `15b62b9bad122f72926c10fb14d622c73819fa54`: `Characters/gltf/Skeleton_{Warrior,Mage,Rogue,Minion}.glb`
   - URL 형식: `https://raw.githubusercontent.com/KayKit-Game-Assets/<repo>/<rev>/addons/<addon>/Characters/gltf/<file>`
2. `@gltf-transform/core`(NodeIO)로 각 캐릭터: 모든 애니메이션 제거 → `prune()` → `public/assets/models/characters/<Model>.glb`.
3. 애니메이션 라이브러리 2개: `anims-adventurer.glb`(Knight.glb 기반), `anims-skeleton.glb`(Skeleton_Warrior.glb 기반) — 메시를 가진 노드에서 mesh 분리(`node.setMesh(null)`), 아래 목록 외 애니메이션 제거 → `prune()`.
   - 공통 유지: `Idle, 2H_Melee_Idle, Running_A, Walking_Backwards, 1H_Melee_Attack_Chop, 1H_Melee_Attack_Stab, 2H_Melee_Attack_Chop, 2H_Melee_Attack_Spin, Dualwield_Melee_Attack_Slice, 1H_Ranged_Shoot, 2H_Ranged_Shoot, Spellcast_Shoot, Spellcast_Raise, Spellcast_Long, Block, Hit_A, Dodge_Left, Dodge_Right, Dodge_Backward, Death_A, Lie_Idle, Lie_StandUp, Cheer, Throw`
   - 스켈레톤 추가: `Spawn_Ground_Skeletons, Taunt, 1H_Melee_Attack_Jump_Chop, Idle_Combat`
4. 각 캐릭터의 메시 노드 이름 목록을 `public/assets/models/manifest.json`에 기록(`{ "<Model>": ["Knight_Helmet", ...] }`).
5. 결과 총 용량을 출력. 목표 ≤ 12MB.

`public/assets/ART.md`: KayKit Adventurers/Skeletons 출처 URL, 고정 리비전, CC0 1.0, 가공 내용(애니메이션 분리·선별).

**Interfaces — Produces:**
```ts
// animMap.ts
export type AnimSet = 'adventurer' | 'skeleton';
export const ANIM_CLIPS: Record<AnimSet, Record<AnimKey, string>>; // 모든 AnimKey 매핑 필수. 예: idle→'Idle'(skeleton: 'Idle_Combat'), run→'Running_A', attack1h→'1H_Melee_Attack_Chop', attackDual→'Dualwield_Melee_Attack_Slice', shoot2h→'2H_Ranged_Shoot', cast→'Spellcast_Shoot', castRaise→'Spellcast_Raise', castLong→'Spellcast_Long', block→'Block', hit→'Hit_A', dodgeL→'Dodge_Left', death→'Death_A', downed→'Lie_Idle', standUp→'Lie_StandUp', spawn→(adventurer 'Cheer', skeleton 'Spawn_Ground_Skeletons'), taunt→(adventurer 'Cheer', skeleton 'Taunt'), leapChop→(adventurer '2H_Melee_Attack_Chop', skeleton '1H_Melee_Attack_Jump_Chop'), walkBack→'Walking_Backwards', attack1hStab→'1H_Melee_Attack_Stab', attack2h→'2H_Melee_Attack_Chop', attack2hSpin→'2H_Melee_Attack_Spin', shoot1h→'1H_Ranged_Shoot', dodgeR→'Dodge_Right', dodgeB→'Dodge_Backward', cheer→'Cheer', throw→'Throw'
export const LOOPING: ReadonlySet<AnimKey>; // idle, run, walkBack, downed
// modelManifest.ts
export interface ModelInfo { file: string; animSet: AnimSet; weapons: Record<string, string>; offhands: Record<string, string>; helmet: string[]; cape: string[]; always: string[] }
export const MODELS: Record<ModelId, ModelInfo>;
// weapons/offhands: GearVisual의 논리 키('1H_Sword','Round_Shield','2H_Axe','Knife','Staff','Wand','Spellbook','2H_Crossbow','1H_Crossbow','Blade','Axe','Crossbow','Shield_Small','Shield_Large','Knife_Offhand') → 실제 메시 노드명.
// manifest.json의 실제 노드명을 보고 작성. 해당 모델에 없는 키는 매핑하지 않음(→ 숨김).
// always: 몸통·머리 등 항상 보이는 메시. helmet/cape: 장비 플래그로 토글.
export function visibleMeshes(model: ModelId, gear: GearVisual): Set<string>; // always ∪ (helmet?) ∪ (cape?) ∪ weapon ∪ offhand
// assets.ts
export interface AssetLibrary { character(model: ModelId): THREE.Group; clips(set: AnimSet): Map<string, THREE.AnimationClip> }
export async function loadAssets(baseUrl: string, onProgress?: (p: number) => void): Promise<AssetLibrary>; // GLTFLoader, SkeletonUtils.clone; 실패 시 Error('asset-load-failed: <file>') throw
// actorFactory.ts / actor.ts
export interface ActorSpec { id: string; model: ModelId; gear: GearVisual; color: string; tint?: string; scale?: number; team: 'ally' | 'enemy' }
export class Actor {
  readonly root: THREE.Group; // 모델 + 발밑 개인색 링(RingGeometry, team enemy면 붉은 링)
  constructor(spec: ActorSpec, lib: AssetLibrary);
  play(key: AnimKey, opts?: { once?: boolean; fade?: number; speed?: number }): void; // once면 끝나고 idle/run으로 복귀
  setLocomotion(speed: number): void; // >0.3이면 run, 아니면 idle (once 애니메이션 재생 중엔 무시)
  flash(color: number, ms: number): void; // emissive 펄스
  setDowned(on: boolean): void; setDead(): void;
  update(dt: number): void; dispose(): void;
}
```

- [ ] **Step 1:** `npm run assets` 작성·실행, `manifest.json` 확인 후 `modelManifest.ts` 작성.
- [ ] **Step 2: 실패 테스트**

`tests/unit/animMap.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANIM_CLIPS } from '../../src/view/actors/animMap';
const clipNames = (file: string) => { const b = readFileSync(file); const len = b.readUInt32LE(12); return new Set<string>(JSON.parse(b.subarray(20, 20 + len).toString()).animations.map((a: { name: string }) => a.name)); };
describe('anim map', () => {
  it('every mapped clip exists in its library', () => {
    for (const [set, map] of Object.entries(ANIM_CLIPS)) {
      const names = clipNames(`public/assets/models/anims-${set}.glb`);
      for (const [key, clip] of Object.entries(map)) expect(names.has(clip), `${set}.${key}=${clip}`).toBe(true);
    }
  });
});
```
`tests/unit/modelManifest.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODELS, visibleMeshes } from '../../src/view/actors/modelManifest';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
const manifest = JSON.parse(readFileSync('public/assets/models/manifest.json', 'utf8')) as Record<string, string[]>;
describe('model manifest', () => {
  it('references only real mesh nodes', () => {
    for (const [id, m] of Object.entries(MODELS)) {
      const real = new Set(manifest[id]); const all = [...m.always, ...m.helmet, ...m.cape, ...Object.values(m.weapons), ...Object.values(m.offhands)];
      for (const n of all) expect(real.has(n), `${id}:${n}`).toBe(true);
    }
  });
  it('every class and enemy shows its main weapon', () => {
    for (const d of [...Object.values(CLASSES), ...Object.values(ENEMIES)]) {
      const vis = visibleMeshes(d.model, d.gear); expect(vis.has(MODELS[d.model].weapons[d.gear.weapon]!), `${d.id}`).toBe(true);
    }
  });
});
```
- [ ] **Step 3:** FAIL 확인 → `animMap.ts`, `modelManifest.ts`, `assets.ts`, `actor.ts`, `actorFactory.ts` 구현. 모델에 원하는 무기가 없으면(예: Mage에 Wand가 없음) `data/classes.ts`·`enemies.ts`의 gear 키를 그 모델에 실제 있는 무기로 바꾼다.
- [ ] **Step 4:** `npm test && npm run lint && npm run typecheck && npm run build` PASS, `du -sh public/assets` ≤ 12MB
- [ ] **Step 5:** `git add -A && git commit -m "Add KayKit asset pipeline, model manifest, animation map, and Actor"`

---

### Task 11: 3D 장면·재생·연출

**Files:** Create `src/view/scene/{renderer,camera,lighting,arena}.ts`, `src/view/playback/{battlePlayer,eventRouter,interpolate}.ts`, `src/view/fx/{telegraphFx,projectileFx,slashFx,hitFx,shieldFx}.ts`, `src/view/overlay/{unitOverlay,damageNumbers}.ts`; Test `tests/unit/battlePlayer.test.ts`, `tests/unit/interpolate.test.ts`

**좌표 규칙:** sim (x, y) → three (x, 0, y). 위가 +Y. 아군 왼쪽(-x).

**Interfaces — Produces:**
```ts
// scene/renderer.ts
export interface SceneHandle { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; resize(): void; dispose(): void }
export function createScene(container: HTMLElement): SceneHandle; // antialias, shadowMap PCFSoft, outputColorSpace sRGB, ACES 톤매핑, ResizeObserver. WebGL 생성 실패 시 Error('webgl-unavailable') throw
// scene/camera.ts
export class BattleCamera { constructor(cam: THREE.OrthographicCamera); frame(points: {x:number;y:number}[], dt: number): void; } // 고도각 55°, 방위 정면(-z 쪽에서 바라봄), 살아있는 유닛 경계 + 3m 여백에 맞춰 frustum 높이 lerp(속도 3/s), 최소 높이 10m, 최대 18m
// scene/lighting.ts — HemisphereLight(하늘 #fff4e0, 땅 #3a3428, 0.9) + DirectionalLight(#ffe2b0, 2.2, 그림자 2048, 위치 (-8,14,6))
// scene/arena.ts — export function buildArena(scene, obstacles): void; 28×18 지면(캔버스 생성 텍스처: 흙·풀 얼룩 노이즈, 시드 고정), 경계 돌 테두리, 장애물: rock=납작한 DodecahedronGeometry flatShading 회갈색, pillar=CylinderGeometry 6각 석재
// playback/interpolate.ts
export function lerpAngle(a: number, b: number, t: number): number; // 최단 경로
export function interpUnit(prev: UnitSnap | undefined, curr: UnitSnap, t: number): { x: number; y: number; facing: number };
// playback/battlePlayer.ts
export type Speed = 0 | 1 | 2 | 4;
export class BattlePlayer {
  constructor(battle: Battle, onStep: (r: StepResult) => void);
  speed: Speed; readonly maxStepsPerFrame: 8;
  update(dtSec: number): { prev: Snapshot; curr: Snapshot; alpha: number }; // acc += dt×speed (dt는 0.1초로 clamp); while acc ≥ DT && steps < 8 && !outcome: step; acc가 남으면 alpha=acc/DT. 8틱 제한에 걸리면 acc를 DT 미만으로 버림
  retreat(): void;
}
// playback/eventRouter.ts
export class EventRouter { constructor(deps: { actors: Map<string, Actor>; fx: FxHub; overlay: UnitOverlay; numbers: DamageNumbers; log: (e: BattleEvent) => void }); handle(e: BattleEvent): void }
// 매핑: action_start → actor.play(skill.anim, once); damage → hit 애니(피격자 행동 중 아니면) + flash 흰색 + 피해 숫자(치명 큰 글씨) + slashFx(근접일 때); miss → dodge 애니(dodgeL/R 교대) + 'MISS'; heal → 초록 숫자 + 치유 빛;
//   tag_add → overlay 태그 아이콘; telegraph_start/fire → telegraphFx; projectile → projectileFx; dodge_roll → dodge 애니; downed → setDowned(true); rescued → setDowned(false)+standUp; died → setDead();
//   combo → 노란 '연계!' 숫자 + 대상 flash 금색; phase → 카메라 흔들림 0.3초; berserk → 화면 가장자리 붉은 비네트(css 클래스); summon → 새 Actor 생성 + spawn 애니
// fx/* — FxHub { telegraph(start/fire/remove), projectile(spawn/update by snapshot/remove), slash(pos, facing), heal(pos), shield(unitId, on), shake(sec) ; update(dt) }
//   telegraphFx: 원/부채꼴/직선 바닥 메시(반투명 붉은 테두리 + 진행도만큼 안쪽이 차오르는 셰이더 또는 scale 애니), 아군 스킬은 파란색
//   projectileFx: bolt(보라 구), arrow(가는 원통), fireball(주황 구 + 점멸), holy(흰 구), dark(검보라 구), 스냅샷 위치로 보간
// overlay/unitOverlay.ts — DOM 레이어: 유닛별 이름표(개인색), HP바(보호막은 흰 덧바), 기세바(금색), 태그·의도 아이콘 줄. 매 프레임 월드→화면 투영(Vector3.project)
// overlay/damageNumbers.ts — DOM, 0.8초 동안 위로 떠오르며 사라짐, 풀링(최대 60개)
```

- [ ] **Step 1: 실패 테스트**

`tests/unit/battlePlayer.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { BattlePlayer } from '../../src/view/playback/battlePlayer';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
describe('battle player', () => {
  it('advances ticks proportional to speed', () => {
    let steps = 0; const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => steps++);
    p.speed = 1; p.update(0.05); p.update(0.05); expect(steps).toBe(2);
    p.speed = 4; p.update(0.05); expect(steps).toBe(6);
  });
  it('caps steps per frame after a long pause', () => {
    let steps = 0; const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => steps++);
    p.speed = 4; p.update(30); expect(steps).toBeLessThanOrEqual(8);
  });
  it('speed 0 pauses', () => {
    let steps = 0; const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => steps++);
    p.speed = 0; p.update(1); expect(steps).toBe(0);
  });
});
```
`tests/unit/interpolate.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { lerpAngle } from '../../src/view/playback/interpolate';
describe('interpolate', () => {
  it('lerps angles the short way', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});
```
(`battlePlayer.ts`와 `interpolate.ts`는 three를 import하지 않게 작성해 Node에서 테스트 가능하게 한다.)
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** `npm test && npm run lint && npm run typecheck && npm run build` PASS
- [ ] **Step 5:** `git add -A && git commit -m "Add three.js battle scene, playback interpolation, event-driven FX and overlays"`

---

### Task 12: 샌드박스·전투 화면 UI·E2E·배포

**Files:** Create `src/app/router.ts`, `src/ui/screens/{sandboxScreen,battleScreen}.ts`, `src/ui/hud/{controls,inspectPanel,battleLog,resultOverlay}.ts`, `src/ui/styles/{hud,screens}.css`, `tests/e2e/sandbox.spec.ts`; Modify `src/app/main.ts`, `src/ui/i18n/ko.ts`, `README.md`; Delete `tests/e2e/boot.spec.ts`

**Interfaces — Produces:**
```ts
// router.ts
export interface Screen { mount(root: HTMLElement): void; unmount(): void }
export class Router { constructor(root: HTMLElement); go(screen: Screen): void } // 이전 화면 unmount 후 mount
// sandboxScreen.ts — 제목 'PROJ_R — 전투 샌드박스', 아군 프리셋 select(solo/standard/elemental), 적 프리셋 select(tutorial/bandits/skeletons/boss), 시드 input(기본: URL ?seed= 또는 1), '전투 시작' 버튼(data-testid="start-battle"). 시작 시 loadAssets 진행률 표시.
// battleScreen.ts — createScene + buildArena + Actor 생성 + BattlePlayer + EventRouter, requestAnimationFrame 루프, unmount 시 dispose
//   window.__PROJR__ = { tick: () => battle.state.tick, outcome: () => battle.outcome, speed: (s) => player.speed = s } (e2e·디버그용)
// hud/controls.ts — 버튼: 일시정지(Space), 1x/2x/4x(키 1/2/3), 후퇴(확인 없이 즉시). data-testid: pause, speed-1, speed-2, speed-4, retreat
// hud/inspectPanel.ts — 유닛 클릭(Raycaster로 actor.root 판정) 시 우측 패널: 이름·직업·HP·기세·태그·현재 의도 문장 t(`reason.${intent.reason}`) + detail 상위 3개 근거 칩. 일시정지 중에도 동작.
// hud/battleLog.ts — 좌하단 접이식, 최근 50줄, 이벤트 → 한국어 문장(damage/heal/downed/rescued/died/combo/phase/berserk만), 필터 토글 '연계·구출만'
// hud/resultOverlay.ts — battle_end 시 '승리'/'패배'/'후퇴' + 유닛별 처치·피해·치유·회피 표 + '다시 하기'(같은 설정) / '샌드박스로' 버튼. data-testid="result"
// main.ts — Router로 sandboxScreen 시작. 에셋 로드 실패 또는 webgl-unavailable 시 #app에 한국어 오류 메시지(data-testid="fatal") 표시
```

- [ ] **Step 1: E2E 테스트** `tests/e2e/sandbox.spec.ts`
```ts
import { test, expect } from '@playwright/test';
test('sandbox battle runs to completion and renders', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?seed=7');
  await page.selectOption('[data-testid="ally-preset"]', 'standard');
  await page.selectOption('[data-testid="enemy-preset"]', 'bandits');
  await page.click('[data-testid="start-battle"]');
  await page.waitForFunction(() => (window as unknown as { __PROJR__?: { tick(): number } }).__PROJR__?.tick() > 40, null, { timeout: 60_000 });
  await page.screenshot({ path: 'test-artifacts/battle-start.png' });
  await page.click('[data-testid="speed-4"]');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-artifacts/battle-mid.png' });
  await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: 'test-artifacts/battle-end.png' });
  expect(errors).toEqual([]);
});
test('pause stops the simulation', async ({ page }) => {
  await page.goto('./?seed=3'); await page.click('[data-testid="start-battle"]');
  await page.waitForFunction(() => (window as unknown as { __PROJR__?: { tick(): number } }).__PROJR__?.tick() > 20, null, { timeout: 60_000 });
  await page.click('[data-testid="pause"]');
  const t1 = await page.evaluate(() => (window as unknown as { __PROJR__: { tick(): number } }).__PROJR__.tick());
  await page.waitForTimeout(1000);
  const t2 = await page.evaluate(() => (window as unknown as { __PROJR__: { tick(): number } }).__PROJR__.tick());
  expect(t2).toBe(t1);
});
```
- [ ] **Step 2:** `npm run build && npm run e2e` → FAIL
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` PASS. 스크린샷 3장을 직접 열어 확인: 캐릭터 모델·무기·발밑 링·HP바가 보이는지, 위험 범위·투사체가 보이는지, 결과 패널이 뜨는지. 문제 있으면 수정 후 재실행.
- [ ] **Step 5:** README에 샌드박스 조작법 추가. `git add -A && git commit -m "Add battle sandbox UI, HUD, result overlay, and e2e"`
- [ ] **Step 6:** `git push origin main` → Actions의 CI·deploy 성공 확인(`git ls-remote` 후 Pages URL 응답 200 확인: `curl -sI https://jinha1226.github.io/PROJ_R/ | head -1`).
