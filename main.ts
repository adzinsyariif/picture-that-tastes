// The Picture That Tastes of One — a honey-drizzled fig half, drawn procedurally.
// Zero-dependency, fully deterministic (fixed seed, no time, no network).
// Writes one PNG to OUTPUT_PATH (default /output/entry.png).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const OUT = process.env.OUTPUT_PATH ?? "/output/entry.png";

// ---------- deterministic PRNG ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261123);

// ---------- pixel buffer ----------
const buf = new Uint8ClampedArray(W * H * 4);
function idx(x: number, y: number): number { return (y * W + x) * 4; }
function setPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x, y);
  const sa = a / 255;
  const da = 1 - sa;
  buf[i] = r * sa + buf[i] * da;
  buf[i + 1] = g * sa + buf[i + 1] * da;
  buf[i + 2] = b * sa + buf[i + 2] * da;
  buf[i + 3] = 255;
}
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function smooth(t: number): number { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
type RGB = [number, number, number];
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---------- 1. backdrop: dark warm moody, soft glow behind subject ----------
const glowCx = 512, glowCy = 430;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - glowCx) / 720;
    const dy = (y - glowCy) / 640;
    const d = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.exp(-d * d * 2.2);
    // deep warm charcoal -> warm ember glow
    let r = lerp(16, 96, glow) + lerp(0, 26, Math.exp(-d * d * 0.9));
    let g = lerp(10, 52, glow);
    let b = lerp(10, 30, glow);
    // table surface: lower third slightly warmer/lighter, soft horizon
    const horizon = smooth((y - 640) / 260);
    r = lerp(r, r + 34, horizon * 0.55);
    g = lerp(g, g + 16, horizon * 0.55);
    b = lerp(b, b + 6, horizon * 0.55);
    // faint warm pool of light on the table under the fig
    const pool = Math.exp(-(((x - 512) / 330) ** 2 + ((y - 830) / 130) ** 2) * 1.6);
    r += 30 * pool; g += 14 * pool; b += 4 * pool;
    const i = idx(x, y);
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
}

// ---------- helpers for shapes ----------
// superellipse distance-ish value: <1 inside, >1 outside
function superEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, n: number): number {
  const dx = Math.abs(x - cx) / rx;
  const dy = Math.abs(y - cy) / ry;
  return Math.pow(Math.pow(dx, n) + Math.pow(dy, n), 1 / n);
}
// soft radial falloff for shadows
function softEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, soft: number): number {
  const d = superEllipse(x, y, cx, cy, rx, ry, 2);
  return smooth((1 + soft - d) / soft);
}

// ---------- 2. soft contact shadow ----------
for (let y = 700; y < 980; y++) {
  for (let x = 180; x < 850; x++) {
    const a = softEllipse(x, y, 512, 868, 296, 46, 0.75) * 0.38;
    if (a > 0.004) setPx(x, y, 4, 2, 2, a * 255);
  }
}

// ---------- 3. fig skin (outer body) ----------
const FIG_CX = 512, FIG_CY = 540;
const SKIN_RX = 320, SKIN_RY = 302;
// slight organic wobble via low-frequency sine on angle
function figRadiusScale(angle: number): number {
  return 1 + 0.018 * Math.sin(angle * 3 + 0.7) + 0.012 * Math.sin(angle * 7 + 2.1) - 0.010 * Math.cos(angle * 2 - 0.4);
}
function figInside(x: number, y: number, rx: number, ry: number): number {
  const ang = Math.atan2(y - FIG_CY, x - FIG_CX);
  const s = figRadiusScale(ang);
  return superEllipse(x, y, FIG_CX, FIG_CY, rx * s, ry * s, 2.15);
}
for (let y = FIG_CY - SKIN_RY - 14; y < FIG_CY + SKIN_RY + 14; y++) {
  for (let x = FIG_CX - SKIN_RX - 14; x < FIG_CX + SKIN_RX + 14; x++) {
    const d = figInside(x, y, SKIN_RX, SKIN_RY);
    if (d >= 1.02) continue;
    const edge = smooth((1.02 - d) / 0.03); // antialiased edge
    // gradient: deep plum at bottom, brighter violet-plum top-left
    const lx = (x - (FIG_CX - SKIN_RX)) / (2 * SKIN_RX);
    const ly = (y - (FIG_CY - SKIN_RY)) / (2 * SKIN_RY);
    const top = Math.exp(-((lx - 0.34) ** 2 + (ly - 0.26) ** 2) * 2.4);
    let c = mix([24, 7, 20], [96, 34, 64], smooth(ly * 0.7 + lx * 0.35));
    c = mix(c, [150, 76, 112], top * 0.5);
    // warm rim light on the upper-left edge
    const rim = Math.exp(-Math.pow((d - 0.97) / 0.035, 2)) * Math.exp(-((lx - 0.30) ** 2 + (ly - 0.22) ** 2) * 3.2);
    c = mix(c, [255, 176, 92], rim * 0.45);
    // cool faint rim bottom-right for roundness
    const rim2 = Math.exp(-Math.pow((d - 0.97) / 0.05, 2)) * Math.exp(-((lx - 0.82) ** 2 + (ly - 0.85) ** 2) * 3.0);
    c = mix(c, [120, 70, 110], rim2 * 0.4);
    setPx(x, y, c[0], c[1], c[2], edge * 255);
  }
}

// ---------- 4. cut face: pale flesh ring, then rose interior ----------
const FACE_RX = 288, FACE_RY = 272;
const FACE_CX = 512, FACE_CY = 546;
for (let y = FACE_CY - FACE_RY - 8; y < FACE_CY + FACE_RY + 8; y++) {
  for (let x = FACE_CX - FACE_RX - 8; x < FACE_CX + FACE_RX + 8; x++) {
    const d = superEllipse(x, y, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15);
    if (d >= 1.0) continue;
    const edge = smooth((1.0 - d) / 0.02);
    const lx = (x - (FACE_CX - FACE_RX)) / (2 * FACE_RX);
    const ly = (y - (FACE_CY - FACE_RY)) / (2 * FACE_RY);
    // thin pale green-cream flesh ring near the edge, deep juicy rose heart inside
    const ring = smooth((d - 0.92) / 0.06); // 0 centre -> 1 edge
    let c = mix([206, 56, 86], [232, 220, 192], ring); // deep rose -> pale cream-green
    // depth: deepen the rose just inside the ring, brighten the juicy centre
    const depth = Math.exp(-Math.pow((d - 0.80) / 0.10, 2));
    c = mix(c, [168, 38, 68], depth * 0.55);
    // centre starburst: lighter warm core
    const core = Math.exp(-((lx - 0.5) ** 2 + (ly - 0.52) ** 2) * 9);
    c = mix(c, [255, 178, 158], core * 0.5);
    // gentle top light
    const top = Math.exp(-((lx - 0.42) ** 2 + (ly - 0.30) ** 2) * 2.0);
    c = mix(c, [255, 226, 205], top * 0.28);
    setPx(x, y, c[0], c[1], c[2], edge * 255);
  }
}

// ---------- 4b. soft organic juiciness blotches inside the flesh ----------
for (let i = 0; i < 9; i++) {
  const ang = rand() * Math.PI * 2;
  const rr = 0.2 + rand() * 0.6;
  const cx = FACE_CX + Math.cos(ang) * rr * FACE_RX * 0.8;
  const cy = FACE_CY + Math.sin(ang) * rr * FACE_RY * 0.8;
  const brx = 34 + rand() * 46, bry = 26 + rand() * 34;
  const rot = rand() * Math.PI;
  const ca = Math.cos(rot), sa = Math.sin(rot);
  for (let y = Math.floor(cy - bry - 4); y <= Math.ceil(cy + bry + 4); y++) {
    for (let x = Math.floor(cx - brx - 4); x <= Math.ceil(cx + brx + 4); x++) {
      const dx = x - cx, dy = y - cy;
      const rx2 = dx * ca + dy * sa, ry2 = -dx * sa + dy * ca;
      const dd = Math.sqrt((rx2 / brx) ** 2 + (ry2 / bry) ** 2);
      if (dd > 1) continue;
      if (superEllipse(x, y, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15) > 0.9) continue;
      setPx(x, y, 178, 48, 78, smooth((1 - dd) / 0.5) * 22);
    }
  }
}

// ---------- 5. radial fibres in the flesh ----------
for (let a = 0; a < 140; a++) {
  const ang = (a / 140) * Math.PI * 2 + rand() * 0.05;
  const wob = rand() * 6 - 3;
  for (let r = 26; r < 235; r += 2) {
    const rr = r + Math.sin(r * 0.09 + a) * 2.2 + wob * (r / 235);
    const x = Math.round(FACE_CX + Math.cos(ang) * rr * (FACE_RX / 288));
    const y = Math.round(FACE_CY + Math.sin(ang) * rr * (FACE_RY / 272));
    const dd = superEllipse(x, y, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15);
    if (dd > 0.97) break;
    const alpha = (r < 60 ? 34 : 20) * (0.6 + 0.4 * Math.sin(r * 0.5));
    setPx(x, y, 255, 214, 196, alpha);
  }
}

// ---------- 6. seeds: smooth pale teardrops in concentric rings ----------
for (let ring = 0; ring < 5; ring++) {
  const baseR = 58 + ring * 32;
  const count = 12 + ring * 8;
  for (let s = 0; s < count; s++) {
    const ang = (s / count) * Math.PI * 2 + ring * 0.42 + (rand() - 0.5) * 0.22;
    const rr = baseR + (rand() - 0.5) * 18;
    if (rr < 44) continue; // keep the star core clear
    const cx = FACE_CX + Math.cos(ang) * rr * (FACE_RX / 288);
    const cy = FACE_CY + Math.sin(ang) * rr * (FACE_RY / 272);
    if (superEllipse(cx, cy, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15) > 0.95) continue;
    const sz = 1.8 + rand() * 1.4; // small teardrop, slightly elongated
    const ex = 1.0, ey = 1.35;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const ddx = dx / ex, ddy = dy / ey;
        const dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd > sz + 0.8) continue;
        const a = smooth((sz + 0.8 - dd) / 1.6);
        // faint warm shadow first (offset down-right), then pale body
        setPx(Math.round(cx + dx + 1), Math.round(cy + dy + 1), 150, 60, 70, a * 70);
        setPx(Math.round(cx + dx), Math.round(cy + dy), 238, 224, 196, a * 200);
      }
    }
    setPx(Math.round(cx - 0.5), Math.round(cy - 1), 255, 250, 235, 220);
  }
}

// ---------- 7. flesh micro-texture speckles (sparse, subtle) ----------
for (let i = 0; i < 1500; i++) {
  const ang = rand() * Math.PI * 2;
  const rr = Math.sqrt(rand()) * 0.96;
  const x = Math.round(FACE_CX + Math.cos(ang) * rr * FACE_RX);
  const y = Math.round(FACE_CY + Math.sin(ang) * rr * FACE_RY);
  if (superEllipse(x, y, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15) > 0.97) continue;
  const light = rand() > 0.5;
  setPx(x, y, light ? 255 : 150, light ? 205 : 40, light ? 185 : 70, 12 + rand() * 18);
}

// ---------- 8. honey drizzle: glossy golden ribbon + drips ----------
type Pt = [number, number];
function distToSeg(px: number, py: number, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = px - a[0], wy = py - a[1];
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
  t = clamp(t, 0, 1);
  const cx = a[0] + t * vx, cy = a[1] + t * vy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}
function strokePath(pts: Pt[], halfW: number | ((t: number) => number), color: RGB, alpha: number, hiColor: RGB, hiAlpha: number): void {
  const wAt = (i: number): number =>
    typeof halfW === "function" ? halfW(i / (pts.length - 1)) : halfW;
  // bounding box
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const maxW = Math.max(...pts.map((_, i) => wAt(i)));
  const pad = maxW + 6;
  for (let y = Math.floor(minY - pad); y <= Math.ceil(maxY + pad); y++) {
    for (let x = Math.floor(minX - pad); x <= Math.ceil(maxX + pad); x++) {
      let dmin = 1e9; let wmin = maxW;
      for (let s = 0; s < pts.length - 1; s++) {
        const d = distToSeg(x, y, pts[s], pts[s + 1]);
        if (d < dmin) { dmin = d; wmin = (wAt(s) + wAt(s + 1)) / 2; }
      }
      if (dmin > wmin + 2) continue;
      const body = smooth((wmin + 1 - dmin) / 2.5);
      if (body > 0) setPx(x, y, color[0], color[1], color[2], body * alpha);
      // glossy highlight: offset toward top of the ribbon, fades where ribbon narrows
      const hl = Math.exp(-Math.pow((dmin - wmin * 0.38) / 2.0, 2)) * 0.9;
      if (hl > 0.02) setPx(x, y, hiColor[0], hiColor[1], hiColor[2], hl * hiAlpha);
    }
  }
}
// main drizzle: a lazy S-curve across the top of the flesh
const drizzle: Pt[] = [];
for (let i = 0; i <= 24; i++) {
  const t = i / 24;
  const x = 268 + t * 490;
  const y = 402 + Math.sin(t * Math.PI * 1.35) * 52 - t * 18 + Math.sin(t * 9) * 5;
  drizzle.push([x, y]);
}
// translucent darker amber edge underneath for a glossy, syrupy look
strokePath(drizzle, (t) => 12 + 3.5 * Math.sin(t * Math.PI * 2.4 + 0.5), [128, 62, 4], 150, [255, 205, 90], 55);
strokePath(drizzle, (t) => 9 + 3 * Math.sin(t * Math.PI * 2.4 + 0.5), [178, 100, 8], 240, [255, 208, 96], 135);
// honey pool where the drizzle gathers at the centre (sits ON the ribbon)
for (let dy = -12; dy <= 12; dy++) for (let dx = -36; dx <= 36; dx++) {
  const dd = Math.sqrt((dx / 36) ** 2 + (dy / 10) ** 2);
  if (dd > 1) continue;
  const a = smooth((1 - dd) / 0.25);
  setPx(512 + dx, 436 + dy, 186, 108, 10, a * 235);
  if (dd < 0.55) setPx(512 + dx, 436 + dy, 255, 208, 100, smooth((0.55 - dd) / 0.3) * 140);
}
// second thinner drizzle lower down
const drizzle2: Pt[] = [];
for (let i = 0; i <= 20; i++) {
  const t = i / 20;
  const x = 300 + t * 420;
  const y = 596 + Math.sin(t * Math.PI * 1.1 + 0.6) * 30 + t * 10;
  drizzle2.push([x, y]);
}
strokePath(drizzle2, (t) => 8.5 + 2.5 * Math.sin(t * Math.PI * 2.0 + 1.2), [128, 62, 4], 140, [255, 205, 90], 50);
strokePath(drizzle2, (t) => 6.5 + 2 * Math.sin(t * Math.PI * 2.0 + 1.2), [186, 106, 10], 235, [255, 212, 100], 120);
// honey drips running down from the main ribbon
const dripXs = [330, 470, 640];
for (const dx of dripXs) {
  const len = 26 + rand() * 34;
  const topY = 402 + Math.sin(((dx - 268) / 490) * Math.PI * 1.35) * 44 - ((dx - 268) / 490) * 18;
  const pts: Pt[] = [[dx, topY], [dx + 2, topY + len * 0.6], [dx - 1, topY + len]];
  strokePath(pts, 4.5, [182, 104, 10], 240, [255, 212, 100], 175);
  // bead at the drip tip
  for (let dy = -6; dy <= 6; dy++) for (let ddx = -6; ddx <= 6; ddx++) {
    const dd = Math.sqrt(ddx * ddx + dy * dy);
    if (dd > 6) continue;
    const a = smooth((6 - dd) / 2);
    setPx(Math.round(dx - 1 + ddx), Math.round(topY + len + dy), 198, 118, 14, a * 240);
  }
  setPx(Math.round(dx - 3), Math.round(topY + len - 3), 255, 226, 140, 220);
}

// ---------- 9. juice droplets on the flesh (gloss) ----------
for (let i = 0; i < 10; i++) {
  const ang = rand() * Math.PI * 2;
  const rr = 0.25 + rand() * 0.62;
  const cx = FACE_CX + Math.cos(ang) * rr * FACE_RX;
  const cy = FACE_CY + Math.sin(ang) * rr * FACE_RY;
  if (superEllipse(cx, cy, FACE_CX, FACE_CY, FACE_RX, FACE_RY, 2.15) > 0.92) continue;
  const r = 3 + rand() * 4;
  for (let dy = -Math.ceil(r) - 1; dy <= Math.ceil(r) + 1; dy++) {
    for (let dx = -Math.ceil(r) - 1; dx <= Math.ceil(r) + 1; dx++) {
      const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > r) continue;
      const a = smooth((r - dd) / 1.6);
      // translucent rose-gold dome
      setPx(Math.round(cx + dx), Math.round(cy + dy), 255, 190, 150, a * 70);
      // bright specular dot top-left
      const sd = Math.sqrt((dx + r * 0.35) ** 2 + (dy + r * 0.4) ** 2);
      if (sd < r * 0.42) setPx(Math.round(cx + dx), Math.round(cy + dy), 255, 248, 230, smooth((r * 0.42 - sd) / 1.2) * 235);
    }
  }
}

// ---------- 10. (rim light is baked into the skin gradient, section 3) ----------

// ---------- 11. vignette + fine grain ----------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - 512) / 512, dy = (y - 512) / 512;
    const d = Math.sqrt(dx * dx + dy * dy);
    const vig = 1 - 0.22 * smooth((d - 0.62) / 0.55);
    const i = idx(x, y);
    const n = (rand() - 0.5) * 2.5;
    buf[i] = clamp(buf[i] * vig + n, 0, 255);
    buf[i + 1] = clamp(buf[i + 1] * vig + n, 0, 255);
    buf[i + 2] = clamp(buf[i + 2] * vig + n, 0, 255);
  }
}

// ---------- PNG encode (per-row best of filters 0/1/2, zlib) ----------
function filterRow(row: Buffer, prev: Buffer | null, filter: number): Buffer {
  const out = Buffer.alloc(1 + row.length);
  out[0] = filter;
  const bpp = 3;
  for (let i = 0; i < row.length; i++) {
    let v = row[i];
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
    if (filter === 1) v = (v - left) & 0xff;
    else if (filter === 2) v = (v - up) & 0xff;
    else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
      const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      v = (v - pred) & 0xff;
    }
    out[i + 1] = v;
  }
  return out;
}
function filterScore(b: Buffer): number {
  let s = 0;
  for (let i = 1; i < b.length; i++) { const v = b[i] > 127 ? b[i] - 256 : b[i]; s += Math.abs(v); }
  return s;
}
const rows: Buffer[] = [];
let prevRaw: Buffer | null = null;
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(W * 3);
  for (let x = 0; x < W; x++) {
    const s = idx(x, y);
    row[x * 3] = buf[s]; row[x * 3 + 1] = buf[s + 1]; row[x * 3 + 2] = buf[s + 2];
  }
  let best: Buffer | null = null; let bestScore = Infinity;
  for (const f of [0, 1, 2, 4]) {
    const cand = filterRow(row, prevRaw, f);
    const sc = filterScore(cand);
    if (sc < bestScore) { bestScore = sc; best = cand; }
  }
  rows.push(best!);
  prevRaw = row;
}
const raw = Buffer.concat(rows);
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes, ${W}x${H})`);
