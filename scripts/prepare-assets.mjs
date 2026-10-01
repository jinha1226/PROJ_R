// Downloads pinned KayKit CC0 characters, strips animations into two shared clip
// libraries, and writes compact GLBs + a mesh-name manifest to public/assets/models.
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';

const CACHE = '.asset-cache';
const OUT = 'public/assets/models';
const PACKS = {
  adventurer: {
    repo: 'KayKit-Character-Pack-Adventures-1.0', rev: '672074b73ba276876a19e8816ecdc5241817ab47',
    addon: 'kaykit_character_pack_adventures', files: ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'],
  },
  skeleton: {
    repo: 'KayKit-Character-Pack-Skeletons-1.0', rev: '15b62b9bad122f72926c10fb14d622c73819fa54',
    addon: 'kaykit_character_pack_skeletons', files: ['Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Minion'],
  },
};
const COMMON_CLIPS = [
  'Idle', '2H_Melee_Idle', 'Running_A', 'Walking_Backwards', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', 'Dualwield_Melee_Attack_Slice', '1H_Ranged_Shoot', '2H_Ranged_Shoot',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Block', 'Hit_A', 'Dodge_Left', 'Dodge_Right',
  'Dodge_Backward', 'Death_A', 'Lie_Idle', 'Lie_StandUp', 'Cheer', 'Throw',
];
const SKELETON_CLIPS = ['Spawn_Ground_Skeletons', 'Taunt', '1H_Melee_Attack_Jump_Chop', 'Idle_Combat'];
const ANIM_SOURCE = { adventurer: 'Knight', skeleton: 'Skeleton_Warrior' };

const io = new NodeIO();

function dropAnimation(a) {
  for (const c of a.listChannels()) c.dispose();
  // Accessors may be shared between clips; leave them for prune() to collect.
  for (const smp of a.listSamplers()) smp.dispose();
  a.dispose();
}

const PROPS = ['Skeleton_Axe', 'Skeleton_Blade', 'Skeleton_Crossbow', 'Skeleton_Staff', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Large_A'];

async function fetchTo(url, dest) {
  if (existsSync(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Skeleton weapons ship as separate .gltf (+bin/png); pack each into one GLB. */
async function writeProp(pack, name) {
  const base = `https://raw.githubusercontent.com/KayKit-Game-Assets/${pack.repo}/${pack.rev}/addons/${pack.addon}/Assets/gltf`;
  const dir = join(CACHE, 'props');
  mkdirSync(dir, { recursive: true });
  const gltfPath = join(dir, `${name}.gltf`);
  await fetchTo(`${base}/${name}.gltf`, gltfPath);
  const json = JSON.parse(readFileSync(gltfPath, 'utf8'));
  for (const r of [...(json.buffers ?? []), ...(json.images ?? [])])
    if (r.uri && !r.uri.startsWith('data:')) await fetchTo(`${base}/${encodeURI(r.uri)}`, join(dir, decodeURI(r.uri)));
  const doc = await io.read(gltfPath);
  await doc.transform(dedup(), prune());
  await io.write(join(OUT, 'props', `${name}.glb`), doc);
}

async function download(pack, file) {
  const dest = join(CACHE, `${file}.glb`);
  if (existsSync(dest)) return dest;
  const url = `https://raw.githubusercontent.com/KayKit-Game-Assets/${pack.repo}/${pack.rev}/addons/${pack.addon}/Characters/gltf/${file}.glb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

async function writeCharacter(src, file) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) dropAnimation(a);
  await doc.transform(dedup(), prune());
  await io.write(join(OUT, 'characters', `${file}.glb`), doc);
  return root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName());
}

async function writeClips(src, set) {
  const keep = new Set(set === 'skeleton' ? [...COMMON_CLIPS, ...SKELETON_CLIPS] : COMMON_CLIPS);
  const doc = await io.read(src);
  const root = doc.getRoot();
  for (const n of root.listNodes()) {
    n.setMesh(null);
    n.setSkin(null);
  }
  for (const a of root.listAnimations()) if (!keep.has(a.getName())) dropAnimation(a);
  const missing = [...keep].filter((k) => !root.listAnimations().some((a) => a.getName() === k));
  if (missing.length) throw new Error(`${set}: missing clips ${missing.join(', ')}`);
  await doc.transform(dedup(), prune({ keepLeaves: true }));
  await io.write(join(OUT, `anims-${set}.glb`), doc);
}

const dirSize = (d) => readdirSync(d, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? dirSize(join(d, e.name)) : statSync(join(d, e.name)).size), 0);

mkdirSync(CACHE, { recursive: true });
mkdirSync(join(OUT, 'characters'), { recursive: true });
const manifest = {};
for (const [set, pack] of Object.entries(PACKS)) {
  for (const file of pack.files) {
    const src = await download(pack, file);
    manifest[file] = await writeCharacter(src, file);
    if (file === ANIM_SOURCE[set]) await writeClips(src, set);
    console.log(`ok ${file}`);
  }
}
mkdirSync(join(OUT, 'props'), { recursive: true });
for (const name of PROPS) {
  await writeProp(PACKS.skeleton, name);
  console.log(`ok prop ${name}`);
}
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`total ${(dirSize(OUT) / 1024 / 1024).toFixed(2)} MB`);
