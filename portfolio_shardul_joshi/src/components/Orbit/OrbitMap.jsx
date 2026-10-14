import './OrbitMap.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { paintBeacon, boltAlpha, easeOut, easeInOut, makeDeck } from '../Cloud/beacon';

/* ============================================================
   ORBIT MAP — the repository list drawn as a diagram, orbiting the cloud.

   At the centre: the orange cloud-lightning beacon (the same mark as
   the hero and the nav). It draws itself in first, then the rings
   follow, then the bolt zaps and settles. Every few seconds it strikes
   again, and each strike reveals one real fact about this page in the
   map's corner (`repos · 37 synced`), in the beacon's own voice.
   Hovering a repo dot makes the bolt flick once — an acknowledgement.

   Around it: one hairline ring per language (the language with the
   most repos gets the biggest orbit), one dot per repository.
     · dots drift slowly along their ring; the whole map turns very
       slowly and tilts a little toward the cursor
     · dots on the far side are slightly smaller and lighter (depth)
     · hover a dot → it darkens, grows a little, gets a thin halo and
       a small tag with its name; click → opens the repo
   The page can light one whole ring (highlightLang) or one dot
   (highlightRepo), and hears back which dot is hovered (onHoverRepo).

   Same working rules as the hero beacon: everything three.js is created
   inside useFrame (never during render), refs are only read there, and
   the map pauses when it scrolls out of view. Gray colours come from
   the CSS tokens in global.css; the orange comes from beacon.js.
   ============================================================ */

/* ---------------------- TUNING KNOBS ---------------------- */
const RING_R0 = 0.62;     // radius of the innermost ring (leaves room for the cloud)
const RING_STEP = 0.38;   // distance between rings
const RING_SEGS = 180;    // smoothness of each ring
const RINGS_AFTER = 0.7;  // rings start drawing this long after the cloud (s)
const DOT_R = 0.026;      // dot radius
const HALO_R = 0.075;     // halo radius around a lit dot
const DRIFT = 0.05;       // base dot drift (rad/s); outer rings move slower
const TURN = 0.012;       // whole-map turn (rad/s)
const TILT = 0.09;        // parallax tilt toward the cursor (rad)
const HIT_PX = 16;        // hover radius around a dot (px)
const DRAW_IN = 1.1;      // seconds for a ring to draw itself in
const CLOUD_PX = 60;      // beacon width at the centre (screen px)
const CLOUD_TIMES = { draw: 1.1, zap: 0.9, holdMin: 5, holdMax: 9 };  // seconds
const FLICK = 0.1;        // bolt flick when a dot is hovered (s)
const CAMERA = { position: [0, 4.2, 5.6], fov: 30 };
/* ---------------------------------------------------------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const formatMonth = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

// Read a colour token from global.css so the map follows the gray ramp.
function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

function circleGeometry(r, segs) {
  const pts = [];
  for (let k = 0; k <= segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/* ---------- the scene: built on the first frame, driven every frame ---------- */
function OrbitScene({
  repos, langs, facts, animate,
  mouseRef, tipRef, statusRef, hostRef, hoveredRef, highlightRef, onHoverRepo,
}) {
  const { camera, scene, size } = useThree();
  const groupRef = useRef();
  const world = useRef(null);      // all three.js objects live here (touched only inside useFrame)
  const lastHover = useRef(null);

  // Free GPU memory on unmount (StrictMode's dev re-mount simply rebuilds on the next frame).
  useEffect(() => {
    return () => {
      const w = world.current;
      if (!w) return;
      w.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      w.group.clear();
      scene.remove(w.cloud.mesh);
      w.cloud.texture.dispose();
      w.cloud.mesh.geometry.dispose();
      w.cloud.mesh.material.dispose();
      world.current = null;
    };
  }, [scene]);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;

    // ---- first frame: build the cloud, the rings, the dots, the halos ----
    if (!world.current) {
      const colors = {
        line: cssColor('--color-border-secondary', '#cfcfcf'),
        lineOn: cssColor('--color-text-primary', '#1a1a1a'),
        dot: cssColor('--color-text-muted', '#8a8a8a'),
        dotOn: cssColor('--color-text-primary', '#1a1a1a'),
      };
      const haloGeo = circleGeometry(HALO_R, 40);
      const dotGeo = new THREE.SphereGeometry(DOT_R, 10, 10);

      const rings = langs.map((lang, idx) => {
        const i = langs.length - 1 - idx;          // langs is biggest-first → biggest gets the outer ring
        const r = RING_R0 + i * RING_STEP;
        const geo = circleGeometry(r, RING_SEGS);
        geo.setDrawRange(0, animate ? 0 : RING_SEGS + 1);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colors.line, transparent: true }));
        group.add(line);

        const items = repos.filter((x) => x.language === lang);
        const dots = items.map((repo, j) => {
          const mesh = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: colors.dot, transparent: true }));
          const halo = new THREE.LineLoop(haloGeo, new THREE.LineBasicMaterial({ color: colors.dotOn, transparent: true, opacity: 0 }));
          halo.visible = false;
          mesh.scale.setScalar(animate ? 0.001 : 1);
          group.add(mesh, halo);
          return {
            repo, mesh, halo, r,
            a0: (j / items.length) * Math.PI * 2 + i * 0.9,
            speed: (DRIFT / (1 + i * 0.35)) * (i % 2 ? -1 : 1),
            sx: 0, sy: 0, depth: 1,
          };
        });
        return { lang, line, geo, dots, born: RINGS_AFTER + i * 0.2 };
      });

      // The beacon: a flat rectangle at the origin that always faces the camera,
      // showing a 2D canvas painted with the shared beacon code.
      const canvas = document.createElement('canvas');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      const cloudMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
      );
      cloudMesh.renderOrder = 10;
      scene.add(cloudMesh);

      world.current = {
        group, rings, colors,
        dots: rings.flatMap((rg) => rg.dots),
        t: 0,
        v: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        cloud: {
          mesh: cloudMesh, canvas, texture,
          phase: animate ? 'draw' : 'hold', t: 0, hold: Infinity, flicker: 0,
          nextFact: makeDeck(facts && facts.length ? facts : [['orbit · ', 'online']]),
          shownFirst: false,
        },
      };
    }

    const w = world.current;
    const delta = Math.min(rawDelta, 0.1);      // cap so a background tab doesn't jump
    if (animate) w.t += delta;
    const hl = highlightRef.current;
    const mouse = mouseRef.current;

    // Reveal the next fact in the corner: fade out, swap the words, fade in.
    const showFact = () => {
      const el = statusRef.current;
      if (!el) return;
      const [key, val] = w.cloud.nextFact();
      el.classList.remove('orbit__status--on');
      setTimeout(() => {
        if (!statusRef.current) return;
        const k = document.createElement('span');
        k.textContent = key;
        const v = document.createElement('em');
        v.textContent = val;
        el.replaceChildren(k, v);
        el.classList.add('orbit__status--on');
      }, 240);
    };

    // ---- tilt toward the cursor + a very slow turn ----
    const tx = mouse.inside ? mouse.y * TILT : 0;
    const tz = mouse.inside ? -mouse.x * TILT : 0;
    group.rotation.x += (tx - group.rotation.x) * 0.06;
    group.rotation.z += (tz - group.rotation.z) * 0.06;
    if (animate) group.rotation.y += delta * TURN;
    group.updateMatrixWorld();

    // ---- place the dots, project them to the screen, find the one under the cursor ----
    let best = null;
    let bestD = HIT_PX;
    w.rings.forEach((rg) => {
      if (animate) rg.geo.setDrawRange(0, Math.floor((RING_SEGS + 1) * easeOut((w.t - rg.born) / DRAW_IN)));
      rg.dots.forEach((d) => {
        const a = d.a0 + w.t * d.speed;
        d.mesh.position.set(Math.cos(a) * d.r, 0, Math.sin(a) * d.r);
        d.halo.position.copy(d.mesh.position);
        d.mesh.getWorldPosition(w.v);
        d.depth = clamp01((w.v.z / d.r + 1) / 2);     // 1 = nearest the viewer, 0 = far side
        w.v.project(camera);
        d.sx = (w.v.x * 0.5 + 0.5) * size.width;
        d.sy = (-w.v.y * 0.5 + 0.5) * size.height;
        if (mouse.inside && d.mesh.scale.x > 0.5) {
          const dist = Math.hypot(d.sx - mouse.px, d.sy - mouse.py);
          if (dist < bestD) { bestD = dist; best = d; }
        }
      });
    });

    // ---- colour, size, halo ----
    const hoverLang = best ? best.repo.language : null;
    w.rings.forEach((rg) => {
      const on = hl.lang === rg.lang;
      const dim = !!hl.lang && !on;
      const soft = !hl.lang && hoverLang === rg.lang;   // hovering a dot quietly names its ring
      rg.line.material.color.copy(on || soft ? w.colors.lineOn : w.colors.line);
      rg.line.material.opacity = dim ? 0.4 : 1;
      rg.dots.forEach((d) => {
        const alive = animate ? easeOut((w.t - rg.born - 1.0) / 0.5) : 1;
        const lit = d === best || hl.repo === d.repo.name;
        d.mesh.material.color.copy(lit || on ? w.colors.dotOn : w.colors.dot);
        d.mesh.material.opacity = (dim ? 0.3 : 1) * (0.55 + 0.45 * d.depth);
        const target = alive * (lit ? 1.6 : 0.85 + 0.15 * d.depth);
        d.mesh.scale.setScalar(d.mesh.scale.x + (target - d.mesh.scale.x) * 0.2);
        d.halo.material.opacity += ((lit ? 0.9 : 0) - d.halo.material.opacity) * 0.2;
        d.halo.visible = d.halo.material.opacity > 0.02;
      });
    });

    // ---- the beacon at the centre: draw → zap → hold → zap … ----
    const c = w.cloud;
    let drawP = 1, boltA = 1, boltGlow = 0.35;
    if (animate) {
      c.t += delta;
      if (c.phase === 'draw') {
        drawP = easeInOut(c.t / CLOUD_TIMES.draw); boltA = 0; boltGlow = 0;
        if (c.t >= CLOUD_TIMES.draw) { c.phase = 'zap'; c.t = 0; }
      } else if (c.phase === 'zap') {
        boltA = boltAlpha(c.t); boltGlow = c.t < 0.4 ? 1 : 0.35;
        if (c.t >= CLOUD_TIMES.zap) {
          c.phase = 'hold'; c.t = 0;
          c.hold = CLOUD_TIMES.holdMin + Math.random() * (CLOUD_TIMES.holdMax - CLOUD_TIMES.holdMin);
          showFact();                                 // every strike reveals a fact
        }
      } else if (c.t >= c.hold) {
        c.phase = 'zap'; c.t = 0;
      }
      if (c.flicker > 0) {                            // a hovered dot makes the bolt flick
        c.flicker -= delta;
        boltA = Math.min(boltA, 0.15); boltGlow = 1;
      }
    } else if (!c.shownFirst) {
      c.shownFirst = true;                            // reduced motion: still beacon, one fact
      showFact();
    }
    paintBeacon(c.canvas, w.dpr, { drawP, boltA, boltGlow, cloudPx: CLOUD_PX });
    c.texture.needsUpdate = true;

    // Size it in screen pixels and keep it facing the camera at the centre.
    // (the painted canvas is cloudPx wide × 1.3 tall; the mark sits slightly
    //  right of and above the rectangle's centre, so nudge it back to the origin)
    const dist = camera.position.length();
    const unitPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.height;
    const cw = CLOUD_PX * unitPerPx;
    c.mesh.scale.set(cw, cw * 1.3, 1);
    c.mesh.quaternion.copy(camera.quaternion);
    w.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    w.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    c.mesh.position.set(0, 0, 0).addScaledVector(w.right, -0.07 * cw).addScaledVector(w.up, 0.10 * cw);

    // ---- the name tag (hovered dot, or the dot of the card under the cursor) ----
    const show = best || (hl.repo ? w.dots.find((d) => d.repo.name === hl.repo) : null);
    const tip = tipRef.current;
    if (tip) {
      if (show) {
        if (tip.dataset.repo !== show.repo.name) {
          tip.dataset.repo = show.repo.name;
          const name = document.createElement('span');
          name.textContent = show.repo.name;
          const meta = document.createElement('small');
          meta.textContent = `${(show.repo.language || '').toLowerCase()} · ${formatMonth(show.repo.pushed_at)}`;
          tip.replaceChildren(name, meta);
        }
        tip.style.left = `${show.sx}px`;
        tip.style.top = `${show.sy}px`;
        tip.classList.add('orbit__tip--on');
      } else {
        tip.classList.remove('orbit__tip--on');
        tip.dataset.repo = '';
      }
    }
    if (hostRef.current) hostRef.current.style.cursor = best ? 'pointer' : '';

    // ---- report the hovered repo to the page (only when it changes) ----
    hoveredRef.current = best ? best.repo : null;
    const name = best ? best.repo.name : null;
    if (name !== lastHover.current) {
      if (name && animate) c.flicker = FLICK;
      lastHover.current = name;
      if (onHoverRepo) onHoverRepo(name);
    }
  });

  return <group ref={groupRef} />;
}

/* ---------- the component the page uses ---------- */
export default function OrbitMap({
  repos, langs, facts = [], highlightLang = null, highlightRepo = null, onHoverRepo,
}) {
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const statusRef = useRef(null);
  const mouseRef = useRef({ px: 0, py: 0, x: 0, y: 0, inside: false });
  const hoveredRef = useRef(null);
  const highlightRef = useRef({ lang: null, repo: null });
  const [visible, setVisible] = useState(true);

  // Only one reason to stay still: the viewer prefers reduced motion.
  const animate = useMemo(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Latest highlight for the frame loop to read.
  useEffect(() => {
    highlightRef.current = { lang: highlightLang, repo: highlightRepo };
  }, [highlightLang, highlightRepo]);

  // Pause the frame loop while the map is scrolled out of view.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onPointerMove = (e) => {
    const b = hostRef.current.getBoundingClientRect();
    const m = mouseRef.current;
    m.px = e.clientX - b.left;
    m.py = e.clientY - b.top;
    m.x = (m.px / b.width - 0.5) * 2;
    m.y = (m.py / b.height - 0.5) * 2;
    m.inside = true;
  };
  const onPointerLeave = () => { mouseRef.current.inside = false; };
  const onClick = () => {
    const repo = hoveredRef.current;
    if (repo) window.open(repo.html_url, '_blank', 'noopener');
  };

  return (
    <div
      ref={hostRef}
      className="orbit"
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        camera={CAMERA}
      >
        <OrbitScene
          repos={repos}
          langs={langs}
          facts={facts}
          animate={animate}
          mouseRef={mouseRef}
          tipRef={tipRef}
          statusRef={statusRef}
          hostRef={hostRef}
          hoveredRef={hoveredRef}
          highlightRef={highlightRef}
          onHoverRepo={onHoverRepo}
        />
      </Canvas>
      <div ref={tipRef} className="orbit__tip" />
      <span className="orbit__caption">one ring per language · one dot per repo</span>
      <span ref={statusRef} className="orbit__status" />
    </div>
  );
}
