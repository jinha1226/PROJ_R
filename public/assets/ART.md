# 에셋 출처

## 캐릭터 모델·애니메이션

- **KayKit Character Pack: Adventurers 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
  - 고정 리비전 `672074b73ba276876a19e8816ecdc5241817ab47`
- **KayKit Character Pack: Skeletons 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
  - 고정 리비전 `15b62b9bad122f72926c10fb14d622c73819fa54`
- 라이선스: CC0 1.0 (`KAYKIT-LICENSE.txt`)

- **Universal Animation Library (Standard)** + **Universal Animation Library 2 (Standard)** — Quaternius, CC0 1.0
  - https://quaternius.com/packs/universalanimationlibrary.html · https://quaternius.com/packs/universalanimationlibrary2.html (OpenGameArt 무료판)
  - `models/ual/ual.glb`: 2편 GLB의 마네킹·리그(Unreal식 65본)에 1편 Unreal FBX의 클립을 합치고(두 리그 동일), 쓰는 클립만 남김. `Bow_Shoot`·`Weave_L`·`Weave_R`은 무료판에 없는 동작이라 같은 리그 위에 Blender 4.0 조준 제약(Damped Track)으로 만들어 구운 자체 제작 클립(CC0로 함께 배포)
  - 라이선스: `models/ual/LICENSE.txt`, `models/ual/LICENSE-UAL2.txt`
- **Medieval Weapons Pack (Sept 2018)** — Quaternius, CC0 1.0 (OpenGameArt `lowpoly-medieval-weapons`)
  - `models/qpack/weapons.glb`: FBX 18종을 Blender 4.0으로 무기마다 메시 하나로 합쳐 GLB 하나로 묶음
- **LowPoly Modular Dungeon Pack (May 2019)** — Quaternius, CC0 1.0 (OpenGameArt `lowpoly-modular-dungeon-pack`)
  - `models/qpack/dungeon.glb`: FBX 30종(벽·바닥·기둥·아치 문·상자·통·횃불·깃발·거미줄·해골·계단·함정 등)을 조각마다 메시 하나로 합쳐 GLB 하나로 묶음
- **Sci-Fi Essentials Kit** — Quaternius, CC0 1.0 (OpenGameArt `sci-fi-essentials-kit`, https://quaternius.com/packs/scifiessentialskit.html)
  - `models/qpack/guns.glb`: glTF 총 3종(Gun_Pistol·Gun_Rifle·Gun_Sniper → 권총·산탄총·소총)을 Blender 4.0으로 메시 하나씩 합치고, 기본 색 텍스처만 512px로 줄여(노멀·ORM 제외) GLB 하나로 묶음
  - `models/scifi/ship.glb`: 우주선 내부 소품 13종(사물함·책상·선반·위성 안테나·의료 튜브·상자·의자·통 등)을 같은 방식으로 합치고 기본 색 텍스처만 512px로 줄여 묶음 / `textures/ship/trim_*.jpg`: 트림 텍스처 3장(512px, 벽·바닥용) / 라이선스 `models/scifi/LICENSE.txt`
- 라이선스 사본: `models/qpack/LICENSE.txt`

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
