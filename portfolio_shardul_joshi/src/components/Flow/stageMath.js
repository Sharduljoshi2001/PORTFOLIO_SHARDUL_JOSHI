import * as THREE from 'three';

/* Shared by the flow field and the form beacon: both draw on a full-stage
   canvas with the same camera, so a DOM element can be mapped to a point
   on the z = 0 plane and the two layers line up. */

export const CAMERA = { position: [0, 0, 7.5], fov: 34 };
const CAM_Z = CAMERA.position[2];

// Size of the visible z = 0 plane, in world units.
export function planeSize(size) {
  const H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2));
  const W = H * (size.width / Math.max(1, size.height));
  return { W, H };
}

// Centre of a DOM element → world point on the z = 0 plane.
export function elementToWorld(el, canvasEl, W, H) {
  const r = canvasEl.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const nx = ((b.left + b.width / 2 - r.left) / Math.max(1, r.width) - 0.5) * 2;
  const ny = -((b.top + b.height / 2 - r.top) / Math.max(1, r.height) - 0.5) * 2;
  return [(nx * W) / 2, (ny * H) / 2];
}

// Read a colour token from global.css.
export function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
