import * as THREE from 'three';

/** Tiny pixel-art textures (8×8, nearest filtering) for block bodies. */
function tex(draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const shade = (hex: string, k: number): string => {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
};

/** A flat colour with a few darker and lighter pixels, so blocks read as pixel art rather than plastic. */
export function noiseTex(base: string, seed = 1): THREE.Texture {
  return tex((g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 8, 8);
    let s = seed * 9301 + 49297;
    for (let i = 0; i < 14; i++) {
      s = (s * 9301 + 49297) % 233280;
      const x = s % 8;
      const y = Math.floor(s / 8) % 8;
      g.fillStyle = shade(base, i % 2 ? 0.82 : 1.12);
      g.fillRect(x, y, 1, 1);
    }
  });
}

export type FaceKind = 'human' | 'skull' | 'hood' | 'helmet' | 'ghoul';

/** The front of a head. */
export function faceTex(kind: FaceKind, skin: string, hair: string): THREE.Texture {
  return tex((g) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, 8, 8);
    if (kind === 'human') {
      g.fillStyle = hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 2, 1, 2); g.fillRect(7, 2, 1, 2);
      g.fillStyle = '#ffffff'; g.fillRect(1, 4, 2, 1); g.fillRect(5, 4, 2, 1);
      g.fillStyle = '#3a6ab0'; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
      g.fillStyle = shade(skin, 0.75); g.fillRect(3, 5, 2, 1);
      g.fillStyle = '#7a3a2a'; g.fillRect(3, 6, 2, 1);
    } else if (kind === 'skull' || kind === 'hood') {
      if (kind === 'hood') { g.fillStyle = hair; g.fillRect(0, 0, 8, 2); g.fillRect(0, 0, 1, 8); g.fillRect(7, 0, 1, 8); }
      g.fillStyle = '#1a1414'; g.fillRect(1, 3, 2, 2); g.fillRect(5, 3, 2, 2); g.fillRect(3, 5, 2, 1);
      g.fillStyle = '#ff5a3a'; g.fillRect(2, 4, 1, 1); g.fillRect(5, 4, 1, 1);
      g.fillStyle = shade(skin, 0.7); g.fillRect(2, 6, 4, 1);
      g.fillStyle = '#1a1414'; g.fillRect(2, 7, 1, 1); g.fillRect(4, 7, 1, 1);
    } else if (kind === 'helmet') {
      g.fillStyle = hair; g.fillRect(0, 0, 8, 3); g.fillRect(0, 0, 1, 8); g.fillRect(7, 0, 1, 8);
      g.fillStyle = '#1a1414'; g.fillRect(1, 3, 6, 1);
      g.fillStyle = '#ff5a3a'; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
      g.fillStyle = hair; g.fillRect(3, 3, 2, 3);
    } else {
      g.fillStyle = '#e8f080'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
      g.fillStyle = '#2a1a1a'; g.fillRect(2, 5, 4, 2);
      g.fillStyle = '#d8d0b0'; g.fillRect(2, 5, 1, 1); g.fillRect(5, 5, 1, 1);
    }
  });
}

/** A torso front: tunic with a belt, or ribs for skeletons. */
export function chestTex(base: string, trim: string, ribs: boolean): THREE.Texture {
  return tex((g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 8, 8);
    if (ribs) {
      g.fillStyle = '#2a2222';
      for (const y of [1, 3, 5]) { g.fillRect(1, y, 2, 1); g.fillRect(5, y, 2, 1); }
      g.fillRect(3, 0, 2, 8);
      g.fillStyle = base; g.fillRect(3, 0, 2, 7);
    } else {
      g.fillStyle = trim; g.fillRect(0, 5, 8, 1);
      g.fillStyle = '#d8b040'; g.fillRect(3, 5, 2, 1);
      g.fillStyle = shade(base, 0.8); g.fillRect(3, 0, 2, 2);
    }
  });
}
