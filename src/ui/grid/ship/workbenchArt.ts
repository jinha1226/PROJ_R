import type { ModSlot, WorkbenchSlot } from './workbenchTypes';

/** One part of an exploded drawing: its outlines, where it floats, where it mounts (guide line) and where its label goes. */
interface Part { slot: ModSlot | null; paths: string[]; anchor: [number, number]; mount: [number, number]; callout: [number, number] }

// side view of the agent's pistol (after the reference outline in public/assets/ui/pip), muzzle right; modded parts float off
const PISTOL: Part[] = [
  { slot: null, paths: [
    'M108 82 L248 82 L256 88 L256 112 L118 112 L108 104 Z', 'M116 88 L240 88', 'M146 82 L170 108 L200 108',
    'M206 92 L212 104 M216 92 L222 104 M226 92 L232 104', 'M118 112 L240 112 L240 122 L188 122 L178 136 L150 136 L144 122 L118 122 Z',
    'M178 122 Q196 140 168 142 L160 134', 'M118 122 L150 122 L140 180 L110 180 Z', 'M124 132 L144 132 M122 146 L142 146 M120 160 L140 160',
  ], anchor: [180, 100], mount: [180, 100], callout: [0, 0] },
  { slot: 'barrel', paths: ['M284 86 L350 86 L366 94 L366 106 L350 114 L284 114 Z', 'M296 94 L302 106 M310 94 L316 106 M324 94 L330 106', 'M350 90 L362 96 L362 104 L350 110', 'M284 100 L276 100'],
    anchor: [325, 100], mount: [256, 100], callout: [300, 68] },
  { slot: 'sight', paths: ['M164 42 L210 42 L214 48 L214 62 L164 62 Z', 'M172 46 L192 46 L192 58 L172 58 Z', 'M198 48 L208 48 M198 54 L208 54', 'M172 62 L172 70 M204 62 L204 70 M166 70 L210 70'],
    anchor: [188, 54], mount: [188, 82], callout: [220, 30] },
  { slot: 'grip', paths: ['M48 130 L82 130 L72 186 L40 186 Z', 'M54 140 L78 140 M52 152 L76 152 M50 164 L74 164 M48 176 L72 176'],
    anchor: [60, 158], mount: [124, 150], callout: [8, 116] },
  { slot: 'mag', paths: ['M114 198 L142 198 L134 230 L106 230 Z', 'M116 206 L138 206', 'M102 230 L138 230 L138 236 L102 236 Z'],
    anchor: [124, 216], mount: [126, 180], callout: [150, 226] },
];

// front view of the agent suit (as the 3D suit: helmet and visor, chest core, pauldrons, backpack lamps, greaves)
const SUIT: Part[] = [
  { slot: null, paths: [
    'M200 10 L214 16 L218 34 L208 42 L192 42 L182 34 L186 16 Z', 'M188 26 L212 26 L212 31 L188 31 Z', 'M200 10 L200 6',
    'M180 52 L220 52 L226 132 L174 132 Z', 'M186 132 L190 204 L174 226 L194 226 L198 204 M214 132 L210 204 L226 226 L206 226 L202 204',
    'M174 56 L150 64 L144 116 L152 120 L160 72 M226 56 L250 64 L256 116 L248 120 L240 72',
  ], anchor: [200, 90], mount: [200, 90], callout: [0, 0] },
  { slot: 'chest', paths: ['M170 50 L230 50 L224 108 L176 108 Z', 'M192 62 L208 62 L208 78 L192 78 Z', 'M196 66 L204 66 L204 74 L196 74 Z', 'M180 92 L220 92 M184 100 L216 100'],
    anchor: [200, 80], mount: [200, 80], callout: [238, 36] },
  { slot: 'arms', paths: ['M104 54 L136 50 L140 66 L108 72 Z', 'M110 80 L132 78 L136 120 L114 122 Z', 'M296 54 L264 50 L260 66 L292 72 Z', 'M290 80 L268 78 L264 120 L286 122 Z', 'M112 60 L132 57 M268 57 L288 60'],
    anchor: [122, 90], mount: [166, 66], callout: [30, 44] },
  { slot: 'legs', paths: ['M166 150 L190 150 L188 228 L168 228 Z', 'M210 150 L234 150 L232 228 L212 228 Z', 'M170 170 L186 170 M214 170 L230 170', 'M170 196 L186 196 M214 196 L230 196'],
    anchor: [200, 190], mount: [200, 134], callout: [244, 214] },
  { slot: 'back', paths: ['M312 58 L352 58 L356 64 L356 128 L312 128 Z', 'M322 70 L330 70 L330 78 L322 78 Z M336 70 L344 70 L344 78 L336 78 Z', 'M322 86 L330 86 L330 94 L322 94 Z M336 86 L344 86 L344 94 L336 94 Z', 'M322 102 L330 102 L330 110 L322 110 Z M336 102 L344 102 L344 110 L336 110 Z'],
    anchor: [334, 94], mount: [228, 94], callout: [310, 40] },
];

export interface ArtColors { fg: string; dim: string; line: string; warn: string; ch: string; fill: string; fitted: string }

/** The line art alone, with explicit colours (it is drawn into a small canvas and blown up for hard pixels). */
export function artSvg(part: 'pistol' | 'suit', slots: WorkbenchSlot[], selected: ModSlot | null, flash: ModSlot | null, c: ArtColors): string {
  const parts = part === 'pistol' ? PISTOL : SUIT;
  const fitted = new Set(slots.filter((s) => s.fitted).map((s) => s.slot));
  const body = parts.map((p) => {
    const lit = p.slot && flash === p.slot;
    const stroke = !p.slot ? c.dim : selected === p.slot ? c.warn : fitted.has(p.slot) ? c.fg : c.dim;
    const fill = lit ? c.ch : p.slot && fitted.has(p.slot) ? c.fitted : c.fill;
    const guide = p.slot ? `<line x1="${p.anchor[0]}" y1="${p.anchor[1]}" x2="${p.mount[0]}" y2="${p.mount[1]}" stroke="${selected === p.slot ? c.warn : c.line}" stroke-width="2" stroke-dasharray="4 4"/>` : '';
    return guide + p.paths.map((d) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="miter"/>`).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 244" width="400" height="244">${body}</svg>`;
}

/** Labels and tap targets over the pixel art, kept as crisp vector text. */
export function overlaySvg(part: 'pistol' | 'suit', slots: WorkbenchSlot[], selected: ModSlot | null): string {
  const parts = part === 'pistol' ? PISTOL : SUIT;
  const by = new Map(slots.map((s) => [s.slot, s]));
  const items = parts.filter((p) => p.slot).map((p) => {
    const s = by.get(p.slot!);
    const [cx, cy] = p.callout;
    const label = s ? `${s.label}${s.fitted ? ` · ${s.fitted.name}` : ''}` : '';
    return `<g class="wb-part${s?.fitted ? ' fitted' : ''}${selected === p.slot ? ' sel' : ''}" data-slot="${p.slot}" tabindex="0" role="button" aria-label="${label}">
      <text x="${cx}" y="${cy}" class="wb-call">${s?.label ?? ''}</text>
      <text x="${cx}" y="${cy + 12}" class="wb-sub">${s?.fitted ? s.fitted.name : '비어 있음'}</text>
      <rect class="wb-hit" x="${Math.min(p.anchor[0], cx) - 18}" y="${Math.min(p.anchor[1], cy) - 18}" width="${Math.abs(p.anchor[0] - cx) + 64}" height="${Math.abs(p.anchor[1] - cy) + 44}"/></g>`;
  }).join('');
  return `<svg viewBox="0 0 400 244" class="wb-over" aria-label="${part === 'pistol' ? '권총 분해도' : '슈트 분해도'}">${items}</svg>`;
}

/** Draws the art into the canvas at its low resolution; the canvas is scaled up with hard pixels by CSS. */
export function paintArt(canvas: HTMLCanvasElement, svg: string): void {
  const img = new Image();
  img.onload = () => {
    const g = canvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
