import * as THREE from 'three';
import { CARD_SPECS, type CardKind } from './heroStore';

/**
 * Card "thumbnails" painted with Canvas 2D, so the hero is fully offline: no
 * image requests, no font CDN (drei <Text> would fetch one). Each painter draws
 * a believable screenshot of one kind of thing people save.
 */

type Ctx = CanvasRenderingContext2D;

interface Fonts {
  display: string;
  sans: string;
}

/** Pixels per world unit. */
const PX_PER_UNIT = { high: 440, low: 300 } as const;

function fonts(): Fonts {
  const cs = getComputedStyle(document.documentElement);
  const display = cs.getPropertyValue('--font-display').trim();
  const sans = cs.getPropertyValue('--font-inter').trim();
  return {
    display: `${display ? `${display}, ` : ''}Georgia, serif`,
    sans: `${sans ? `${sans}, ` : ''}system-ui, -apple-system, 'Segoe UI', sans-serif`,
  };
}

/** Small deterministic PRNG so textures look identical on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6
): number {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++;
      if (lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function heart(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.95, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35);
  ctx.closePath();
}

/* ------------------------------------------------------------------ reel */
function drawReel(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = W / 100;
  const rand = rng(7);

  // Warm, window-lit kitchen counter.
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3b2517');
  g.addColorStop(0.55, '#24160d');
  g.addColorStop(1, '#0e0805');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.15, H * 0.16, 0, W * 0.15, H * 0.16, W * 1.15);
  g.addColorStop(0, 'rgba(255, 200, 135, 0.55)');
  g.addColorStop(0.45, 'rgba(255, 150, 80, 0.12)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Linen cloth under the loaf.
  ctx.save();
  ctx.translate(W * 0.5, H * 0.6);
  ctx.rotate(-0.1);
  g = ctx.createLinearGradient(0, -H * 0.18, 0, H * 0.18);
  g.addColorStop(0, '#cdb89c');
  g.addColorStop(1, '#8a755c');
  ctx.fillStyle = g;
  ctx.fillRect(-W * 0.7, -H * 0.17, W * 1.4, H * 0.36);
  ctx.strokeStyle = 'rgba(60, 42, 26, 0.13)';
  ctx.lineWidth = Math.max(1, u * 0.18);
  for (let x = -W * 0.7; x < W * 0.7; x += u * 1.6) {
    ctx.beginPath();
    ctx.moveTo(x, -H * 0.17);
    ctx.lineTo(x, H * 0.19);
    ctx.stroke();
  }
  for (let y = -H * 0.17; y < H * 0.19; y += u * 1.6) {
    ctx.beginPath();
    ctx.moveTo(-W * 0.7, y);
    ctx.lineTo(W * 0.7, y);
    ctx.stroke();
  }
  ctx.restore();

  // Loaf shadow + loaf.
  const cx = W * 0.5;
  const cy = H * 0.55;
  const rx = W * 0.37;
  const ry = W * 0.27;
  g = ctx.createRadialGradient(cx + u * 4, cy + ry * 0.75, 0, cx + u * 4, cy + ry * 0.75, rx * 1.15);
  g.addColorStop(0, 'rgba(15, 8, 3, 0.75)');
  g.addColorStop(1, 'rgba(15, 8, 3, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx + u * 4, cy + ry * 0.7, rx * 1.15, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.5, rx * 0.08, cx, cy, rx * 1.05);
  g.addColorStop(0, '#f3cb88');
  g.addColorStop(0.4, '#d18e48');
  g.addColorStop(0.78, '#97501d');
  g.addColorStop(1, '#552a0e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, -0.05, 0, Math.PI * 2);
  ctx.fill();

  // Blistering.
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.92;
    ctx.fillStyle = `rgba(80, 35, 10, ${0.12 + rand() * 0.18})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, u * (0.25 + rand() * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // The "ear" score and two side cuts.
  const score = (x0: number, y0: number, x1: number, y1: number, bend: number, w: number) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(70, 30, 8, 0.65)';
    ctx.lineWidth = w + u * 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + u * 0.6);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend + u * 0.6, x1, y1 + u * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#f6dcaa';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend, x1, y1);
    ctx.stroke();
  };
  score(cx - rx * 0.62, cy - ry * 0.35, cx + rx * 0.55, cy + ry * 0.22, -ry * 0.35, u * 2.1);
  score(cx - rx * 0.45, cy + ry * 0.28, cx + rx * 0.05, cy + ry * 0.55, -ry * 0.05, u * 0.9);
  score(cx + rx * 0.1, cy - ry * 0.68, cx + rx * 0.6, cy - ry * 0.32, ry * 0.02, u * 0.9);

  // Flour dusting.
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.9;
    const y = cy + Math.sin(a) * ry * d;
    const top = 1 - (y - (cy - ry)) / (ry * 2);
    ctx.fillStyle = `rgba(255, 250, 240, ${(0.15 + rand() * 0.45) * (0.4 + top)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * d, y, u * (0.15 + rand() * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }

  // Lens vignette.
  g = ctx.createRadialGradient(W / 2, H * 0.5, W * 0.3, W / 2, H * 0.5, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Top chrome.
  g = ctx.createLinearGradient(0, 0, 0, H * 0.14);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.14);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${u * 6.2}px ${f.sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Reels', u * 6, H * 0.055);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = u * 0.9;
  rr(ctx, W - u * 14, H * 0.055 - u * 3.2, u * 8, u * 6.4, u * 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - u * 10, H * 0.055, u * 1.6, 0, Math.PI * 2);
  ctx.stroke();

  // Right action rail.
  const railX = W - u * 9;
  ctx.textAlign = 'center';
  ctx.font = `600 ${u * 3.4}px ${f.sans}`;
  heart(ctx, railX, H * 0.6, u * 5.2);
  ctx.fillStyle = '#ff3b5c';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('48.2K', railX, H * 0.6 + u * 5.4);
  ctx.lineWidth = u * 0.85;
  ctx.beginPath();
  ctx.arc(railX, H * 0.68, u * 3.2, 0.6, Math.PI * 2 + 0.2);
  ctx.lineTo(railX + u * 3.6, H * 0.68 + u * 3.4);
  ctx.closePath();
  ctx.stroke();
  ctx.fillText('1,204', railX, H * 0.68 + u * 6.2);
  ctx.beginPath();
  ctx.moveTo(railX - u * 3.4, H * 0.765);
  ctx.lineTo(railX + u * 3.4, H * 0.755 - u * 3.2);
  ctx.lineTo(railX + u * 0.6, H * 0.765 + u * 3.2);
  ctx.lineTo(railX - u * 0.4, H * 0.765);
  ctx.closePath();
  ctx.stroke();
  ctx.textAlign = 'left';

  // Bottom caption.
  g = ctx.createLinearGradient(0, H * 0.7, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);

  const ay = H * 0.835;
  g = ctx.createLinearGradient(u * 5, ay - u * 4, u * 13, ay + u * 4);
  g.addColorStop(0, '#feda75');
  g.addColorStop(0.5, '#fa7e1e');
  g.addColorStop(1, '#d62976');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(u * 9.5, ay, u * 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9c48c';
  ctx.beginPath();
  ctx.arc(u * 9.5, ay, u * 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `650 ${u * 4.2}px ${f.sans}`;
  ctx.fillText('wildyeast.co', u * 16, ay);
  const handleW = ctx.measureText('wildyeast.co').width;
  ctx.lineWidth = u * 0.5;
  rr(ctx, u * 19 + handleW, ay - u * 3, u * 15, u * 6, u * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.font = `600 ${u * 3.3}px ${f.sans}`;
  ctx.fillText('Follow', u * 21.8 + handleW, ay);

  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${u * 4.1}px ${f.sans}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('72-hour sourdough, the lazy way', u * 5, H * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `400 ${u * 3.5}px ${f.sans}`;
  ctx.fillText('cold proof · open crumb · #sourdough', u * 5, H * 0.935);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, H - u * 1.4, W, u * 1.4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, H - u * 1.4, W * 0.36, u * 1.4);
}

/* --------------------------------------------------------------- article */
function drawArticle(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = H / 100;
  const rand = rng(21);
  ctx.fillStyle = '#fbf8f3';
  ctx.fillRect(0, 0, W, H);

  // Browser chrome.
  const bar = u * 10;
  ctx.fillStyle = '#ebe4d8';
  ctx.fillRect(0, 0, W, bar);
  ['#e0695c', '#e2b257', '#77b75e'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(u * 5 + i * u * 4, bar / 2, u * 1.25, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#f9f6f0';
  rr(ctx, u * 20, u * 2.2, W - u * 30, bar - u * 4.4, u * 2.8);
  ctx.fill();
  ctx.fillStyle = '#7d7366';
  ctx.font = `500 ${u * 3.4}px ${f.sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('longreads.com/the-small-web-renaissance', u * 25, bar / 2 + u * 0.2);

  // Hero photograph: dusk over ridgelines.
  const top = bar;
  const imgH = H * 0.42;
  let g = ctx.createLinearGradient(0, top, 0, top + imgH);
  g.addColorStop(0, '#3d4a78');
  g.addColorStop(0.45, '#c9798a');
  g.addColorStop(0.75, '#f3a66b');
  g.addColorStop(1, '#f7c98d');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, imgH);
  g = ctx.createRadialGradient(W * 0.68, top + imgH * 0.72, 0, W * 0.68, top + imgH * 0.72, W * 0.3);
  g.addColorStop(0, 'rgba(255, 238, 200, 0.95)');
  g.addColorStop(0.12, 'rgba(255, 214, 150, 0.8)');
  g.addColorStop(1, 'rgba(255, 180, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, imgH);
  const ridges = ['#7b5068', '#4f3550', '#2e2236'];
  ridges.forEach((color, layer) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const base = top + imgH * (0.62 + layer * 0.13);
    ctx.moveTo(0, top + imgH);
    let y = base;
    for (let x = 0; x <= W; x += W / 40) {
      y += (rand() - 0.5) * u * (6 - layer);
      y = Math.min(Math.max(y, base - u * 9), base + u * 6);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, top + imgH);
    ctx.closePath();
    ctx.fill();
  });

  // Copy.
  const x = u * 7;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#d0501c';
  ctx.font = `700 ${u * 3.2}px ${f.sans}`;
  ctx.fillText('ESSAY  ·  14 MIN READ', x, top + imgH + u * 9);
  ctx.fillStyle = '#1f1a16';
  ctx.font = `650 ${u * 8.6}px ${f.display}`;
  ctx.fillText('The small-web renaissance', x, top + imgH + u * 19.5);
  ctx.fillStyle = '#7a6f62';
  ctx.font = `500 ${u * 3.4}px ${f.sans}`;
  ctx.fillText('By Mira Shah  ·  Sep 3', x, top + imgH + u * 26.5);
  ctx.fillStyle = '#4a423a';
  ctx.font = `400 ${u * 3.7}px ${f.sans}`;
  wrap(
    ctx,
    'Personal sites are quietly coming back — slower, stranger and far more human than the feeds they are replacing.',
    x,
    top + imgH + u * 34,
    W - x * 2,
    u * 5.4,
    3
  );
}

/* ------------------------------------------------------------------ chat */
function drawChat(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = W / 100;
  ctx.fillStyle = '#212121';
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ececec';
  ctx.font = `600 ${u * 4.6}px ${f.sans}`;
  ctx.fillText('ChatGPT', u * 6, u * 8);
  ctx.strokeStyle = '#9b9b9b';
  ctx.lineWidth = u * 0.6;
  const cw = ctx.measureText('ChatGPT').width;
  ctx.beginPath();
  ctx.moveTo(u * 8 + cw, u * 7.2);
  ctx.lineTo(u * 9.5 + cw, u * 8.7);
  ctx.lineTo(u * 11 + cw, u * 7.2);
  ctx.stroke();
  ctx.fillStyle = '#2f2f2f';
  rr(ctx, W - u * 27, u * 4.2, u * 21, u * 7.6, u * 3.8);
  ctx.fill();
  ctx.fillStyle = '#cfcfcf';
  ctx.font = `500 ${u * 3.2}px ${f.sans}`;
  ctx.fillText('Shared chat', W - u * 23.5, u * 8.1);
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(0, u * 15, W, u * 0.25);

  // User bubble.
  ctx.font = `450 ${u * 4}px ${f.sans}`;
  const q = 'How should I price a SaaS for India?';
  const qw = Math.min(ctx.measureText(q).width, W * 0.62);
  const bx = W - u * 6 - qw - u * 8;
  ctx.fillStyle = '#303030';
  rr(ctx, bx, u * 21, qw + u * 8, u * 15, u * 6);
  ctx.fill();
  ctx.fillStyle = '#ececec';
  ctx.textBaseline = 'alphabetic';
  wrap(ctx, q, bx + u * 4, u * 27.4, qw + u * 1, u * 5.6, 2);

  // Assistant answer.
  ctx.fillStyle = '#ececec';
  ctx.beginPath();
  ctx.arc(u * 9, u * 47, u * 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = u * 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(u * 9, u * 47, u * 2, u * 0.9, (i * Math.PI) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9d9d9';
  ctx.font = `400 ${u * 3.9}px ${f.sans}`;
  let y = wrap(
    ctx,
    'Lead with a generous free tier, then anchor Pro at ₹99/month — Indian buyers compare against UPI-priced apps, not US SaaS.',
    u * 16,
    u * 48.2,
    W - u * 22,
    u * 5.6,
    5
  );
  y += u * 2;
  ['Price in rupees, not dollars', 'Monthly — no annual lock-in', 'Make the upgrade obvious'].forEach((line) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.arc(u * 18, y - u * 1.3, u * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9d9d9';
    ctx.fillText(line, u * 21.5, y);
    y += u * 5.8;
  });

  // Composer.
  ctx.fillStyle = '#303030';
  rr(ctx, u * 5, H - u * 17, W - u * 10, u * 11, u * 5.5);
  ctx.fill();
  ctx.fillStyle = '#8e8e8e';
  ctx.font = `400 ${u * 3.6}px ${f.sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Message ChatGPT', u * 10, H - u * 11.5);
  ctx.fillStyle = '#ececec';
  ctx.beginPath();
  ctx.arc(W - u * 11.5, H - u * 11.5, u * 3.4, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ meme */
function drawMeme(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = W / 100;
  const rand = rng(99);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#5b6b7c';
  ctx.beginPath();
  ctx.arc(u * 10, u * 10, u * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9d3dc';
  ctx.beginPath();
  ctx.arc(u * 10, u * 8.6, u * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(u * 10, u * 13.4, u * 3.2, u * 2, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0f1419';
  ctx.font = `700 ${u * 4.2}px ${f.sans}`;
  ctx.fillText('tab hoarder', u * 18, u * 9.4);
  ctx.fillStyle = '#536471';
  ctx.font = `400 ${u * 3.7}px ${f.sans}`;
  ctx.fillText('@tabhoarder · 2h', u * 18, u * 14.4);

  ctx.fillStyle = '#0f1419';
  ctx.font = `400 ${u * 4.5}px ${f.sans}`;
  wrap(
    ctx,
    'me with 214 tabs open, too scared to close a single one because one of them is important',
    u * 6,
    u * 25,
    W - u * 12,
    u * 6,
    3
  );

  // The "photo": a laptop screen drowning in tabs.
  const ix = u * 6;
  const iy = u * 45;
  const iw = W - u * 12;
  const ih = H - iy - u * 13;
  ctx.save();
  rr(ctx, ix, iy, iw, ih, u * 3);
  ctx.clip();
  let g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, '#1d2733');
  g.addColorStop(1, '#0c1117');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = '#dfe3e8';
  ctx.fillRect(ix + u * 4, iy + u * 4, iw - u * 8, ih - u * 4);
  ctx.fillStyle = '#c3c9d1';
  ctx.fillRect(ix + u * 4, iy + u * 4, iw - u * 8, u * 6);
  const tabs = 46;
  const tw = (iw - u * 8) / tabs;
  for (let i = 0; i < tabs; i++) {
    const hue = Math.floor(rand() * 360);
    ctx.fillStyle = i === 30 ? '#ffffff' : '#d5dae0';
    ctx.fillRect(ix + u * 4 + i * tw + 0.5, iy + u * 4.6, tw - 1, u * 5.4);
    ctx.fillStyle = `hsl(${hue} 70% 50%)`;
    ctx.fillRect(ix + u * 4 + i * tw + tw * 0.25, iy + u * 6.4, tw * 0.5, tw * 0.5);
  }
  ctx.fillStyle = '#b8bec7';
  for (let i = 0; i < 6; i++) ctx.fillRect(ix + u * 10, iy + u * (16 + i * 4.2), (iw - u * 20) * (0.5 + rand() * 0.5), u * 1.6);
  g = ctx.createRadialGradient(ix + iw / 2, iy + ih / 2, iw * 0.2, ix + iw / 2, iy + ih / 2, iw * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.restore();

  ctx.fillStyle = '#536471';
  ctx.font = `400 ${u * 3.5}px ${f.sans}`;
  ctx.fillText('31.4K likes  ·  6,021 reposts  ·  412 replies', u * 6, H - u * 5);
}

/* ------------------------------------------------------------------ link */
function drawLink(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = H / 100;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // OG image.
  const s = H;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, s, s);
  const g = ctx.createRadialGradient(s * 0.75, s * 0.25, 0, s * 0.75, s * 0.25, s * 0.9);
  g.addColorStop(0, 'rgba(255, 122, 47, 0.55)');
  g.addColorStop(1, 'rgba(255, 122, 47, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((s / 8) * i, 0);
    ctx.lineTo((s / 8) * i, s);
    ctx.moveTo(0, (s / 8) * i);
    ctx.lineTo(s, (s / 8) * i);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffb36b';
  ctx.lineWidth = u * 1.2;
  ctx.beginPath();
  for (let x = 0; x <= s; x += 2) {
    const y = s * 0.62 + Math.sin(x / (s * 0.08)) * s * 0.08 * Math.cos(x / (s * 0.3));
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#e6edf3';
  ctx.font = `600 ${u * 7}px ${f.sans}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('nightowl /', u * 8, u * 18);
  ctx.font = `750 ${u * 9.5}px ${f.sans}`;
  ctx.fillText('tiny-shaders', u * 8, u * 30);

  // Meta.
  const x = s + u * 8;
  const maxW = W - x - u * 7;
  ctx.fillStyle = '#24292f';
  ctx.beginPath();
  ctx.arc(x + u * 3, u * 15, u * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57606a';
  ctx.font = `500 ${u * 5.4}px ${f.sans}`;
  ctx.fillText('github.com', x + u * 9, u * 17);
  ctx.fillStyle = '#1f2328';
  ctx.font = `650 ${u * 8}px ${f.display}`;
  let y = wrap(ctx, '60 tiny GLSL shaders, each under 280 characters', x, u * 36, maxW, u * 10, 2);
  ctx.fillStyle = '#57606a';
  ctx.font = `400 ${u * 5.2}px ${f.sans}`;
  y = wrap(ctx, 'A pocket collection of noise, light and water studies you can paste into any WebGL scene.', x, y + u * 3, maxW, u * 7, 3);
  ctx.fillStyle = '#d0501c';
  ctx.font = `600 ${u * 5}px ${f.sans}`;
  ctx.fillText('★ 8.9k    GLSL    MIT', x, Math.min(y + u * 5, H - u * 8));
}

/* ------------------------------------------------------------------ note */
function drawNote(ctx: Ctx, W: number, H: number, f: Fonts) {
  const u = W / 100;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fff7df');
  g.addColorStop(1, '#f5e6bf');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(110, 140, 190, 0.28)';
  ctx.lineWidth = Math.max(1, u * 0.25);
  for (let y = u * 26; y < H - u * 4; y += u * 8.6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(220, 90, 70, 0.4)';
  ctx.beginPath();
  ctx.moveTo(u * 12, 0);
  ctx.lineTo(u * 12, H);
  ctx.stroke();

  // Masking tape.
  ctx.save();
  ctx.translate(W / 2, u * 3);
  ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(214, 196, 160, 0.75)';
  ctx.fillRect(-u * 15, -u * 4, u * 30, u * 9);
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2a2118';
  ctx.font = `650 ${u * 7.4}px ${f.display}`;
  ctx.fillText('Gift ideas — Anya', u * 16, u * 21);
  ctx.font = `450 ${u * 4.9}px ${f.sans}`;
  ctx.fillStyle = '#3b3027';
  const items = ['ceramic pour-over (the reel!)', 'Kyoto pocket guidebook', 'linen apron, rust colour', 'that tiny-shaders print'];
  items.forEach((line, i) => {
    const y = u * (32.5 + i * 8.6);
    ctx.fillText(`—  ${line}`, u * 16, y);
  });
  ctx.strokeStyle = '#d0501c';
  ctx.lineWidth = u * 0.7;
  ctx.beginPath();
  ctx.moveTo(u * 16, u * 51.5);
  ctx.lineTo(u * 66, u * 50.5);
  ctx.stroke();

  ctx.fillStyle = 'rgba(208, 80, 28, 0.12)';
  rr(ctx, u * 16, H - u * 19, u * 28, u * 9, u * 4.5);
  ctx.fill();
  ctx.fillStyle = '#b8431f';
  ctx.font = `600 ${u * 4.2}px ${f.sans}`;
  ctx.fillText('#birthday', u * 20, H - u * 12.8);
}

const PAINTERS: Record<CardKind, (ctx: Ctx, W: number, H: number, f: Fonts) => void> = {
  reel: drawReel,
  article: drawArticle,
  chat: drawChat,
  meme: drawMeme,
  link: drawLink,
  note: drawNote,
};

function paint(canvas: HTMLCanvasElement, kind: CardKind) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  rr(ctx, 0, 0, W, H, Math.min(W, H) * 0.055);
  ctx.clip();
  PAINTERS[kind](ctx, W, H, fonts());
  ctx.restore();
}

export function createCardTexture(kind: CardKind, quality: 'high' | 'low', anisotropy: number): THREE.CanvasTexture {
  const [w, h] = CARD_SPECS[kind].size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX_PER_UNIT[quality]);
  canvas.height = Math.round(h * PX_PER_UNIT[quality]);
  paint(canvas, kind);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Repaint after web fonts finish loading (the first paint may use fallbacks). */
export function repaintCardTexture(texture: THREE.CanvasTexture, kind: CardKind) {
  const canvas = texture.image as HTMLCanvasElement;
  paint(canvas, kind);
  texture.needsUpdate = true;
}

/** Soft white radial falloff — tinted by the material colour for glows. */
export function createGlowTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}
