import './FormBeacon.css';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { paintBeacon, boltAlpha, easeInOut } from '../Cloud/beacon';
import { CAMERA, planeSize, elementToWorld, prefersReducedMotion } from './stageMath';

/* ============================================================
   FORM BEACON — the orange cloud-lightning mark on the Contact card.
   It lives on its own transparent layer ABOVE the frosted glass (the
   wind field stays behind), and nothing orange exists until the
   visitor engages:
     wake()        outline draws itself in at the anchor, bolt zaps in
     charge(0..1)  bolt brightens a step per completed field (with a flick)
     strike()      the full strike (on Send)
     sleep()       dissolves back to nothing
   `anchorRef.current` is the DOM element it should sit on: the card's
   corner seal before sending, the centre of the "received" card after.
   The page's requests arrive as read-only counters; the scene keeps its
   own state. Drawing is the shared beacon.js, so it matches the hero.
   ============================================================ */

/* ---------------------- TUNING KNOBS ---------------------- */
const CLOUD_PX = 48;                       // mark width on screen
const TIMES = { draw: 1.1, zap: 0.9 };     // seconds
const REST = 0.75;                         // bolt brightness once awake (→ 1 when the form is complete)
const FLICK = 0.14;                        // acknowledgement flick (s)
/* ---------------------------------------------------------- */

function BeaconScene({ inbox, anchorRef, hostRef, animate }) {
  const { gl, size } = useThree();
  const meshRef = useRef();
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const state = useRef({
    phase: 'dormant', t: 0, drawP: 0, boltA: 0, level: 0, flick: 0, fade: 0, px: 0, py: 0, target: null,
    seen: { wake: 0, strike: 0, sleep: 0 },
  });

  useEffect(() => {
    return () => { if (textureRef.current) textureRef.current.dispose(); };
  }, []);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
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

    const delta = Math.min(rawDelta, 0.1);
    const b = state.current;
    const cmd = inbox.current;
    const { W, H } = planeSize(size);
    const anchor = anchorRef.current;

    // ---- requests from the page (counters: each new value is one request) ----
    if (cmd.wakeSeq !== b.seen.wake) {
      b.seen.wake = cmd.wakeSeq;
      if (b.phase === 'dormant') {
        b.phase = animate ? 'drawing' : 'charged';
        b.t = 0;
        if (!animate) b.drawP = 1;
        if (anchor) [b.px, b.py] = elementToWorld(anchor, gl.domElement, W, H);
      }
    }
    if (cmd.level !== b.level) {
      if (cmd.level > b.level && b.phase !== 'dormant') b.flick = FLICK;
      b.level = cmd.level;
    }
    if (cmd.strikeSeq !== b.seen.strike) { b.seen.strike = cmd.strikeSeq; if (b.phase !== 'dormant') { b.phase = 'strike'; b.t = 0; } }
    if (cmd.sleepSeq !== b.seen.sleep) { b.seen.sleep = cmd.sleepSeq; if (b.phase !== 'dormant') { b.phase = 'sleep'; b.t = 0; } }

    // ---- glide toward the anchor ----
    if (b.phase !== 'dormant' && b.phase !== 'sleep' && anchor) b.target = elementToWorld(anchor, gl.domElement, W, H);
    if (b.target) { b.px += (b.target[0] - b.px) * 0.08; b.py += (b.target[1] - b.py) * 0.08; }

    // ---- the phases ----
    let glow = 0;
    let boltA = b.boltA;
    if (b.phase === 'dormant') {
      b.fade = Math.max(0, b.fade - delta * 3);
    } else if (b.phase === 'drawing') {                       // outline draws itself in
      b.t += delta; b.fade = Math.min(1, b.fade + delta * 3);
      b.drawP = easeInOut(b.t / TIMES.draw); boltA = 0;
      if (b.t >= TIMES.draw) { b.phase = 'wake'; b.t = 0; }
    } else if (b.phase === 'wake') {                          // then the bolt zaps in
      b.t += delta; b.drawP = 1;
      boltA = boltAlpha(b.t); glow = b.t < 0.4 ? 1 : 0.35;
      if (b.t >= TIMES.zap) { b.phase = 'charged'; b.t = 0; }
    } else if (b.phase === 'charged') {                       // rests, brighter as fields complete
      b.fade = Math.min(1, b.fade + delta * 3); b.drawP = 1;
      boltA += ((REST + (1 - REST) * b.level) - boltA) * 0.08;
      glow = 0.2 + 0.15 * b.level;
    } else if (b.phase === 'strike') {                        // the real strike (Send)
      b.t += delta; b.drawP = 1;
      boltA = boltAlpha(b.t); glow = b.t < 0.4 ? 1 : 0.35;
      if (b.t >= TIMES.zap) { b.phase = 'held'; b.t = 0; }
    } else if (b.phase === 'held') {
      b.drawP = 1; boltA = 1; glow = 0.35;
    } else if (b.phase === 'sleep') {
      b.fade = Math.max(0, b.fade - delta * 2.5);
      if (b.fade <= 0) { b.phase = 'dormant'; b.drawP = 0; b.boltA = 0; b.target = null; }
    }
    if (b.flick > 0) {                                        // acknowledgement flick
      b.flick -= delta; boltA = Math.max(boltA, 0.55); glow = 1;
      if (b.flick < 0.07) boltA = 0.08;
    }
    b.boltA = boltA;

    // ---- paint + place; the layer is simply absent while dormant ----
    const show = b.fade > 0.01;
    mesh.visible = show;
    const host = hostRef.current;
    if (host) host.style.visibility = show ? 'visible' : 'hidden';
    if (show) {
      paintBeacon(canvasRef.current, Math.min(window.devicePixelRatio || 1, 2), { drawP: b.drawP, boltA, boltGlow: glow, cloudPx: CLOUD_PX });
      textureRef.current.needsUpdate = true;
      const unitPerPx = H / Math.max(1, size.height);
      const w = CLOUD_PX * unitPerPx;
      mesh.scale.set(w, w * 1.3, 1);
      mesh.position.set(b.px - 0.07 * w, b.py + 0.10 * w, 0);
      mesh.material.opacity = b.fade;
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent depthTest={false} depthWrite={false} />
    </mesh>
  );
}

const FormBeacon = forwardRef(function FormBeacon({ anchorRef }, ref) {
  const hostRef = useRef(null);
  // The page writes here, the scene only reads.
  const inbox = useRef({ wakeSeq: 0, strikeSeq: 0, sleepSeq: 0, level: 0 });
  const animate = useMemo(() => !prefersReducedMotion(), []);

  useImperativeHandle(ref, () => ({
    wake() { inbox.current.wakeSeq += 1; },
    charge(level) { inbox.current.level = level; },
    strike() { inbox.current.strikeSeq += 1; },
    sleep() { inbox.current.sleepSeq += 1; },
  }), []);

  return (
    <div ref={hostRef} className="form-beacon" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        camera={CAMERA}
        style={{ pointerEvents: 'none' }}   /* R3F sets pointer-events:auto on its wrapper; this layer must be click-through */
      >
        <BeaconScene inbox={inbox} anchorRef={anchorRef} hostRef={hostRef} animate={animate} />
      </Canvas>
    </div>
  );
});

export default FormBeacon;
