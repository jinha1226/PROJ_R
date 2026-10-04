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

// front view of the agent suit (after the reference outline in public/assets/ui/pip): octagonal helmet, collar and chest plate,
// broad pauldrons, armoured limbs, a thigh pouch; the backpack floats off to the right
const SUIT: Part[] = [
  { slot: null, paths: [
    'M192 6 L208 6 L214 12 L214 22 L210 30 L190 30 L186 22 L186 12 Z', 'M190 18 L210 18', 'M194 30 L206 30 L206 36 L194 36 Z',
    'M176 40 L224 40 L232 52 L228 98 L218 112 L182 112 L172 98 L168 52 Z', 'M182 112 L218 112 L222 126 L178 126 Z',
    'M178 126 L198 126 L196 168 L192 200 L194 232 L176 232 L178 200 L176 168 Z', 'M202 126 L222 126 L224 168 L222 200 L224 232 L206 232 L208 200 L204 168 Z',
  ], anchor: [200, 90], mount: [200, 90], callout: [0, 0] },
  { slot: 'chest', paths: ['M184 38 L216 38 L222 46 L214 54 L186 54 L178 46 Z', 'M182 56 L218 56 L216 84 L200 90 L184 84 Z', 'M195 60 L205 60 L205 67 L195 67 Z', 'M188 72 L212 72 M190 78 L210 78'],
    anchor: [200, 70], mount: [200, 70], callout: [250, 22] },
  { slot: 'arms', paths: [
    'M140 40 L164 36 L170 50 L160 62 L140 58 Z', 'M140 66 L158 66 L156 104 L146 116 L136 110 L138 80 Z', 'M138 116 L148 116 L146 126 L138 124 Z', 'M142 84 L156 84',
    'M260 40 L236 36 L230 50 L240 62 L260 58 Z', 'M260 66 L242 66 L244 104 L254 116 L264 110 L262 80 Z', 'M262 116 L252 116 L254 126 L262 124 Z', 'M258 84 L244 84',
  ], anchor: [150, 80], mount: [170, 56], callout: [40, 44] },
  { slot: 'legs', paths: [
    'M180 134 L196 134 L194 160 L182 160 Z', 'M204 134 L220 134 L218 160 L206 160 Z', 'M222 138 L232 140 L230 158 L222 160 Z',
    'M182 168 L194 168 L193 176 L183 176 Z', 'M206 168 L218 168 L217 176 L207 176 Z', 'M180 184 L194 184 L192 222 L180 222 Z', 'M206 184 L220 184 L220 222 L208 222 Z',
  ], anchor: [200, 190], mount: [200, 128], callout: [250, 212] },
  { slot: 'back', paths: ['M300 50 L340 50 L346 58 L346 120 L300 120 Z', 'M310 62 L318 62 L318 70 L310 70 Z M326 62 L334 62 L334 70 L326 70 Z', 'M310 78 L318 78 L318 86 L310 86 Z M326 78 L334 78 L334 86 L326 86 Z', 'M310 94 L318 94 L318 102 L310 102 Z M326 94 L334 94 L334 102 L326 102 Z', 'M304 112 L342 112'],
    anchor: [322, 86], mount: [232, 80], callout: [306, 30] },
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
