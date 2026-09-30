# Art provenance

## Runtime 3D characters

KayKit Character Pack: Adventurers, by Kay Lousberg / KayKit.
Official source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
Pinned revision: `672074b73ba276876a19e8816ecdc5241817ab47`.
License: CC0 1.0; included at `models/KAYKIT-LICENSE.txt`.

`models/Knight.glb`, `Mage.glb`, `Rogue.glb` (original Rogue_Hooded), and `Barbarian.glb` keep nine gameplay animation clips. Unused animation data was removed without altering mesh geometry. Runtime code selects accessories and colors individual class robes. Models and textures are served from this repository.

## Generated raster art

Created with the built-in imagegen tool. Source PNG files remain in the workspace; WebP versions preserve the dimensions and transparency and reduce browser download size. The characters image supplies UI portraits, not battlefield billboards. Battlefield characters use actual 3D geometry, skeletons and animation clips.

### Character portraits

Source: `characters-v2.png`; runtime: `characters-v2.webp`.

Prompt:
> Use case: stylized-concept. Asset type: production fantasy tactical RPG sprite atlas, transparent background. Create exactly 12 separate full-body characters in a precise uniform 4 column by 3 row grid, each sprite centered within its own equally sized cell with clear transparent margins, no overlap. Entire canvas landscape 4:3 aspect ratio. All characters use same high quality hand painted dark fantasy game art, readable silhouettes, detailed armor, isometric 3/4 camera, feet toward lower edge, dramatic rim lighting, premium indie RPG art, not pixel art, not geometric, no text, no letters, no floor or scenery. Row 1 left to right: silver blue paladin with enormous shield and sword; burly steel warrior with axe and fur cloak; ivory robed female priest holding golden glowing staff; green druid with antler crown and wooden staff. Row 2 left to right: red robed fire wizard with flames in hand; hooded dark leather rogue with two daggers; emerald cloak ranger holding bow; violet storm shaman with lightning staff. Row 3 left to right: armored teal rune swordsman; giant fallen knight boss with huge horns rusted plate armor orange glowing fissures and enormous hammer; thorn queen boss dark green regal sorceress wrapped in roots with thorn crown and purple glowing magic; void watcher boss floating violet armored eldritch creature with a single bright eye and flowing dark tendrils. Bosses fit cells like heroes but have bulkier silhouettes. Every complete figure isolated on genuine alpha transparency, including between figures. Make characters very carefully rendered with strong detail and polished game art.

### Stone material

Source: `stone-v3.png`; runtime: `stone-v3.webp`.

Prompt:
> Use case: stylized-concept. Asset type: seamless repeating PBR albedo texture for a 3D dark fantasy game castle stone floor. Orthographic straight overhead close view, edge-to-edge roughly square grey blue slate paving stones with uneven worn beveled edges and thin dark mortar, fine pitted rock surface, restrained little moss in joints, hairline cracks and natural varied stone color. High craft hand-painted realistic stylized RPG material, richly detailed but subtle at game scale, premium game environment texture. Exactly flat even ambient lighting; NO directional shadows, NO perspective, NO objects, no torches, no characters, no architecture beyond the stone tile floor, no text. Seamless tileable composition with stones continuing across all four edges. Muted dark cool slate grey color, moderately high contrast fine surface texture but not glossy. Square image.

### Archived 2D environment exploration

Saved in workspace as `citadel-v2.png`; not loaded by the 3D game.

Prompt:
> Use case: stylized-concept. Asset type: tactical RPG battle arena background environment art. A premium hand-painted dark fantasy ruined castle raid arena, wide landscape 3:2 image. Elevated top-down three quarter camera, nearly overhead, gameplay readable. Large octagonal circular weathered stone courtyard covers center 80 percent, with subtly engraved magical runes, cracked uneven individual stone tiles, moss at edges, muted cool slate stone and desaturated green, illuminated by warm orange torch sconces on four massive ornate carved pillars along side edges. Bottom foreground broken stone steps, top background ominous monumental fortress gate with carved gothic arches, chains and a dim orange glow. Cinematic carefully painted ambient occlusion, rich surface textures, sculptural architecture, subtle atmospheric fog only near outer edges. CENTER MUST be uncluttered walkable stone ground for overlaid 5 heroes and boss; no characters, no creatures, no UI, no text, no lettering, no health bars, no hazard shapes. Finely detailed believable fantasy game environment, high craft indie game digital matte painting, not low polygon, not flat vector, not pixel art. Balanced lighting with dark edges and a brighter legible center. No extreme perspective; arena reads as flat navigable gameplay floor.

## Renderer

Three.js 0.180.0, MIT license, included at `../vendor/THREE-LICENSE`.
The GLTFLoader, SkeletonUtils and BufferGeometryUtils come from the same pinned release. Imports are adjusted to local vendor module paths.
