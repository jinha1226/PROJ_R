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
- **Modular Dungeons Pack (Updated, May 2019)** — Quaternius, CC0 1.0 (https://quaternius.com/packs/modulardungeon.html)
  - `models/qpack/dungeon.glb`: .blend 48종(벽·바닥·기둥·아치 문·철창·계단·탁자·의자·석상·깃발·모닥불·상자·통·횃불·함정 등)을 Blender 4.0으로 조각마다 메시 하나로 합쳐 GLB 하나로 묶음. 게임에서 색을 1.7배 밝혀 씀
- **Sci-Fi Essentials Kit** — Quaternius, CC0 1.0 (OpenGameArt `sci-fi-essentials-kit`, https://quaternius.com/packs/scifiessentialskit.html)
  - `models/qpack/guns.glb`: glTF 총 3종(Gun_Pistol·Gun_Rifle·Gun_Sniper → 권총·산탄총·소총)을 Blender 4.0으로 메시 하나씩 합치고, 기본 색 텍스처만 512px로 줄여(노멀·ORM 제외) GLB 하나로 묶음
  - `models/scifi/ship.glb`: 우주선 내부 소품 13종(사물함·책상·선반·위성 안테나·의료 튜브·상자·의자·통 등)을 같은 방식으로 합치고 기본 색 텍스처만 512px로 줄여 묶음 / `textures/ship/trim_*.jpg`: 트림 텍스처 3장(512px, 벽·바닥용) / 라이선스 `models/scifi/LICENSE.txt`
- **Modular Sci-Fi MegaKit** — Quaternius, CC0 1.0 (OpenGameArt `modular-sci-fi-megakit`)
  - `models/scifi/deck.glb`: 우주선 갑판 모듈(바닥 판·벽·문틀·배관 기둥·컴퓨터·상자·통·바닥 조명 등)을 Blender 4.0으로 모듈마다 메시 하나로 합치고 기본 색·발광 텍스처만 512px JPEG로 줄여 묶음
- **Stylized Nature MegaKit** — Quaternius, CC0 1.0 (https://quaternius.com/packs/stylizednaturemegakit.html, poly.pizza 묶음)
  - `models/nature/nature.glb`: 27종(고사목 5·뒤틀린 나무 5·소나무 3·나무 2·바위 3·덤불·풀 3·고사리·버섯 2·자갈 2)을 Blender 4.0으로 모델마다 메시 하나로 합치고, 정점 2500개가 넘는 나무는 간소화, 텍스처는 256px로 줄여 GLB 하나로 묶음
- **Modular Character Outfits – Fantasy [Standard]** — Quaternius, CC0 1.0 (https://quaternius.com/packs/modularcharacteroutfitsfantasy.html)
  - `models/outfits/outfits.glb`: 남성 농부·레인저 옷을 gltf-transform으로 하나로 묶음(정점 간소화, 양자화, 색 텍스처만 256px). UAL 마네킹과 같은 골격이라 실행 중에 마네킹 뼈에 다시 묶어 입힌다
- **Particle Pack** — Kenney, CC0 1.0 (https://kenney.nl/assets/particle-pack)
  - `fx-atlas.png`: 80장 중 16장(빛무리·고리·별·반짝이·궤적·불꽃·폭발·연기·연기 고리·폭발 중심·베기·소용돌이·마법 별·룬·번개·흙)을 128px로 줄여 4×4 아틀라스로 묶음, 밝기를 알파로 사용. 파티클 엔진은 three.quarks(MIT)
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
