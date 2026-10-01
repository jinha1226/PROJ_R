# 에셋 출처

## 캐릭터 모델·애니메이션

- **KayKit Character Pack: Adventurers 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
  - 고정 리비전 `672074b73ba276876a19e8816ecdc5241817ab47`
- **KayKit Character Pack: Skeletons 1.0** — Kay Lousberg (KayKit)
  - https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
  - 고정 리비전 `15b62b9bad122f72926c10fb14d622c73819fa54`
- 라이선스: CC0 1.0 (`KAYKIT-LICENSE.txt`)

## 가공 내용

`npm run assets`(`scripts/prepare-assets.mjs`)가 원본을 내려받아 다음과 같이 가공합니다.

- `models/characters/*.glb`: 원본 캐릭터에서 애니메이션을 제거(메시·리그·텍스처는 그대로).
- `models/anims-adventurer.glb`, `models/anims-skeleton.glb`: Knight / Skeleton_Warrior 원본에서
  메시를 제거하고, 게임에서 쓰는 클립만 남긴 공용 애니메이션 라이브러리. 모든 캐릭터가 같은 리그라 공유합니다.
- `models/props/*.glb`: 스켈레톤 무기·방패(.gltf + .bin + 텍스처)를 GLB 하나로 묶음.
- `models/manifest.json`: 캐릭터별 메시 노드 이름 목록(장비 표시 매핑 검증용).
