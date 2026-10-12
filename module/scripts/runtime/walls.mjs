/**
 * Les murs de sort posés par points (data/walls.mjs) : une animation en boucle le long de chaque segment, ou en anneau, tant que la
 * région du mur est là. Deuxième exception à « BLFX déclenche, pas nous » (SPEC §7, après les pièges) : le moteur de combat pose ces
 * murs en régions, sans gabarit, et BLFX ne les voit pas. Le MJ actif joue (les effets persistants de Sequencer sont gardés par la
 * scène et vus de tous) ; la région redessinée (anneau, mur déplacé), on rejoue ; la région partie, on arrête.
 * On ne lit que les régions : leurs formes et l'item qui les a posées (`flags.dnd5e.item`) — aucun lien avec le moteur.
 */

import { MODULE_ID } from "./shared.mjs";
import { wallShape, ringSegments, animationFor } from "../core/walls.mjs";
import { WALLS } from "../data/walls.mjs";

const nameOf = region => `${MODULE_ID}.wall.${region.id}`;
const isExecutor = () => game.users.activeGM?.isSelf === true;

/** L'entrée de la table pour le sort qui a posé cette région, ou null. */
function entryOf(region) {
  const uuid = region?.flags?.dnd5e?.item;
  if ( !uuid ) return null;
  const item = fromUuidSync(uuid, { strict: false });
  return WALLS[item?.system?.identifier] ?? null;
}

/** L'animation d'anneau toute faite, si son module est actif et que Sequencer la connaît. */
function readyRing(entry) {
  const ring = entry.ring;
  if ( !ring || !game.modules.get(ring.module)?.active ) return null;
  return globalThis.Sequencer?.Database?.entryExists?.(ring.animation) ? ring : null;
}

/** Arrête l'animation d'un mur. */
export async function stopWall(region) {
  if ( !globalThis.Sequencer?.EffectManager ) return;
  await Sequencer.EffectManager.endEffects({ name: nameOf(region) }).catch(() => null);
}

/** Joue l'animation d'un mur (après avoir arrêté la précédente). Rend ce qui a été lancé, ou la raison de ne rien jouer. */
export async function drawWall(region) {
  const entry = entryOf(region);
  if ( !entry ) return { skipped: "not a wall of the table" };
  if ( !globalThis.Sequence ) return { skipped: "Sequencer missing" };
  const shape = wallShape(region.shapes.map(s => s.toObject?.() ?? s));
  if ( !shape ) return { skipped: "no line nor ring" };
  await stopWall(region);
  const scene = region.parent;
  const cell = scene.grid.size;
  const perFoot = scene.grid.size / scene.grid.distance;
  const name = nameOf(region);
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const played = [];
  const ring = shape.ring ? readyRing(entry) : null;
  if ( ring ) {
    const size = (2 * shape.ring.radius) + (cell * entry.thickness);
    sequence.effect().file(ring.animation).atLocation({ x: shape.ring.x, y: shape.ring.y }).size({ width: size, height: size })
      .persist().name(name).fadeIn(500);
    played.push(ring.animation);
  }
  else {
    for ( const [a, b] of (shape.segments ?? ringSegments(shape.ring, 12)) ) {
      const file = animationFor(entry.animations, Math.hypot(b.x - a.x, b.y - a.y) / perFoot);
      // Étirée en longueur seulement : l'épaisseur reste celle qu'on donne (une case par défaut).
      sequence.effect().file(file).atLocation(a).stretchTo(b, { onlyX: true }).scale((cell * entry.thickness) / entry.native)
        .persist().name(name).fadeIn(500);
      played.push(file);
    }
  }
  await sequence.play();
  return { played };
}

/** Les tracés d'un même mur, l'un après l'autre : la région créée puis aussitôt redessinée (anneau) ne laisse pas deux feux. */
const queues = new Map();
function queued(region, task) {
  const next = (queues.get(region.id) ?? Promise.resolve()).then(task).catch(err => console.error(`${MODULE_ID} | wall animation`, err));
  queues.set(region.id, next);
  next.finally(() => { if ( queues.get(region.id) === next ) queues.delete(region.id); });
  return next;
}

export function registerWalls() {
  Hooks.on("createRegion", region => { if ( isExecutor() && entryOf(region) ) queued(region, () => drawWall(region)); });
  Hooks.on("updateRegion", (region, changes) => {
    if ( isExecutor() && ("shapes" in changes) && entryOf(region) ) queued(region, () => drawWall(region));
  });
  Hooks.on("deleteRegion", region => { if ( isExecutor() ) queued(region, () => stopWall(region)); });
}
