import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ============================================================
   WATCH — the satellite FLYBY behind the hero photo.

   One thin hairline arc runs through the hero behind the photo.
   A small orange dot (satellite) traces the arc every ~14 s with
   a 10-point hairline tail that fades. Three ground stations sit
   at fixed t values on the arc; each pulses orange briefly as the
   sat passes overhead.

   The orange cloud-lightning beacon and its status quotes live
   in a SEPARATE layer (.hero__cloud → CloudBackground.jsx) and
   are not touched by this file. Other pages' three.js (OrbitMap,
   FlowField, FormBeacon) are not touched either.
   ============================================================ */

const COMPACT_BREAKPOINT = 900;

/* ---- FLYBY timing ---- */
const FLYBY_PERIOD_S = 14;
const FLYBY_DURATION_S = 4.8;
const FLYBY_TAIL_LEN = 12;

/* The arc. Control points in CSS px around the photo centre.
   Negative z pushes the point behind the photo plane. The curve
   dips slightly in front near the middle so the sat crosses the
   plane during each pass. */
const ARC_POINTS_CSS = [
  { x: -520, y:  180, z: -40 },
  { x: -320, y:  220, z: -15 },
  { x: -120, y:  170, z:  10 },
  { x:   60, y:   80, z:  25 },
  { x:  200, y:  -40, z:  10 },
  { x:  360, y: -160, z: -20 },
  { x:  540, y: -240, z: -50 },
];

/* Ground stations along the arc. t ∈ [0, 1] is their position on
   the curve. */
const STATIONS = [
  { t: 0.15, name: 'eu-west-1' },
  { t: 0.50, name: 'us-east-1' },
  { t: 0.82, name: 'ap-south-1' },
];
const STATION_HIT_WINDOW = 0.08;   // sat within this t-distance → ping

/* Compact (phone) config: tighter arc, slower + less frequent */
const COMPACT_ARC_SCALE = 0.55;
const COMPACT_FLYBY_PERIOD_S = 18;

const COL_ORANGE = new THREE.Color(0xF38020);
const COL_LINE = new THREE.Color(0xcfcfcf);
const COL_DIM = new THREE.Color(0xe6e6e6);

/* ============================================================
   FLYBY — the arc + satellite + tail + ground stations.
   ============================================================ */
function Flyby({ animate, compact }) {
  const { viewport, size } = useThree();

  const arcLen = 180;
  const period = compact ? COMPACT_FLYBY_PERIOD_S : FLYBY_PERIOD_S;
  const arcScale = compact ? COMPACT_ARC_SCALE : 1;

  /* Arc geometry — rebuilt each frame (so it reanchors on resize). */
  const arc = useMemo(() => {
    const pos = new Float32Array((arcLen + 1) * 3);
    const col = new Float32Array((arcLen + 1) * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    const line = new THREE.Line(geo, mat);
    return { line, pos, col, geo };
  }, [arcLen]);

  /* Satellite dot + a soft orange glow sphere behind it. */
  const sat = useMemo(() => {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 12),
      new THREE.MeshBasicMaterial({ color: COL_ORANGE, transparent: true, opacity: 0 })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshBasicMaterial({ color: COL_ORANGE, transparent: true, opacity: 0 })
    );
    core.visible = false;
    glow.visible = false;
    return { core, glow };
  }, []);

  /* Tail — hairline Line of 12 points with per-vertex alpha. */
  const tail = useMemo(() => {
    const pos = new Float32Array(FLYBY_TAIL_LEN * 3);
    const col = new Float32Array(FLYBY_TAIL_LEN * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    const history = Array.from({ length: FLYBY_TAIL_LEN }, () => new THREE.Vector3());
    return { line, pos, col, geo, history };
  }, []);

  /* Ground stations — small hexagon markers on the arc. */
  const stations = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const th = (i / 6) * Math.PI * 2 + Math.PI / 6;
      pts.push(new THREE.Vector3(Math.cos(th), Math.sin(th), 0));
    }
    const hexGeo = new THREE.BufferGeometry().setFromPoints(pts);
    return STATIONS.map((s) => {
      const mat = new THREE.LineBasicMaterial({ color: COL_LINE, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(hexGeo.clone(), mat);
      line.scale.setScalar(0.08);
      return { ...s, line, pulse: 0, pulseT: 0 };
    });
  }, []);

  const stateRef = useRef({ passT: 2.0, active: -1 });

  useEffect(() => {
    return () => {
      arc.geo.dispose(); arc.line.material.dispose();
      sat.core.geometry.dispose(); sat.core.material.dispose();
      sat.glow.geometry.dispose(); sat.glow.material.dispose();
      tail.geo.dispose(); tail.line.material.dispose();
      if (stations[0]) stations[0].line.geometry.dispose();
      for (const s of stations) s.line.material.dispose();
    };
  }, [arc, sat, tail, stations]);

  useFrame((_, rawDelta) => {
    const photoEl = document.querySelector('.hero__photo');
    if (!photoEl) return;
    const photoRect = photoEl.getBoundingClientRect();
    const canvasEl = _.gl.domElement;
    const canvasRect = canvasEl.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    const pxToWorld = viewport.width / size.width;
    const cx = ((photoRect.left + photoRect.width / 2 - canvasRect.left) / canvasRect.width - 0.5) * viewport.width;
    const cy = -((photoRect.top + photoRect.height / 2 - canvasRect.top) / canvasRect.height - 0.5) * viewport.height;

    /* Build the curve each frame (anchors to the photo centre). */
    const pts = ARC_POINTS_CSS.map((p) =>
      new THREE.Vector3(cx + p.x * pxToWorld * arcScale, cy + p.y * pxToWorld * arcScale, p.z * pxToWorld * arcScale)
    );
    const curve = new THREE.CatmullRomCurve3(pts);
    const sampled = curve.getPoints(arcLen);
    const st = stateRef.current;
    const satT = st.active >= 0 ? st.active : -1;

    for (let i = 0; i <= arcLen; i++) {
      const p = sampled[i];
      arc.pos[i * 3]     = p.x;
      arc.pos[i * 3 + 1] = p.y;
      arc.pos[i * 3 + 2] = p.z;
      // Base soft hairline grey; subtle brightening near the current sat position
      const tHere = i / arcLen;
      let a = 0.28;
      if (satT >= 0) {
        const d = Math.abs(tHere - satT);
        if (d < 0.08) a = 0.28 + (1 - d / 0.08) * 0.4;
      }
      arc.col[i * 4]     = 0.812;
      arc.col[i * 4 + 1] = 0.812;
      arc.col[i * 4 + 2] = 0.812;
      arc.col[i * 4 + 3] = a;
    }
    arc.geo.attributes.position.needsUpdate = true;
    arc.geo.attributes.color.needsUpdate = true;

    /* Stations — follow their t position on the curve */
    for (const s of stations) {
      const p = curve.getPoint(s.t);
      s.line.position.copy(p);
      if (s.pulse > 0) {
        s.pulseT += Math.min(rawDelta, 0.1);
        const k = Math.min(1, s.pulseT / 1.1);
        s.line.material.color.copy(COL_ORANGE).lerp(COL_LINE, k);
        s.line.scale.setScalar(0.08 * (1 + 0.6 * (1 - k)));
        if (k >= 1) {
          s.pulse = 0;
          s.line.material.color.copy(COL_LINE);
          s.line.scale.setScalar(0.08);
        }
      }
    }

    if (!animate) return;
    const delta = Math.min(rawDelta, 0.1);

    if (st.active >= 0) {
      st.active += delta / FLYBY_DURATION_S;
      if (st.active >= 1) {
        st.active = -1;
        sat.core.visible = false; sat.glow.visible = false; tail.line.visible = false;
      } else {
        const p = curve.getPoint(st.active);
        sat.core.position.copy(p);
        sat.glow.position.copy(p);
        sat.core.visible = true;
        sat.glow.visible = true;
        sat.core.material.opacity = 1;
        sat.glow.material.opacity = 0.3;

        // Tail: shift history, write to buffer with fade
        for (let i = FLYBY_TAIL_LEN - 1; i > 0; i--) tail.history[i].copy(tail.history[i - 1]);
        tail.history[0].copy(p);
        for (let i = 0; i < FLYBY_TAIL_LEN; i++) {
          const h = tail.history[i];
          tail.pos[i * 3]     = h.x;
          tail.pos[i * 3 + 1] = h.y;
          tail.pos[i * 3 + 2] = h.z;
          const a = Math.max(0, (1 - i / FLYBY_TAIL_LEN)) * 0.85;
          tail.col[i * 4]     = 0.953;
          tail.col[i * 4 + 1] = 0.502;
          tail.col[i * 4 + 2] = 0.125;
          tail.col[i * 4 + 3] = a;
        }
        tail.geo.attributes.position.needsUpdate = true;
        tail.geo.attributes.color.needsUpdate = true;
        tail.line.visible = true;

        // Fire station pulses when the sat passes close
        for (const s of stations) {
          if (s.pulse === 0 && Math.abs(st.active - s.t) < STATION_HIT_WINDOW * 0.5) {
            s.pulse = 1; s.pulseT = 0;
          }
        }
      }
    } else {
      st.passT -= delta;
      if (st.passT <= 0) {
        st.passT = period + (Math.random() - 0.5) * 4;
        st.active = 0;
        const start = curve.getPoint(0);
        for (let i = 0; i < FLYBY_TAIL_LEN; i++) tail.history[i].copy(start);
      }
    }
  });

  return (
    <>
      <primitive object={arc.line} />
      <primitive object={tail.line} />
      <primitive object={sat.core} />
      <primitive object={sat.glow} />
      {stations.map((s, i) => (<primitive key={i} object={s.line} />))}
    </>
  );
}

/* ============================================================
   TOP-LEVEL — Flyby (three.js Canvas)
   ============================================================ */
export default function Watch() {
  const animate = useMemo(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

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
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      dpr={[1, 2]}
      frameloop="always"
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 5], fov: 50 }}
      key={compact ? 'compact' : 'wide'}
    >
      <Flyby animate={animate} compact={compact} />
    </Canvas>
  );
}
