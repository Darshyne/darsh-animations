/**
 * La géométrie d'un mur posé par le moteur de combat, d'après les formes de sa région : des segments (formes « line » : origine, angle,
 * longueur), ou un anneau (forme « ring » du cœur V14 ; cercle, ou ellipse ronde). Fonctions pures.
 */

/** Les deux extrémités d'une forme « line ». */
export function lineEnds({ x, y, rotation, length }) {
  const r = (rotation * Math.PI) / 180;
  return [{ x, y }, { x: x + (Math.cos(r) * length), y: y + (Math.sin(r) * length) }];
}

/**
 * @param {object[]} shapes
 * @returns {{segments: Array<[{x: number, y: number}, {x: number, y: number}]>}|{ring: {x: number, y: number, radius: number}}|null}
 */
export function wallShape(shapes) {
  const list = shapes ?? [];
  const lines = list.filter(s => s.type === "line");
  if ( lines.length ) return { segments: lines.map(lineEnds) };
  // La forme « ring » du cœur V14 : le milieu de la bande, de `radius - innerWidth` à `radius + outerWidth`.
  const ring = list.find(s => (s.type === "ring") && Number.isFinite(s.radius));
  if ( ring ) return { ring: { x: ring.x, y: ring.y, radius: ring.radius + (((ring.outerWidth ?? 0) - (ring.innerWidth ?? 0)) / 2) } };
  const disc = list.map(s => ((s.type === "ellipse") && (s.radiusX === s.radiusY)) ? { ...s, type: "circle", radius: s.radiusX } : s)
    .find(s => (s.type === "circle") && Number.isFinite(s.radius) && !s.hole);
  return disc ? { ring: { x: disc.x, y: disc.y, radius: disc.radius } } : null;
}

/** Un anneau en `n` cordes. */
export function ringSegments({ x, y, radius }, n=12) {
  const at = i => ({ x: x + (radius * Math.cos((2 * Math.PI * i) / n)), y: y + (radius * Math.sin((2 * Math.PI * i) / n)) });
  return Array.from({ length: n }, (_, i) => [at(i), at(i + 1)]);
}

/** L'animation dont la longueur (en pieds) est la plus proche de celle du segment. */
export function animationFor(animations, feet) {
  const lengths = Object.keys(animations ?? {}).map(Number).sort((a, b) => a - b);
  if ( !lengths.length ) return null;
  const best = lengths.reduce((a, b) => (Math.abs(b - feet) < Math.abs(a - feet) ? b : a));
  return animations[best];
}

/**
 * Où poser les sons d'un mur : au milieu de chaque segment, de quoi l'entendre jusqu'à `reach` pixels au-delà de ses bouts ; un anneau,
 * en son centre, `reach` au-delà du cercle.
 * @returns {Array<{x: number, y: number, radius: number}>}  En pixels.
 */
export function soundSpots(shape, reach) {
  if ( shape?.ring ) return [{ x: shape.ring.x, y: shape.ring.y, radius: shape.ring.radius + reach }];
  return (shape?.segments ?? []).map(([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: (Math.hypot(b.x - a.x, b.y - a.y) / 2) + reach }));
}
