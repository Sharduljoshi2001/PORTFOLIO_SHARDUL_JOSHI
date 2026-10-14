import './FlowField.css';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA, planeSize, elementToWorld, cssColor, prefersReducedMotion } from './stageMath';

/* ============================================================
   FLOW FIELD — the wind map behind the Contact page.

   A few hundred hairline comet trails ride a slowly turning flow field
   across the whole stage (fewer on phones). The cursor is a small vortex
   they swirl around. The page can tell the field things through a ref:
     setFocus(el)        trails gather in a slow vortex under `el`
     ripple(el)          a ring pushes out from `el` (each keystroke)
     send(el, onArrive)  everything pours into `el`; onArrive when done

   Same working rules as the beacon: everything three.js is created
   inside useFrame, refs are only read there, and the loop pauses when
   the stage scrolls out of view. The page's requests arrive as a small
   read-only "inbox" (queues and counters); the scene keeps its own state.
   Colours come from the tokens in global.css.
   ============================================================ */

/* ---------------------- TUNING KNOBS ---------------------- */
const TRAIL = 18;          // points per trail
const SEG = TRAIL - 1;
const COUNT_DESKTOP = 280;
const COUNT_PHONE = 110;
const CURSOR_R = 1.6;      // cursor vortex radius (world units)
const FOCUS_R = 2.2;       // focused-field vortex radius
const BURST_S = 1.5;       // how long Send pours the field into the card
/* ---------------------------------------------------------- */

function spawn(p, anywhere, W, H) {
  p.x = anywhere ? (Math.random() - 0.5) * W * 1.2 : -W * 0.62 - Math.random() * 0.6;
  p.y = (Math.random() - 0.5) * H * 1.25;
  p.z = (Math.random() - 0.5) * 1.6;
  p.hist = Array.from({ length: TRAIL }, () => [p.x, p.y]);
  p.speed = 0.7 + Math.random() * 0.7;
}

function FlowScene({ inbox, animate, count }) {
  const { gl, size } = useThree();
  const groupRef = useRef();
  const world = useRef(null);   // everything three.js lives here (touched only inside useFrame)

  useEffect(() => {
    return () => {
      const w = world.current;
      if (!w) return;
      w.geo.dispose();
      w.mat.dispose();
      w.group.clear();
      world.current = null;
    };
  }, []);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    const { W, H } = planeSize(size);

    // ---- first frame: one LineSegments buffer holds every trail ----
    if (!world.current) {
      const pos = new Float32Array(count * SEG * 2 * 3);
      const col = new Float32Array(count * SEG * 2 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
      group.add(new THREE.LineSegments(geo, mat));
      const parts = [];
      for (let i = 0; i < count; i++) {
        const p = { x: 0, y: 0, z: 0, hist: [], speed: 1 };
        spawn(p, true, W, H);
        parts.push(p);
      }
      world.current = {
        group, geo, mat, pos, col, parts,
        head: cssColor('--color-text-secondary', '#555555'),
        tail: cssColor('--color-bg-primary', '#fafafa'),
        t: 0, wx: 0, wy: 0, cx: 0, cy: 0,
        ripples: [], burst: 0, burstSeen: 0, sinkEl: null, onArrive: null,
      };
    }

    const w = world.current;
    const a = inbox.current;
    const delta = Math.min(rawDelta, 0.1);
    if (animate) w.t += delta;

    // ---- "camera": the whole field drifts the opposite way (slow dolly + parallax) ----
    const m = a.mouse;
    w.cx += ((m.inside ? m.x * 0.18 : 0) - w.cx) * 0.04;
    w.cy += ((m.inside ? m.y * 0.1 : 0) - w.cy) * 0.04;
    group.position.set(-w.cx, -w.cy, -Math.sin(w.t * 0.1) * 0.18);
    w.wx += ((m.x * W) / 2 - w.wx) * 0.12;
    w.wy += ((m.y * H) / 2 - w.wy) * 0.12;
    // a DOM element → a point in the field's own space
    const local = (el) => { const [x, y] = elementToWorld(el, gl.domElement, W, H); return [x + w.cx, y + w.cy]; };

    // ---- read the page's requests ----
    const focus = a.focusEl && animate ? local(a.focusEl) : null;
    if (a.rippleQueue.length) {
      a.rippleQueue.splice(0, a.rippleQueue.length).forEach((el) => w.ripples.push({ at: local(el), age: 0 }));
      if (w.ripples.length > 8) w.ripples.splice(0, w.ripples.length - 8);
    }
    for (let r = w.ripples.length - 1; r >= 0; r--) {
      w.ripples[r].age += delta;
      if (w.ripples[r].age > 0.9) w.ripples.splice(r, 1);
    }
    if (a.burstSeq !== w.burstSeen) {
      w.burstSeen = a.burstSeq; w.burst = BURST_S; w.sinkEl = a.sinkEl; w.onArrive = a.onArrive;
    }
    let sink = null;
    if (w.burst > 0) {
      w.burst -= delta;
      sink = w.sinkEl ? local(w.sinkEl) : null;
      if (w.burst <= 0 && w.onArrive) { const cb = w.onArrive; w.onArrive = null; w.sinkEl = null; cb(); }
    }

    // ---- move every particle, then write its trail ----
    w.parts.forEach((p, i) => {
      if (animate) {
        // the field: a slow, turning wind heading right
        let vx = 0.55 + 0.35 * Math.sin(p.y * 0.9 + w.t * 0.25) + 0.25 * Math.cos((p.x * 0.5 + p.y) * 0.8 - w.t * 0.2);
        let vy = 0.35 * Math.sin(p.x * 0.8 - w.t * 0.2) + 0.25 * Math.cos(p.y * 1.3 + w.t * 0.3);
        if (m.inside) {                                         // cursor vortex
          const dx = p.x - (w.wx + w.cx), dy = p.y - (w.wy + w.cy), r = Math.hypot(dx, dy);
          if (r < CURSOR_R && r > 0.01) { const f = 1 - r / CURSOR_R; vx += (-dy / r) * f * 1.8 + (dx / r) * f * 0.5; vy += (dx / r) * f * 1.8 + (dy / r) * f * 0.5; }
        }
        if (focus) {                                            // gathering vortex under the focused field
          const dx = p.x - focus[0], dy = p.y - focus[1], r = Math.hypot(dx, dy);
          if (r < FOCUS_R && r > 0.01) { const f = 1 - r / FOCUS_R; vx += (-dy / r) * f * 1.4 - (dx / r) * f * 0.9; vy += (dx / r) * f * 1.4 - (dy / r) * f * 0.9; }
        }
        for (const rp of w.ripples) {                           // typing ripples
          const dx = p.x - rp.at[0], dy = p.y - rp.at[1], r = Math.hypot(dx, dy), ring = rp.age * 2.6;
          if (r > 0.02 && Math.abs(r - ring) < 0.35) { const f = (1 - rp.age / 0.9) * (1 - Math.abs(r - ring) / 0.35); vx += (dx / r) * f * 2.4; vy += (dy / r) * f * 2.4; }
        }
        if (sink) {                                             // Send: everything pours into the card
          const dx = sink[0] - p.x, dy = sink[1] - p.y, r = Math.hypot(dx, dy) + 0.001;
          vx = vx * 0.15 + (dx / r) * 3.4; vy = vy * 0.15 + (dy / r) * 3.4;
          if (r < 0.3) spawn(p, false, W, H);
        }
        p.x += vx * p.speed * delta;
        p.y += vy * p.speed * delta;
        if (p.x > W * 0.64 || Math.abs(p.y) > H * 0.68) spawn(p, false, W, H);
        p.hist.pop();
        p.hist.unshift([p.x, p.y]);
      }
      const base = i * SEG * 2 * 3, depth = (p.z + 0.8) / 1.6;
      for (let s = 0; s < SEG; s++) {
        const pa = p.hist[s], pb = p.hist[s + 1], o = base + s * 6;
        w.pos[o] = pa[0]; w.pos[o + 1] = pa[1]; w.pos[o + 2] = p.z;
        w.pos[o + 3] = pb[0]; w.pos[o + 4] = pb[1]; w.pos[o + 5] = p.z;
        const k1 = (1 - s / SEG) * (0.45 + depth * 0.55), k2 = (1 - (s + 1) / SEG) * (0.45 + depth * 0.55);
        w.col[o] = w.tail.r + (w.head.r - w.tail.r) * k1; w.col[o + 1] = w.tail.g + (w.head.g - w.tail.g) * k1; w.col[o + 2] = w.tail.b + (w.head.b - w.tail.b) * k1;
        w.col[o + 3] = w.tail.r + (w.head.r - w.tail.r) * k2; w.col[o + 4] = w.tail.g + (w.head.g - w.tail.g) * k2; w.col[o + 5] = w.tail.b + (w.head.b - w.tail.b) * k2;
      }
    });
    w.geo.attributes.position.needsUpdate = true;
    w.geo.attributes.color.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}

const FlowField = forwardRef(function FlowField(_props, ref) {
  const hostRef = useRef(null);
  // The page writes here, the scene only reads (queues are drained with splice).
  const inbox = useRef({ mouse: { x: 0, y: 0, inside: false }, focusEl: null, rippleQueue: [], burstSeq: 0, sinkEl: null, onArrive: null });
  const [visible, setVisible] = useState(true);
  const animate = useMemo(() => !prefersReducedMotion(), []);
  const count = useMemo(() => (window.innerWidth < 760 ? COUNT_PHONE : COUNT_DESKTOP), []);

  useImperativeHandle(ref, () => ({
    setFocus(el) { inbox.current.focusEl = el; },
    ripple(el) { inbox.current.rippleQueue.push(el); },
    send(el, onArrive) { const a = inbox.current; a.sinkEl = el; a.onArrive = onArrive; a.burstSeq += 1; },
  }), []);

  // The cursor is read on the whole stage (the content sits above this layer).
  useEffect(() => {
    const host = hostRef.current;
    const stage = host && host.parentElement;
    if (!stage) return undefined;
    const onMove = (e) => {
      const b = host.getBoundingClientRect();
      const m = inbox.current.mouse;
      m.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
      m.y = -((e.clientY - b.top) / b.height - 0.5) * 2;
      m.inside = true;
    };
    const onLeave = () => { inbox.current.mouse.inside = false; };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => { stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave); };
  }, []);

  // Pause the frame loop while the stage is scrolled out of view.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="flow" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        camera={CAMERA}
      >
        <FlowScene inbox={inbox} animate={animate} count={count} />
      </Canvas>
    </div>
  );
});

export default FlowField;
