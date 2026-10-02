# 에셋 출처

## 캐릭터 모델·애니메이션

- **KayKit Character Pack: Adventurers 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
  - 고정 리비전 `672074b73ba276876a19e8816ecdc5241817ab47`
- **KayKit Character Pack: Skeletons 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
  - 고정 리비전 `15b62b9bad122f72926c10fb14d622c73819fa54`
- 라이선스: CC0 1.0 (`KAYKIT-LICENSE.txt`)

- **Universal Animation Library (Standard)** — Quaternius
  - https://quaternius.com/packs/universalanimationlibrary.html (OpenGameArt 배포본 `universal_animation_librarystandard.zip`)
  - 라이선스: CC0 1.0 (`models/ual/LICENSE.txt`)
  - `models/ual/ual.glb`: Godot용 GLB에서 격자 출격이 쓰는 18개 클립만 남김(Blender 4.0 재내보내기, 마네킹 메시·리그 유지)

## 가공 내용

`npm run assets`(`scripts/prepare-assets.mjs`)가 원본을 내려받아 다음과 같이 가공합니다.

- `models/characters/*.glb`: 원본 캐릭터에서 애니메이션을 제거(메시·리그·텍스처는 그대로).
- `models/anims-adventurer.glb`, `models/anims-skeleton.glb`: Knight / Skeleton_Warrior 원본에서
  메시를 제거하고, 게임에서 쓰는 클립만 남긴 공용 애니메이션 라이브러리. 모든 캐릭터가 같은 리그라 공유합니다.
- `models/props/*.glb`: 스켈레톤 무기·방패(.gltf + .bin + 텍스처)를 GLB 하나로 묶음.
- `models/manifest.json`: 캐릭터별 메시 노드 이름 목록(장비 표시 매핑 검증용).

## 탐험 환경 소품 (`models/env/`)

`npm run assets:env`(`scripts/prepare-env.mjs`)가 아래 KayKit CC0 팩에서 필요한 모델만 내려받아 GLB 하나씩으로 묶습니다.

- **KayKit Dungeon Remastered 1.0** — 리비전 `b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07` (바닥·벽·기둥·상자·통·횃불·보물상자·잔해)
- **KayKit Medieval Hexagon Pack 1.0** — 리비전 `84fa4e91af6a88989be7c99e0891cede11f2ca38` (나무·바위·덤불)
- **KayKit Halloween Bits 1.0** — 리비전 `6dc69bf6b2fa766a985754f35ec6a0324090e6c6` (묘비·무덤·철책·고목·지하묘지·랜턴·아치·흙바닥)
- 라이선스: CC0 1.0
