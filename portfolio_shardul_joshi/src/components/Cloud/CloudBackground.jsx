import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { paintBeacon, boltAlpha, easeOut, easeInOut, makeDeck } from './beacon';

/* ============================================================
   A single "cloud beacon" — the same cloud-lightning mark as the nav.

   One appearance, one spot at a time:
     1. the cloud outline DRAWS itself in (pen stroke)
     2. the bolt ZAPS in (two crisp flickers + a faint glow)
     3. a small mono STATUS LINE fades in beneath
     4. hold · dissolve · short gap · next spot
   Spots are shuffled and each is used once per cycle. Status lines
   come from a shuffled deck too, so nothing repeats for a long while.

   The drawing itself (outline, bolt, status text) lives in beacon.js
   and is shared with the Projects orbit map, so both marks match.
   ============================================================ */

/* ---------------------- TUNING KNOBS ---------------------- */
const CLOUD_PX = 112;            // cloud width on screen
const LINE_PX = 1.3;             // outline thickness (hairline)
const BOLT_PX = 1.8;             // bolt thickness
const STATUS_PX = 10;            // status text size
const EDGE_PX = 84;              // beacon centre never comes closer than this to a side edge
const TIMES = {                  // seconds
  draw: 1.1,                     // outline drawing itself in
  zap: 0.9,                      // bolt flicker-in
  status: 0.45,                  // status line fade-in
  hold: 2.4,                     // everything fully shown
  dissolve: 0.7,                 // fade out
  gap: 1.4,                      // nothing shown before the next spot
};
// Where the beacon may appear (fractions of the hero: x −0.5..0.5, y −0.5..0.5),
// kept away from the centred text/photo.
const SPOTS = [
  [-0.40, 0.30], [0.40, 0.32],
  [-0.42, -0.04], [0.42, -0.02],
  [-0.38, -0.33], [0.38, -0.31],
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

/* ---------- the beacon: one mesh, a tiny state machine ---------- */
const PHASES = ['draw', 'zap', 'status', 'hold', 'dissolve', 'gap'];

function Beacon({ animate, dpr }) {
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
      let dur = TIMES[PHASES[st.phase]];
      while (st.t >= dur) {
        st.t -= dur;
        st.phase = (st.phase + 1) % PHASES.length;
        if (st.phase === 0) {
          // a fresh appearance: new spot, new status line
          st.spot = nextSpot();
          st.status = nextStatus();
        }
        dur = TIMES[PHASES[st.phase]];
      }
    }

    // Work out what to show for the current phase
    const phase = PHASES[st.phase];
    let drawP = 1, boltA = 1, boltGlow = 0.35, statusA = 1, opacity = 1;
    if (!animate) {
      // reduced motion: a single, fully-drawn, still beacon
    } else if (phase === 'draw') {
      drawP = easeInOut(st.t / TIMES.draw); boltA = 0; boltGlow = 0; statusA = 0;
    } else if (phase === 'zap') {
      boltA = boltAlpha(st.t); boltGlow = st.t < 0.4 ? 1 : 0.35; statusA = 0;
    } else if (phase === 'status') {
      statusA = easeOut(st.t / TIMES.status);
    } else if (phase === 'hold') {
      // everything on
    } else if (phase === 'dissolve') {
      opacity = 1 - easeInOut(st.t / TIMES.dissolve);
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

export default function CloudBackground() {
  // Only one reason to stay still: the viewer prefers reduced motion.
  const animate = useMemo(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      <Beacon animate={animate} dpr={dpr} />
    </Canvas>
  );
}
