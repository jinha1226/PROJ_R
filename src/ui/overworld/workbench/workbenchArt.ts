import type { BenchSlot as ModSlot, WorkbenchSlot } from './benchModel';

/**
 * The workbench art is the outline drawings in public/assets/ui/pip (the pistol and the suit as drawn for the game).
 * Each modded part is a zone on that drawing: it lights up when selected or fitted, and a label points at it.
 */
interface Zone { slot: ModSlot; box: [number, number, number, number]; callout: [number, number] }
interface Art { file: string; view: [number, number]; stroke: number; place: [number, number, number]; zones: Zone[] }

// zones in each drawing's own coordinates; place = x, y, scale into the 400×244 stage
const ART: Record<'pistol' | 'suit', Art> = {
  pistol: {
    file: 'pistol_outline_green.svg', view: [800, 488], stroke: 3, place: [0, 0, 0.5],
    zones: [
      { slot: 'gun0', box: [596, 66, 780, 206], callout: [330, 118] },
      { slot: 'gun1', box: [34, 300, 192, 478], callout: [104, 214] },
    ],
  },
  suit: {
    file: 'suit_outline_green.svg', view: [252, 600], stroke: 2.4, place: [149, 0, 244 / 600],
    zones: [
      { slot: 'suit0', box: [86, 95, 168, 182], callout: [236, 44] },
    ],
  },
};

export interface ArtColors { fg: string; dim: string; line: string; warn: string; ch: string; fill: string; fitted: string }

const sources = new Map<string, Promise<string>>();
/** The drawing's paths with the background removed (fetched once). */
function source(file: string): Promise<string> {
  let p = sources.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}assets/ui/pip/${file}`).then((r) => r.text()).then((t) => t.replace(/<rect[^>]*\/>/, ''));
    sources.set(file, p);
  }
  return p;
}

/** The same drawing in one colour and line weight, as an image. */
function tinted(svg: string, color: string, stroke: number): Promise<HTMLImageElement> {
  const s = svg.replace(/stroke="#[0-9a-fA-F]{3,8}"/g, `stroke="${color}"`).replace(/stroke-width="[0-9.]+"/g, `stroke-width="${stroke}"`);
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
  });
}

/** Paints the drawing into the low-res canvas: dim overall, fitted parts in the main colour, the selected part bright. */
export async function paintBench(canvas: HTMLCanvasElement, part: 'pistol' | 'suit', slots: WorkbenchSlot[], selected: ModSlot | null, flash: ModSlot | null, c: ArtColors): Promise<void> {
  const art = ART[part];
  const svg = await source(art.file);
  const [dim, fg, warn, ch] = await Promise.all([c.dim, c.fg, c.warn, c.ch].map((col) => tinted(svg, col, art.stroke)));
  const g = canvas.getContext('2d');
  if (!g || !dim || !fg || !warn || !ch) return;
  const k = canvas.width / 400;
  const [ox, oy, sc] = art.place;
  const w = art.view[0] * sc * k, h = art.view[1] * sc * k;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(dim, ox * k, oy * k, w, h);
  const fitted = new Set(slots.filter((s) => s.fitted).map((s) => s.slot));
  const draw = (z: Zone, img: HTMLImageElement) => {
    const [x1, y1, x2, y2] = z.box.map((v) => v * sc * k) as [number, number, number, number];
    g.save();
    g.beginPath();
    g.rect(ox * k + x1, oy * k + y1, x2 - x1, y2 - y1);
    g.clip();
    g.drawImage(img, ox * k, oy * k, w, h);
    g.restore();
  };
  for (const z of art.zones) if (fitted.has(z.slot) && z.slot !== selected) draw(z, fg);
  const sel = art.zones.find((z) => z.slot === selected);
  if (sel) draw(sel, flash === sel.slot ? ch : warn);
}

/** Labels, guide lines and tap zones over the drawing (vector, so the text stays crisp). */
export function overlaySvg(part: 'pistol' | 'suit', slots: WorkbenchSlot[], selected: ModSlot | null): string {
  const art = ART[part];
  const [ox, oy, sc] = art.place;
  const by = new Map(slots.map((s) => [s.slot, s]));
  const items = art.zones.map((z) => {
    const s = by.get(z.slot);
    const [x1, y1, x2, y2] = z.box.map((v) => v * sc) as [number, number, number, number];
    const bx = ox + x1, bt = oy + y1, bw = x2 - x1, bh = y2 - y1;
    const [cx, cy] = z.callout;
    const label = s ? `${s.label}${s.fitted ? ` · ${s.fitted.name}` : ''}` : '';
    return `<g class="wb-part${s?.fitted ? ' fitted' : ''}${selected === z.slot ? ' sel' : ''}" data-slot="${z.slot}" tabindex="0" role="button" aria-label="${label}">
      <line class="wb-guide" x1="${bx + bw / 2}" y1="${bt + bh / 2}" x2="${cx}" y2="${cy + 4}"/>
      <rect class="wb-zone" x="${bx}" y="${bt}" width="${bw}" height="${bh}"/>
      <text x="${cx}" y="${cy}" class="wb-call">${s?.label ?? ''}</text>
      <text x="${cx}" y="${cy + 12}" class="wb-sub">${s?.fitted ? s.fitted.name : '비어 있음'}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 400 244" class="wb-over" aria-label="${part === 'pistol' ? '권총' : '슈트'}">${items}</svg>`;
}
