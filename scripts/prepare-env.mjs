// Environment props for exploration themes (KayKit CC0 packs), packed into single GLBs under public/assets/models/env.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';

const CACHE = '.asset-cache/env';
const OUT = 'public/assets/models/env';
const io = new NodeIO();
const RAW = 'https://raw.githubusercontent.com/KayKit-Game-Assets';

const SOURCES = {
  dungeon: {
    base: `${RAW}/KayKit-Dungeon-Remastered-1.0/b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07/addons/kaykit_dungeon_remastered/Assets/gltf`,
    files: {
      floor: 'floor_tile_large.gltf.glb', wall: 'wall.gltf.glb', pillar: 'pillar.gltf.glb', crates: 'crates_stacked.gltf.glb',
      barrel: 'barrel_large.gltf.glb', torch: 'torch_mounted.gltf.glb', chest: 'chest.glb', rubble: 'rubble_large.gltf.glb',
    },
  },
  forest: {
    base: `${RAW}/KayKit-Medieval-Hexagon-Pack-1.0/84fa4e91af6a88989be7c99e0891cede11f2ca38/addons/kaykit_medieval_hexagon_pack/Assets/gltf/decoration/nature`,
    files: {
      tree: 'tree_single_A.gltf', treeB: 'tree_single_B.gltf', trees: 'trees_A_large.gltf', treesB: 'trees_B_medium.gltf',
      rock: 'rock_single_A.gltf', rockB: 'rock_single_C.gltf', bush: 'trees_A_small.gltf',
    },
  },
  graveyard: {
    base: `${RAW}/KayKit-Halloween-Bits-1.0/6dc69bf6b2fa766a985754f35ec6a0324090e6c6/addons/kaykit_halloween_bits/Assets/gltf`,
    files: {
      grave: 'gravestone.gltf', graveB: 'grave_A.gltf', fence: 'fence.gltf', deadtree: 'tree_dead_large.gltf', deadtreeB: 'tree_dead_medium.gltf',
      crypt: 'crypt.gltf', lantern: 'lantern_standing.gltf', arch: 'arch.gltf', floor: 'floor_dirt.gltf',
    },
  },
};

async function fetchTo(url, dest) {
  if (existsSync(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function pack(theme, key, file, base) {
  const dir = join(CACHE, theme);
  mkdirSync(dir, { recursive: true });
  const src = join(dir, file);
  await fetchTo(`${base}/${encodeURI(file)}`, src);
  if (file.endsWith('.gltf')) {
    const json = JSON.parse(readFileSync(src, 'utf8'));
    for (const r of [...(json.buffers ?? []), ...(json.images ?? [])])
      if (r.uri && !r.uri.startsWith('data:')) await fetchTo(`${base}/${encodeURI(r.uri)}`, join(dir, decodeURI(r.uri)));
  }
  const doc = await io.read(src);
  await doc.transform(dedup(), prune());
  await io.write(join(OUT, theme, `${key}.glb`), doc);
}

const manifest = {};
for (const [theme, s] of Object.entries(SOURCES)) {
  mkdirSync(join(OUT, theme), { recursive: true });
  manifest[theme] = Object.keys(s.files);
  for (const [key, file] of Object.entries(s.files)) {
    await pack(theme, key, file, s.base);
    console.log(`ok env ${theme}/${key}`);
  }
}
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
