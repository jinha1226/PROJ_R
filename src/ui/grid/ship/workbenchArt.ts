import type { ModSlot, WorkbenchSlot } from './workbenchTypes';

/** One part of an exploded drawing: its outline, where it sits on the body (for the guide line), and where its callout goes. */
interface Part { slot: ModSlot | null; paths: string[]; anchor: [number, number]; mount: [number, number]; callout: [number, number] }

// side view of the pistol, muzzle to the right; the four modded parts float off the body
const PISTOL: Part[] = [
  { slot: null, paths: ['M110 86 L252 86 L258 94 L258 112 L110 112 Z', 'M118 92 L236 92', 'M110 112 L238 112 L238 124 L176 124 L166 136 L148 136 L146 124 L110 124 Z', 'M178 124 Q188 140 172 144'], anchor: [180, 100], mount: [180, 100], callout: [0, 0] },
  { slot: 'barrel', paths: ['M292 94 L372 94 L372 106 L292 106 Z', 'M372 92 L380 92 L380 108 L372 108', 'M300 100 L364 100'], anchor: [332, 100], mount: [258, 100], callout: [300, 70] },
  { slot: 'sight', paths: ['M166 46 L206 46 L206 58 L166 58 Z', 'M174 58 L174 66 M198 58 L198 66', 'M206 50 L212 50 L212 54 L206 54'], anchor: [186, 52], mount: [186, 86], callout: [214, 30] },
  { slot: 'grip', paths: ['M52 132 L86 132 L78 188 L46 188 Z', 'M58 142 L80 142 M56 156 L78 156 M54 170 L76 170'], anchor: [66, 160], mount: [130, 156], callout: [10, 118] },
  { slot: 'mag', paths: ['M124 208 L152 208 L144 236 L118 236 Z', 'M126 216 L148 216'], anchor: [136, 222], mount: [136, 190], callout: [168, 226] },
  { slot: null, paths: ['M128 124 L160 124 L150 190 L118 190 Z'], anchor: [140, 160], mount: [140, 160], callout: [0, 0] },
];

// front view of the agent suit; plates float off the frame
const SUIT: Part[] = [
  { slot: null, paths: ['M200 22 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0', 'M190 24 L210 24', 'M176 60 L224 60 L230 128 L170 128 Z', 'M184 128 L192 200 M216 128 L208 200'], anchor: [200, 90], mount: [200, 90], callout: [0, 0] },
  { slot: 'chest', paths: ['M172 54 L228 54 L222 112 L178 112 Z', 'M200 66 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', 'M182 96 L218 96'], anchor: [200, 84], mount: [200, 84], callout: [236, 40] },
  { slot: 'arms', paths: ['M112 60 L140 60 L146 124 L120 124 Z', 'M260 60 L288 60 L280 124 L254 124 Z', 'M118 92 L142 92 M258 92 L282 92'], anchor: [130, 92], mount: [172, 70], callout: [40, 52] },
  { slot: 'legs', paths: ['M170 150 L194 150 L192 226 L172 226 Z', 'M206 150 L230 150 L228 226 L208 226 Z', 'M174 186 L190 186 M210 186 L226 186'], anchor: [200, 188], mount: [200, 130], callout: [238, 210] },
  { slot: 'back', paths: ['M316 64 L356 64 L356 128 L316 128 Z', 'M324 74 L348 74 M324 86 L348 86 M324 98 L348 98', 'M330 112 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'], anchor: [336, 96], mount: [230, 96], callout: [312, 40] },
];

/** The exploded drawing of the pistol or the suit as SVG; each modded part is a `[data-slot]` group with a callout. */
export function schematic(part: 'pistol' | 'suit', slots: WorkbenchSlot[], selected: ModSlot | null, flash: ModSlot | null): string {
  const parts = part === 'pistol' ? PISTOL : SUIT;
  const by = new Map(slots.map((s) => [s.slot, s]));
  const body = parts.map((p) => {
    const outline = p.paths.map((d) => `<path d="${d}"/>`).join('');
    if (!p.slot) return `<g class="wb-body">${outline}</g>`;
    const s = by.get(p.slot);
    const cls = `wb-part${s?.fitted ? ' fitted' : ''}${selected === p.slot ? ' sel' : ''}${flash === p.slot ? ' flash' : ''}`;
    const [cx, cy] = p.callout;
    const label = s ? `${s.label}${s.fitted ? ` · ${s.fitted.name}` : ''}` : '';
    return `<g class="${cls}" data-slot="${p.slot}" tabindex="0" role="button" aria-label="${label}">
      <line class="wb-guide" x1="${p.anchor[0]}" y1="${p.anchor[1]}" x2="${p.mount[0]}" y2="${p.mount[1]}"/>
      ${outline}
      <text x="${cx}" y="${cy}" class="wb-call">${s?.label ?? ''}</text>
      <text x="${cx}" y="${cy + 12}" class="wb-sub">${s?.fitted ? s.fitted.name : '비어 있음'}</text>
      <rect class="wb-hit" x="${Math.min(p.anchor[0], cx) - 14}" y="${Math.min(p.anchor[1], cy) - 16}" width="${Math.abs(p.anchor[0] - cx) + 60}" height="${Math.abs(p.anchor[1] - cy) + 40}"/>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 400 244" class="wb-svg" aria-label="${part === 'pistol' ? '권총 분해도' : '슈트 분해도'}">
    <defs><pattern id="wbgrid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 L0 0 0 16" class="wb-grid"/></pattern></defs>
    <rect width="400" height="244" fill="url(#wbgrid)"/>${body}</svg>`;
}
