import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { paintBeacon, boltAlpha, easeOut, easeInOut, makeDeck } from './beacon';

/* ============================================================
   The hero's "cloud beacon" — one orange cloud-lightning mark that
   draws itself in, zaps, speaks a short mono status line, dissolves,
   and does it again. The drawing itself (cloud outline, bolt, status
   text) lives in beacon.js so this file and the Projects orbit map
   use the exact same mark.

   Two modes, picked once per viewport width:

   · WIDE    (≥ 900 CSS px) — the ORIGINAL edge-spots routine. One
                              mesh cycles 6 spots at the hero edges
                              with phases draw → zap → status → hold
                              → dissolve → gap. Spots are shuffled.
   · COMPACT (<  900 CSS px) — a tilted hairline ring orbits the
                              hero photo in 3D (darker in front,
                              lighter behind, invisible where it
                              passes behind the photo). Two grey
                              packets ride the full ring. The beacon
                              rides it too but only along the BACK:
                              it leaves one flank, disappears behind
                              the photo, and emerges on the other
                              flank to dock → zap → speak → hold →
                              leave. Keeps the beacon off the stacked
                              bio and badges, where the edge spots
                              would otherwise crash into the text.
   ============================================================ */

/* ---------------------- SHARED KNOBS ---------------------- */
const COMPACT_BREAKPOINT = 900;  // CSS px — halo below, edges above
const LINE_PX = 1.3;             // outline thickness (hairline)
const BOLT_PX = 1.8;             // bolt thickness
const STATUS_PX = 10;            // status text size

/* --- WIDE mode: edge spots (original behaviour) --- */
const CLOUD_PX = 112;            // cloud width on screen
const EDGE_PX = 84;              // beacon centre stays this far from any side edge
const WIDE_TIMES = {             // seconds per phase
  draw: 1.1, zap: 0.9, status: 0.45, hold: 2.4, dissolve: 0.7, gap: 1.4,
};
// Where the beacon may appear (fractions of the hero: x −0.5..0.5, y −0.5..0.5),
// kept away from the centred text/photo.
const SPOTS = [
  [-0.40, 0.30], [0.40, 0.32],
  [-0.42, -0.04], [0.42, -0.02],
  [-0.38, -0.33], [0.38, -0.31],
];

/* --- COMPACT mode: halo around the photo --- */
const COMPACT_CLOUD_PX = 54;     // smaller mark on phones so it reads tidy
const RING_SEGS = 180;           // ring resolution
const RING_AIR_PX = 28;          // ring sits this many CSS px outside the photo edge
const RING_TILT = (62 * Math.PI) / 180;
const RING_YAW = (8 * Math.PI) / 180;
const COMPACT_TIMES = {          // seconds per phase
  travel: 3.2, zap: 0.9, status: 0.4, hold: 2.6, leave: 0.3,
};
// Grey packets riding the ring: initial angle (rad), angular speed (rad/s)
const PACKETS = [
  { th0: 0, speed: 0.55 },
  { th0: 2.3, speed: 0.80 },
];

/* ---------------------------------------------------------- */

// Serious, engineer-coded status lines: [grey prefix, orange value]
const STATUS_LINES = [
  ['eu-north-1 · ', 'healthy'], ['uptime ', '99.99%'], ['deploy ', 'ok · 42s'],
  ['3 regions · ', 'green'], ['p99 ', '84ms'], ['pods ', '12/12 ready'],
  ['tls ', 'valid · 2027'], ['backups ', 'verified'], ['ci ', 'passing'],
  ['nginx ', '200 OK'], ['db ', 'replicated'], ['k8s ', 'v1.31 · stable'],
  ['cache hit ', '97%'], ['dns ', 'propagated'], ['error budget ', '98% left'],
  ['autoscale ', '3 → 5'], ['rollout ', 'complete'], ['latency ', '41ms'],
  ['s3 ', 'versioned'], ['iam ', 'least-privilege'], ['logs ', 'shipped'],
  ['alerts ', '0 firing'], ['cron ', 'on schedule'], ['certs ', 'auto-renew'],
];

const nextSpot = makeDeck(SPOTS);
const nextStatus = makeDeck(STATUS_LINES);

/* ============================================================
   WIDE MODE — the original edge-spot beacon.
   One mesh, one tiny state machine: draw → zap → status → hold →
   dissolve → gap, then jump to the next shuffled spot.
   ============================================================ */
const PHASES = ['draw', 'zap', 'status', 'hold', 'dissolve', 'gap'];

function EdgeSpotBeacon({ animate, dpr }) {
  const { viewport, size } = useThree();
  const meshRef = useRef();
  // Canvas + texture are created inside the animation loop (refs may be
  // read/written there, never during render) and disposed on unmount.
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const state = useRef({ phase: 0, t: 0, spot: nextSpot(), status: nextStatus() });

  useEffect(() => {
    return () => {
      if (textureRef.current) textureRef.current.dispose();
    };
  }, []);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // First frame: create the canvas + texture and attach it to the material.
    if (!textureRef.current) {
      const canvas = document.createElement('canvas');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      canvasRef.current = canvas;
      textureRef.current = texture;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }

    const delta = Math.min(rawDelta, 0.1); // cap so a background tab doesn't jump
    const st = state.current;

    // Advance the timeline
    if (animate) {
      st.t += delta;
      let dur = WIDE_TIMES[PHASES[st.phase]];
      while (st.t >= dur) {
        st.t -= dur;
        st.phase = (st.phase + 1) % PHASES.length;
        if (st.phase === 0) {
          // a fresh appearance: new spot, new status line
          st.spot = nextSpot();
          st.status = nextStatus();
        }
        dur = WIDE_TIMES[PHASES[st.phase]];
      }
    }

    // Work out what to show for the current phase
    const phase = PHASES[st.phase];
    let drawP = 1, boltA = 1, boltGlow = 0.35, statusA = 1, opacity = 1;
    if (!animate) {
      // reduced motion: a single, fully-drawn, still beacon
    } else if (phase === 'draw') {
      drawP = easeInOut(st.t / WIDE_TIMES.draw); boltA = 0; boltGlow = 0; statusA = 0;
    } else if (phase === 'zap') {
      boltA = boltAlpha(st.t); boltGlow = st.t < 0.4 ? 1 : 0.35; statusA = 0;
    } else if (phase === 'status') {
      statusA = easeOut(st.t / WIDE_TIMES.status);
    } else if (phase === 'hold') {
      // everything on
    } else if (phase === 'dissolve') {
      opacity = 1 - easeInOut(st.t / WIDE_TIMES.dissolve);
    } else if (phase === 'gap') {
      opacity = 0;
    }

    if (opacity > 0) {
      paintBeacon(canvasRef.current, dpr, {
        drawP, boltA, boltGlow, statusA, status: st.status,
        cloudPx: CLOUD_PX, linePx: LINE_PX, boltPx: BOLT_PX, statusPx: STATUS_PX,
      });
      textureRef.current.needsUpdate = true;
    }

    // Place and size the beacon. On narrow screens the edge spots would push
    // the status line past the viewport, so keep the centre at least EDGE_PX
    // (enough for the widest status line) inside each side.
    const pxToWorld = viewport.width / size.width;
    const w = CLOUD_PX * pxToWorld;
    const h = w * 1.3;
    const [sx, sy] = st.spot;
    const edge = EDGE_PX * pxToWorld;
    const maxX = Math.max(0, viewport.width / 2 - edge);
    const x = Math.min(maxX, Math.max(-maxX, sx * viewport.width));
    mesh.position.set(x, sy * viewport.height, 0);
    mesh.scale.set(w, h, 1);
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent depthTest={false} depthWrite={false} />
    </mesh>
  );
}

/* ============================================================
   COMPACT MODE — a tilted hairline ring orbits the photo.
   The ring is drawn with per-vertex colour: darker in front, lighter
   behind, and clamped to the paper colour where it passes behind the
   photo (so the orbit really reads in 3D). Two grey packets ride the
   WHOLE ring; the beacon rides along the BACK HALF only, docking on
   each flank for a strike + status line.
   ============================================================ */

// Where on the tilted ring is θ? Returns world x,y,z plus:
//   back    — true when the point is on the FAR side of the photo plane
//   hidden  — true when it would be drawn through the photo (don't draw)
function ringPoint(th, R, pw) {
  const x = R * Math.cos(th);
  const y = R * Math.sin(th);
  const y1 = y * Math.cos(RING_TILT);
  const z1 = y * Math.sin(RING_TILT);
  const x2 = x * Math.cos(RING_YAW) + z1 * Math.sin(RING_YAW);
  const z2 = -x * Math.sin(RING_YAW) + z1 * Math.cos(RING_YAW);
  const behindPhoto = z2 < 0 && Math.hypot(x2, y1) < pw.rPhoto;
  return { x: pw.cx + x2, y: pw.cy + y1, z: z2, back: z2 < 0, hidden: behindPhoto };
}

function HaloBeacon({ animate, dpr }) {
  const { viewport, size } = useThree();

  // Allocated once per instance; the position/color arrays are rewritten each frame.
  const ringPos = useMemo(() => new Float32Array((RING_SEGS + 1) * 3), []);
  const ringCol = useMemo(() => new Float32Array((RING_SEGS + 1) * 3), []);
  const COL_FRONT = useMemo(() => new THREE.Color(0xcfcfcf), []);
  const COL_BACK = useMemo(() => new THREE.Color(0xe6e6e6), []);
  const COL_HIDDEN = useMemo(() => new THREE.Color(0xfafafa), []);

  // Pre-build the ring as a THREE.Line and hand it to R3F via <primitive>.
  // (A JSX <line> element collides with the SVG element name; <primitive> is cleaner.)
  const ringLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(ringCol, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    return new THREE.Line(geo, mat);
  }, [ringPos, ringCol]);

  const packet1Ref = useRef();
  const packet2Ref = useRef();
  const beaconRef = useRef();
  const canvasRef = useRef(null);
  const textureRef = useRef(null);

  // Journey state. Start docked on the LEFT flank; the first travel heads
  // via the back to the RIGHT flank.
  const stateRef = useRef({
    th: Math.PI,
    phase: 'dock',
    t: 0,
    from: Math.PI,
    to: 2 * Math.PI,
    status: nextStatus(),
    tAcc: 0, // packets' continuous clock (not reset on dock changes)
  });

  useEffect(() => {
    return () => {
      if (textureRef.current) textureRef.current.dispose();
      ringLine.geometry.dispose();
      ringLine.material.dispose();
    };
  }, [ringLine]);

  useFrame((rootState, rawDelta) => {
    const beaconMesh = beaconRef.current;
    if (!beaconMesh) return;

    // Lazy-init the canvas + texture on the beacon material (first frame only).
    if (!textureRef.current) {
      const canvas = document.createElement('canvas');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      canvasRef.current = canvas;
      textureRef.current = texture;
      beaconMesh.material.map = texture;
      beaconMesh.material.needsUpdate = true;
    }

    // Find the photo in the DOM — the ring and docks are measured from it.
    // Not there yet (Hero still mounting)? Skip and try next frame.
    const photoEl = document.querySelector('.hero__photo');
    if (!photoEl) return;
    const photoRect = photoEl.getBoundingClientRect();
    const canvasEl = rootState.gl.domElement;
    const canvasRect = canvasEl.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    // CSS pixel → world unit, consistent with R3F's camera at this size.
    const pxToWorld = viewport.width / size.width;
    const cx = ((photoRect.left + photoRect.width / 2 - canvasRect.left) / canvasRect.width - 0.5) * viewport.width;
    const cy = -((photoRect.top + photoRect.height / 2 - canvasRect.top) / canvasRect.height - 0.5) * viewport.height;
    const rPhoto = (photoRect.width / 2 + 6) * pxToWorld;
    const R = rPhoto + RING_AIR_PX * pxToWorld;
    const pw = { cx, cy, rPhoto };

    const delta = Math.min(rawDelta, 0.1);
    const st = stateRef.current;
    if (animate) st.tAcc += delta;

    // ---- Ring: rewrite positions & per-vertex colours each frame ----
    for (let k = 0; k <= RING_SEGS; k++) {
      const th = (k / RING_SEGS) * Math.PI * 2;
      const p = ringPoint(th, R, pw);
      ringPos[k * 3] = p.x; ringPos[k * 3 + 1] = p.y; ringPos[k * 3 + 2] = p.z;
      const c = p.hidden ? COL_HIDDEN : p.back ? COL_BACK : COL_FRONT;
      ringCol[k * 3] = c.r; ringCol[k * 3 + 1] = c.g; ringCol[k * 3 + 2] = c.b;
    }
    ringLine.geometry.attributes.position.needsUpdate = true;
    ringLine.geometry.attributes.color.needsUpdate = true;

    // ---- Grey packets ride the whole ring ----
    const packetMeshes = [packet1Ref.current, packet2Ref.current];
    for (let i = 0; i < PACKETS.length; i++) {
      const m = packetMeshes[i];
      if (!m) continue;
      const cfg = PACKETS[i];
      const p = ringPoint(cfg.th0 + st.tAcc * cfg.speed, R, pw);
      m.position.set(p.x, p.y, p.z);
      m.visible = !p.hidden;
      m.material.opacity = p.back ? 0.45 : 1;
    }

    // ---- Beacon state machine: dock → travel → dock on the other flank ----
    let boltA = 0, glow = 0, statusA = 0;
    if (animate) {
      st.t += delta;
      if (st.phase === 'dock') {
        const { zap, status, hold, leave } = COMPACT_TIMES;
        if (st.t < zap) {
          boltA = boltAlpha(st.t); glow = st.t < 0.4 ? 1 : 0.35;
        } else if (st.t < zap + status) {
          boltA = 1; glow = 0.35; statusA = (st.t - zap) / status;
        } else if (st.t < zap + status + hold) {
          boltA = 1; glow = 0.35; statusA = 1;
        } else if (st.t < zap + status + hold + leave) {
          boltA = 1 - (st.t - zap - status - hold) / leave;
          statusA = boltA;
        } else {
          st.phase = 'travel'; st.t = 0; st.from = st.th;
          // Always travel via the back half (θ in [π, 2π])
          st.to = st.th > Math.PI * 1.5 ? Math.PI : 2 * Math.PI;
        }
      } else {
        const k = easeInOut(st.t / COMPACT_TIMES.travel);
        st.th = st.from + (st.to - st.from) * k;
        if (st.t >= COMPACT_TIMES.travel) {
          st.phase = 'dock'; st.t = 0;
          st.th = st.to === 2 * Math.PI ? 0 : Math.PI;
          st.status = nextStatus();
        }
      }
    } else {
      // reduced motion: a single still beacon on the left flank
      boltA = 1; glow = 0.35; statusA = 1;
    }

    // ---- Paint the beacon canvas & place the mesh on the ring ----
    paintBeacon(canvasRef.current, dpr, {
      drawP: 1, boltA, boltGlow: glow, statusA, status: st.status,
      cloudPx: COMPACT_CLOUD_PX, linePx: LINE_PX, boltPx: BOLT_PX, statusPx: STATUS_PX,
    });
    textureRef.current.needsUpdate = true;

    const p = ringPoint(st.th, R, pw);
    const w = COMPACT_CLOUD_PX * pxToWorld * (p.back ? 0.85 : 1);
    const h = w * 1.3;
    beaconMesh.scale.set(w, h, 1);
    // Nudge so the cloud (which sits in the top-left of its 24×26 box) lines up
    // on the ring point rather than the plane centre.
    beaconMesh.position.set(p.x - 0.07 * w, p.y + 0.10 * w, 0);
    beaconMesh.material.opacity = p.hidden ? 0 : p.back ? 0.55 : 1;
    beaconMesh.visible = beaconMesh.material.opacity > 0.02;
  });

  return (
    <>
      <primitive object={ringLine} />
      <mesh ref={packet1Ref}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#8a8a8a" transparent />
      </mesh>
      <mesh ref={packet2Ref}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#8a8a8a" transparent />
      </mesh>
      <mesh ref={beaconRef} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ---------------------- CANVAS WRAPPER ---------------------- */

export default function CloudBackground() {
  // Only one reason to stay still: the viewer prefers reduced motion.
  const animate = useMemo(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Compact mode kicks in on phones and small tablets, where the hero
  // layout stacks and the edge spots would otherwise crash into the bio
  // and badges. Desktop (and large tablets) keeps the original behaviour.
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < COMPACT_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < COMPACT_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Canvas
      /* R3F sets pointer-events:auto on its wrapper; this layer floats over the
         hero text and MUST stay click-through (badges, buttons, links) */
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      dpr={[1, 2]}
      frameloop={animate ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 5], fov: 50 }}
    >
      {compact ? (
        <HaloBeacon animate={animate} dpr={dpr} />
      ) : (
        <EdgeSpotBeacon animate={animate} dpr={dpr} />
      )}
    </Canvas>
  );
}
