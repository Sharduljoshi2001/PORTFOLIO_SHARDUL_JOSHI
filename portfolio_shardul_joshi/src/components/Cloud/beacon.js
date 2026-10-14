/* ============================================================
   THE BEACON — shared drawing code for the orange cloud-lightning mark.

   Used by two places that must look identical:
     · the hero (CloudBackground.jsx): one beacon at a time at the edges
     · the Projects orbit map (OrbitMap.jsx): one beacon at the centre
   Everything is painted onto a hidden 2D canvas that three.js then shows
   on a flat rectangle, so the lines stay crisp at any size.
   ============================================================ */

export const ORANGE = '#F38020';        // mirrors --color-beacon in global.css
export const STATUS_GRAY = '#555555';   // mirrors --color-text-secondary

// The cloud-lightning mark (same geometry as the nav icon), in a 24 × 26 box.
export const CLOUD_PATH = 'M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9';
export const CLOUD_LEN = 48;            // approx. outline length in path units (for the draw-in)
export const BOLT_POINTS = [[13, 11], [9, 17], [15, 17], [11, 23]];
export const BOX_W = 24;

export const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const easeInOut = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// Bolt brightness during the zap: on · off · on · off · on (then stays on)
export function boltAlpha(tz) {
  if (tz < 0.08) return 1;
  if (tz < 0.16) return 0.1;
  if (tz < 0.26) return 1;
  if (tz < 0.36) return 0.15;
  return 1;
}

/* ---------- shuffled decks (no repeats until exhausted) ---------- */
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeDeck(items) {
  let deck = [];
  let last = null;
  return () => {
    if (deck.length === 0) {
      deck = shuffle(items);
      if (deck.length > 1 && deck[deck.length - 1] === last) deck.unshift(deck.pop());
    }
    last = deck.pop();
    return last;
  };
}

/**
 * Paint one frame of the beacon onto `canvas`.
 *   drawP     0..1  how much of the cloud outline is drawn
 *   boltA     0..1  bolt brightness
 *   boltGlow  0..1  glow strength around the bolt
 *   statusA   0..1  status line brightness (0 = no status line)
 *   status    [greyPrefix, orangeValue] or null
 *   cloudPx / linePx / boltPx / statusPx  sizes in screen pixels
 */
export function paintBeacon(
  canvas,
  dpr,
  { drawP, boltA, boltGlow, statusA = 0, status = null, cloudPx = 112, linePx = 1.3, boltPx = 1.8, statusPx = 10 }
) {
  const cw = Math.round(cloudPx * dpr * 2);     // cloud box, supersampled
  const W = cw;
  const H = Math.round(cw * 1.3);                // extra room below for the status line
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const s = cw / BOX_W;                          // path units → canvas px
  const px = (v) => (v * dpr * 2) / s;           // screen px → path units

  // 1. cloud outline, drawing itself in
  if (drawP > 0) {
    ctx.save();
    ctx.scale(s, s);
    ctx.lineWidth = px(linePx);
    ctx.strokeStyle = ORANGE;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.setLineDash([CLOUD_LEN * drawP, CLOUD_LEN * 2]);
    ctx.stroke(new Path2D(CLOUD_PATH));
    ctx.restore();
  }

  // 2. the bolt (with a faint glow while it strikes)
  if (boltA > 0) {
    ctx.save();
    ctx.scale(s, s);
    ctx.globalAlpha = boltA;
    ctx.lineWidth = px(boltPx);
    ctx.strokeStyle = ORANGE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (boltGlow > 0) {
      ctx.shadowColor = `rgba(243,128,32,${0.9 * boltGlow})`;
      ctx.shadowBlur = px(7);
    }
    ctx.beginPath();
    BOLT_POINTS.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }

  // 3. status line beneath (grey prefix, orange value)
  if (statusA > 0 && status) {
    const [prefix, value] = status;
    const fontPx = statusPx * dpr * 2;
    ctx.save();
    ctx.globalAlpha = statusA;
    ctx.font = `500 ${fontPx}px 'Fira Mono', monospace`;
    ctx.textBaseline = 'middle';
    const wp = ctx.measureText(prefix).width;
    const wv = ctx.measureText(value).width;
    const x0 = (W - (wp + wv)) / 2;
    const y = cw * 1.16;
    ctx.textAlign = 'left';
    ctx.fillStyle = STATUS_GRAY;
    ctx.fillText(prefix, x0, y);
    ctx.fillStyle = ORANGE;
    ctx.fillText(value, x0 + wp, y);
    ctx.restore();
  }
}
