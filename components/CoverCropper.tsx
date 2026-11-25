'use client';

// Editing step after taking a cover photo: drag four corners onto the cover's corners
// (the photo is straightened into a rectangle), rotate, then adjust brightness,
// contrast and glare before saving. Everything runs in the browser.
import { useEffect, useRef, useState } from 'react';
import './CoverCropper.css';

type Pt = { x: number; y: number };
const MAX_SRC = 1600;   // working size of the photo (longest side)
const MAX_OUT = 1000;   // longest side of the straightened cover

/** Solve the 3×3 perspective transform mapping the unit rectangle (w×h) onto quad q. */
function homography(w: number, h: number, q: Pt[]): number[] {
  const src: Pt[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < 8; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < 8; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return [...x, 1];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Straighten the quad q of the source pixels into a rectangle. */
function warp(src: ImageData, q: Pt[]): ImageData {
  let w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  let h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const s = Math.min(1, MAX_OUT / Math.max(w, h));
  w = Math.max(10, Math.round(w * s)); h = Math.max(10, Math.round(h * s));
  const H = homography(w, h, q);
  const out = new ImageData(w, h);
  const sd = src.data, od = out.data, sw = src.width, sh = src.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const z = H[6] * x + H[7] * y + H[8];
      const u = (H[0] * x + H[1] * y + H[2]) / z;
      const v = (H[3] * x + H[4] * y + H[5]) / z;
      const x0 = Math.floor(u), y0 = Math.floor(v);
      const o = (y * w + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { od[o + 3] = 255; continue; }
      const fx = u - x0, fy = v - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx;
        const bot = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx;
        od[o + c] = top * (1 - fy) + bot * fy;
      }
      od[o + 3] = 255;
    }
  }
  return out;
}

/** Brightness and contrast (−50…50) and glare reduction (0…100): compresses near-white highlights. */
function adjust(img: ImageData, brightness: number, contrast: number, glare: number): ImageData {
  const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  const d = out.data;
  const cf = (100 + contrast) / 100;
  const t = 235 - glare * 0.9;          // highlights above this are pulled down
  const k = 1 - glare / 140;            // how strongly
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (glare > 0 && l > t) {
      const f = (t + (l - t) * k) / l;
      // Pull bright pixels down and toward their own colour, softening the white sheen.
      r = r * f; g = g * f; b = b * f;
    }
    r = (r - 128) * cf + 128 + brightness * 1.5;
    g = (g - 128) * cf + 128 + brightness * 1.5;
    b = (b - 128) * cf + 128 + brightness * 1.5;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return out;
}

function toData(bmp: ImageBitmap | HTMLCanvasElement, rotate: number): ImageData {
  const sw = bmp.width, sh = bmp.height;
  const s = Math.min(1, MAX_SRC / Math.max(sw, sh));
  const w = Math.round(sw * s), h = Math.round(sh * s);
  const swap = rotate % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/**
 * Find the cover's four corners: sample the background colour from the photo's edges,
 * mark pixels that differ from it (threshold chosen automatically), keep the largest
 * connected region and take its extreme points. Returns null when unsure.
 */
function detectCorners(img: ImageData): Pt[] | null {
  const W = 220, sc = W / img.width, H = Math.max(10, Math.round(img.height * sc));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(toCanvas(img), 0, 0, W, H);
  const n = W * H;
  // Smooth with a 5×5 box blur (done by hand: canvas blur filters are not supported everywhere).
  const raw = ctx.getImageData(0, 0, W, H).data;
  const d = new Float32Array(n * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, k = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = (yy * W + xx) * 4; r += raw[j]; g += raw[j + 1]; b += raw[j + 2]; k++;
    }
    const o = (y * W + x) * 4; d[o] = r / k; d[o + 1] = g / k; d[o + 2] = b / k;
  }
  // Features that ignore uneven lighting and shadows: two colour ratios (hue), plus
  // brightness with a low weight so a white cover on a dark table is still found.
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], s = r + g + b + 30;
    f[i * 3] = ((r - g) / s) * 400; f[i * 3 + 1] = ((g - b) / s) * 400; f[i * 3 + 2] = ((r + g + b) / 3) * 0.4;
  }
  // Background: median features of a frame 3px wide around the edge.
  const ch: number[][] = [[], [], []];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x > 2 && y > 2 && x < W - 3 && y < H - 3) continue;
    const i = (y * W + x) * 3; for (let k = 0; k < 3; k++) ch[k].push(f[i + k]);
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  const bgF = ch.map(med);
  const dist2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dist2[i] = Math.hypot(f[i * 3] - bgF[0], f[i * 3 + 1] - bgF[1], f[i * 3 + 2] - bgF[2]);
  }
  // Scale by the 99th percentile so a few extreme pixels do not skew the threshold.
  const max = Math.max(1, Float32Array.from(dist2).sort()[Math.floor(n * 0.99)]);
  // Otsu threshold on the colour distance.
  const hist = new Array(64).fill(0);
  for (let i = 0; i < n; i++) hist[Math.min(63, Math.floor((dist2[i] / max) * 64))]++;
  let sum = 0; for (let i = 0; i < 64; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 16;
  for (let t = 0; t < 64; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sB += t * hist[t];
    const between = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
    if (between > best) { best = between; th = t; }
  }
  const cut = Math.max(((th + 0.5) / 64) * max, 15);
  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = dist2[i] > cut ? 1 : 0;
  // Close small gaps (dilate, then erode).
  const morph = (m: Uint8Array, grow: boolean) => {
    const o = new Uint8Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        const m2 = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : m[yy * W + xx];
        if (grow && m2) v = 1; if (!grow && !m2) v = 0;
      }
      o[y * W + x] = v;
    }
    return o;
  };
  mask = morph(morph(mask, true), false);
  // Largest connected region.
  const label = new Int32Array(n).fill(-1);
  let bestId = -1, bestSize = 0;
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    let size = 0; label[i] = i; stack.push(i);
    while (stack.length) {
      const k = stack.pop()!; size++;
      const x = k % W, y = (k - x) / W;
      const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const j of nb) if (j >= 0 && mask[j] && label[j] < 0) { label[j] = i; stack.push(j); }
    }
    if (size > bestSize) { bestSize = size; bestId = i; }
  }
  if (bestId < 0 || bestSize < n * 0.05 || bestSize > n * 0.97) return null;
  // Extreme points: top-left minimises x+y, bottom-right maximises it, and so on.
  let tl = 0, tr = 0, brI = 0, bl = 0, minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
  for (let i = 0; i < n; i++) {
    if (label[i] !== bestId) continue;
    const x = i % W, y = (i - x) / W, s1 = x + y, d1 = x - y;
    if (s1 < minS) { minS = s1; tl = i; } if (s1 > maxS) { maxS = s1; brI = i; }
    if (d1 > maxD) { maxD = d1; tr = i; } if (d1 < minD) { minD = d1; bl = i; }
  }
  const pt = (i: number): Pt => ({ x: ((i % W) + 0.5) / sc, y: (Math.floor(i / W) + 0.5) / sc });
  const q = [pt(tl), pt(tr), pt(brI), pt(bl)];
  // Sanity: the quad must cover a fair part of the region and not be degenerate.
  const area = Math.abs(q.reduce((a, p, i) => { const r = q[(i + 1) % 4]; return a + p.x * r.y - r.x * p.y; }, 0)) / 2;
  if (area < bestSize / (sc * sc) * 0.6) return null;
  return q;
}

/**
 * Refine a rough quad using the photo's edges: each side is moved (both of its
 * ends independently, along the side's normal) to where the brightness or colour
 * changes most sharply along the whole side. The corners are the intersections.
 */
function refineQuad(img: ImageData, q: Pt[]): Pt[] {
  const W = 400, sc = W / img.width, H = Math.round(img.height * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(toCanvas(img), 0, 0, W, H);
  const raw = ctx.getImageData(0, 0, W, H).data;
  // Gradient (Sobel) per channel; keep the channel with the strongest change.
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let bx = 0, by = 0, bm = -1;
    for (let ch = 0; ch < 3; ch++) {
      const p = (xx: number, yy: number) => raw[(yy * W + xx) * 4 + ch];
      const sx = p(x + 1, y - 1) + 2 * p(x + 1, y) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x - 1, y) - p(x - 1, y + 1);
      const sy = p(x - 1, y + 1) + 2 * p(x, y + 1) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x, y - 1) - p(x + 1, y - 1);
      const m = sx * sx + sy * sy;
      if (m > bm) { bm = m; bx = sx; by = sy; }
    }
    gx[y * W + x] = bx; gy[y * W + x] = by;
  }
  const P = q.map((p) => ({ x: p.x * sc, y: p.y * sc }));
  const lines: { p: Pt; d: Pt }[] = [];
  for (let s = 0; s < 4; s++) {
    const a = P[s], b = P[(s + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len, nx = -dy, ny = dx;
    const R = Math.round(Math.max(W, H) * 0.06), step = 1;
    let best = -1, bo1 = 0, bo2 = 0;
    for (let o1 = -R; o1 <= R; o1 += step) for (let o2 = -R; o2 <= R; o2 += step) {
      const ax = a.x + nx * o1, ay = a.y + ny * o1, bx = b.x + nx * o2, by = b.y + ny * o2;
      const L = Math.hypot(bx - ax, by - ay);
      const tx = (bx - ax) / L, ty = (by - ay) / L, mx = -ty, my = tx;
      let sum = 0, cnt = 0;
      // Skip the 10% next to each corner, where other edges and rounding interfere.
      for (let t = 0.1; t <= 0.9; t += 1.5 / L) {
        const x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        const k = y * W + x;
        sum += Math.abs(gx[k] * mx + gy[k] * my); cnt++;
      }
      const score = cnt ? sum / cnt : 0;
      if (score > best) { best = score; bo1 = o1; bo2 = o2; }
    }
    const pa = { x: a.x + nx * bo1, y: a.y + ny * bo1 }, pb = { x: b.x + nx * bo2, y: b.y + ny * bo2 };
    lines.push({ p: pa, d: { x: pb.x - pa.x, y: pb.y - pa.y } });
  }
  const meet = (l1: { p: Pt; d: Pt }, l2: { p: Pt; d: Pt }): Pt => {
    const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
    return { x: (l1.p.x + l1.d.x * t) / sc, y: (l1.p.y + l1.d.y * t) / sc };
  };
  // Corner i lies between side i-1 and side i.
  const out = [0, 1, 2, 3].map((i) => meet(lines[(i + 3) % 4], lines[i]));
  if (out.some((p) => !isFinite(p.x) || !isFinite(p.y))) return q;
  return out.map((p) => ({ x: Math.min(img.width, Math.max(0, p.x)), y: Math.min(img.height, Math.max(0, p.y)) }));
}

/** Rough corners from colour, then sharpened on the photo's edges. */
function findCorners(img: ImageData): Pt[] | null {
  const q = detectCorners(img);
  return q ? refineQuad(img, q) : null;
}

const initialQuad = (w: number, h: number): Pt[] => {
  const mx = w * 0.08, my = h * 0.06;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
};

const fullQuad = (w: number, h: number): Pt[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];

export default function CoverCropper({ file, onDone, onCancel, detect = true }: {
  file: File;
  /** false: start with the whole image selected instead of detecting the cover's corners. */
  detect?: boolean;
  onDone: (img: ImageBitmap) => void;
  onCancel: () => void;
}) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [rotate, setRotate] = useState(0);
  const [src, setSrc] = useState<ImageData | null>(null);
  const [quad, setQuad] = useState<Pt[]>([]);
  const [step, setStep] = useState<'crop' | 'adjust'>('crop');
  const [warped, setWarped] = useState<ImageData | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [glare, setGlare] = useState(0);
  const [err, setErr] = useState('');
  const [auto, setAuto] = useState(false); // corners were found automatically
  const cropCanvas = useRef<HTMLCanvasElement>(null);
  const outCanvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    createImageBitmap(file).then(setBmp).catch(() => setErr('לא הצלחנו לפתוח את התמונה.'));
  }, [file]);

  useEffect(() => {
    if (!bmp) return;
    const d = toData(bmp, rotate);
    setSrc(d);
    if (!detect) { setAuto(false); setQuad(fullQuad(d.width, d.height)); return; }
    let found: Pt[] | null = null;
    try { found = findCorners(d); } catch { found = null; }
    setAuto(!!found);
    setQuad(found ?? initialQuad(d.width, d.height));
  }, [bmp, rotate, detect]);

  // Draw the photo with the selected area.
  useEffect(() => {
    const c = cropCanvas.current;
    if (!c || !src || step !== 'crop') return;
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(src, 0, 0);
    if (quad.length !== 4) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height);
    ctx.moveTo(quad[0].x, quad[0].y);
    for (const p of [quad[3], quad[2], quad[1]]) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();
    const lw = Math.max(2, c.width / 250);
    ctx.strokeStyle = '#f5c518'; ctx.lineWidth = lw;
    ctx.beginPath(); quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
  }, [src, quad, step]);

  // Live preview of the adjustments.
  useEffect(() => {
    const c = outCanvas.current;
    if (!c || !warped || step !== 'adjust') return;
    c.width = warped.width; c.height = warped.height;
    c.getContext('2d')!.putImageData(adjust(warped, brightness, contrast, glare), 0, 0);
  }, [warped, brightness, contrast, glare, step]);

  // Corner handles are positioned over the canvas in screen pixels.
  const [box, setBox] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const c = cropCanvas.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setBox({ w: c.clientWidth, h: c.clientHeight }));
    ro.observe(c);
    return () => ro.disconnect();
  }, [src, step]);
  const scale = src ? box.w / src.width : 1;

  function pointerPos(e: React.PointerEvent): Pt {
    const r = cropCanvas.current!.getBoundingClientRect();
    return {
      x: Math.min(src!.width, Math.max(0, (e.clientX - r.left) / scale)),
      y: Math.min(src!.height, Math.max(0, (e.clientY - r.top) / scale)),
    };
  }

  function next() {
    if (!src) return;
    setWarped(warp(src, quad));
    setStep('adjust');
  }

  async function save(raw = false) {
    try {
      if (raw) { onDone(await createImageBitmap(toCanvas(src!))); return; }
      const c = document.createElement('canvas');
      const data = adjust(warped!, brightness, contrast, glare);
      c.width = data.width; c.height = data.height;
      c.getContext('2d')!.putImageData(data, 0, 0);
      onDone(await createImageBitmap(c));
    } catch {
      setErr('השמירה נכשלה. נסו שוב.');
    }
  }

  const corners = ['פינה עליונה שמאלית', 'פינה עליונה ימנית', 'פינה תחתונה ימנית', 'פינה תחתונה שמאלית'];

  return (
    <div className="cropper" role="dialog" aria-modal="true" aria-label="עריכת הכריכה">
      <div className="cropper-panel">
        {err && <p className="msg err">{err}</p>}
        {!src && !err && <p className="status">פותח את התמונה…</p>}

        {src && step === 'crop' && (
          <>
            <p className="cropper-hint">{!detect
              ? 'כל התמונה מסומנת. אם צריך, גררו את הנקודות הצהובות לפינות הכריכה.'
              : auto
              ? 'זיהינו את פינות הכריכה. אם צריך, גררו את הנקודות הצהובות למקום המדויק.'
              : 'לא הצלחנו לזהות את הפינות. גררו את ארבע הנקודות הצהובות לפינות הכריכה.'} התמונה תיושר אוטומטית.</p>
            <div className="cropper-stage" onPointerMove={(e) => {
              if (drag.current == null) return;
              const p = pointerPos(e);
              setQuad((q) => q.map((v, i) => (i === drag.current ? p : v)));
            }} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
              <canvas ref={cropCanvas} className="cropper-canvas" />
              {quad.map((p, i) => (
                <button
                  key={i} type="button" className="handle" aria-label={corners[i]}
                  style={{ left: p.x * scale, top: p.y * scale }}
                  onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = i; }}
                  onPointerMove={(e) => {
                    if (drag.current !== i) return;
                    const pt = pointerPos(e);
                    setQuad((q) => q.map((v, j) => (j === i ? pt : v)));
                  }}
                  onPointerUp={() => { drag.current = null; }}
                />
              ))}
            </div>
            <div className="cropper-actions">
              <button className="btn dark" type="button" onClick={next}>המשך</button>
              <button className="btn ghost" type="button" onClick={() => setRotate((r) => (r + 90) % 360)}>סיבוב ↻</button>
              <button className="btn ghost" type="button" onClick={() => { if (!detect) { setQuad(fullQuad(src.width, src.height)); return; } let f: Pt[] | null = null; try { f = findCorners(src); } catch { f = null; } setAuto(!!f); setQuad(f ?? initialQuad(src.width, src.height)); }}>איפוס</button>
              <button className="btn ghost" type="button" onClick={() => save(true)}>שמירה בלי עריכה</button>
              <button className="btn ghost" type="button" onClick={onCancel}>ביטול</button>
            </div>
          </>
        )}

        {step === 'adjust' && warped && (
          <>
            <div className="cropper-preview"><canvas ref={outCanvas} /></div>
            <div className="cropper-sliders">
              <label>הפחתת הבזקים <input type="range" min={0} max={100} value={glare} onChange={(e) => setGlare(+e.target.value)} /></label>
              <label>בהירות <input type="range" min={-50} max={50} value={brightness} onChange={(e) => setBrightness(+e.target.value)} /></label>
              <label>ניגודיות <input type="range" min={-50} max={50} value={contrast} onChange={(e) => setContrast(+e.target.value)} /></label>
            </div>
            <p className="cropper-hint">הפחתת הבזקים מעמעמת אזורים לבנים מבוהקים. היא לא משחזרת פרטים שהבוהק הסתיר, אז עדיף לצלם בלי פלאש ובזווית קלה למנורה.</p>
            <div className="cropper-actions">
              <button className="btn dark" type="button" onClick={() => save()}>שמירת הכריכה</button>
              <button className="btn ghost" type="button" onClick={() => { setStep('crop'); setGlare(0); setBrightness(0); setContrast(0); }}>חזרה לחיתוך</button>
              <button className="btn ghost" type="button" onClick={onCancel}>ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function toCanvas(d: ImageData) {
  const c = document.createElement('canvas');
  c.width = d.width; c.height = d.height;
  c.getContext('2d')!.putImageData(d, 0, 0);
  return c;
}
