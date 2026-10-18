/**
 * Les murs de sort posés par points (data/walls.mjs) : une animation en boucle le long de chaque segment, ou en anneau, tant que la
 * région du mur est là. Deuxième exception à « BLFX déclenche, pas nous » (SPEC §7, après les pièges) : le moteur de combat pose ces
 * murs en régions, sans gabarit, et BLFX ne les voit pas. Le MJ actif joue (les effets persistants de Sequencer sont gardés par la
 * scène et vus de tous) ; la région redessinée (anneau, mur déplacé), on rejoue ; la région partie, on arrête. Le bruit (facultatif) :
 * des sons d'ambiance du cœur posés le long du mur, retirés avec lui. Et chaque créature visée par un jet de dégâts du sort est touchée
 * (flammes, épines, lames). Un mur épais (posé sur les cases) : une boucle sur chaque case.
 * On ne lit que les régions : leurs formes et l'item qui les a posées (`flags.dnd5e.item`) — aucun lien avec le moteur.
 */

import { MODULE_ID, blfxActive, jb2aActive } from "./shared.mjs";
import { wallShape, ringSegments, animationFor, soundSpots, cellCenters } from "../core/walls.mjs";
import { WALLS } from "../data/walls.mjs";
import * as JB2A from "../data/jb2a.mjs";
import { renderer } from "./renderer.mjs";
import { aaPlays } from "./aa.mjs";
import { addSound, fileOf, known } from "./sequencer.mjs";

/**
 * La table des murs en vigueur : JB2A + PSFX si c'est le rendu choisi ; sinon BLFX s'il est là (les murs lui restaient avant
 * JB2A, quel que soit le rendu des consommables) ; sinon JB2A s'il est là ; sinon aucune.
 */
export function wallTable() {
  let backend = null;
  try { backend = renderer(); } catch { backend = null; }
  if ( backend === null ) return {};
  if ( backend === "jb2a" ) return JB2A.WALLS;
  if ( blfxActive() ) return WALLS;
  if ( jb2aActive() ) return JB2A.WALLS;
  return {};
}

const nameOf = region => `${MODULE_ID}.wall.${region.id}`;
const isExecutor = () => game.users.activeGM?.isSelf === true;

/** L'entrée de la table pour le sort qui a posé cette région, ou null (aussi quand Automated Animations joue ce mur). */
function entryOf(region) {
  const uuid = region?.flags?.dnd5e?.item;
  if ( !uuid ) return null;
  const item = fromUuidSync(uuid, { strict: false });
  const entry = wallTable()[item?.system?.identifier] ?? null;
  if ( !entry ) return null;
  const activity = fromUuidSync(region.flags.dnd5e.activity ?? "", { strict: false });
  return aaPlays(item, { activity, isTemplate: true }) ? null : entry;
}

/** L'animation d'anneau toute faite, si son module est actif et que Sequencer la connaît. */
function readyRing(entry) {
  const ring = entry.ring;
  if ( !ring || (ring.module && !game.modules.get(ring.module)?.active) ) return null;
  return known(ring.animation) ? ring : null;
}

/** Les sons d'ambiance posés pour ce mur. */
const soundsOf = region => (region.parent?.sounds ?? []).filter(s => s.getFlag(MODULE_ID, "wall") === region.id);

/** Arrête l'animation d'un mur, et son bruit. */
export async function stopWall(region) {
  const ids = soundsOf(region).map(s => s.id);
  if ( ids.length ) await region.parent.deleteEmbeddedDocuments("AmbientSound", ids).catch(() => null);
  if ( !globalThis.Sequencer?.EffectManager ) return;
  await Sequencer.EffectManager.endEffects({ name: nameOf(region) }).catch(() => null);
}

/**
 * Le bruit du mur : des sons d'ambiance du cœur, en boucle, spatialisés (plus fort en s'approchant ; les murs du cœur qui laissent passer
 * le son le laissent passer). Le fichier vient de la base de Sequencer (pack BLFX). Rend le nombre de sons posés.
 */
async function soundWall(region, shape, entry) {
  const sound = entry.sound;
  if ( !sound ) return 0;
  const file = known(sound.name) ? fileOf(sound.name) : null;
  if ( !file ) return 0;
  const scene = region.parent;
  const perFoot = scene.grid.size / scene.grid.distance;
  const spots = soundSpots(shape, sound.reach * perFoot);
  const created = await scene.createEmbeddedDocuments("AmbientSound", spots.map(p => ({
    x: Math.round(p.x), y: Math.round(p.y), radius: p.radius / perFoot, path: file, volume: sound.volume ?? 0.5, repeat: true,
    easing: true, walls: true, levels: Array.from(region.levels ?? []), flags: { [MODULE_ID]: { wall: region.id } }
  })));
  return created.length;
}

/** Joue l'animation d'un mur (après avoir arrêté la précédente). Rend ce qui a été lancé, ou la raison de ne rien jouer. */
export async function drawWall(region) {
  const entry = entryOf(region);
  if ( !entry ) return { skipped: "not a wall of the table" };
  if ( !entry.animations && !entry.tile && !entry.sound ) return { skipped: "nothing drawn for this wall" };
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
  const ring = (shape.ring && !entry.tile) ? readyRing(entry) : null;
  if ( entry.tile ) {
    // Un mur épais : la boucle sur chaque case qu'il couvre.
    const size = cell * (entry.tile.scale ?? 1);
    for ( const at of cellCenters(shape, cell) ) {
      sequence.effect().file(entry.tile.animation).atLocation(at).size({ width: size, height: size }).belowTokens()
        .persist().name(name).fadeIn(500);
      played.push(entry.tile.animation);
    }
  }
  else if ( ring ) {
    // Le cercle de l'image (`fill` de sa largeur) sur celui du mur.
    const size = (2 * shape.ring.radius) / (ring.fill ?? 1);
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
  const sounds = await soundWall(region, shape, entry).catch(err => { console.warn(`${MODULE_ID} | wall sound`, err); return 0; });
  return { played, sounds };
}

/**
 * Un jet de dégâts du sort (à l'apparition du mur, en le traversant, en finissant son tour dedans ou du côté brûlant) : la créature
 * visée est touchée — les parties `hit` de la table, sur chaque cible du jet présente sur la scène affichée.
 */
export function hitTargets(message) {
  if ( (message?.type !== "damage") || !globalThis.Sequence ) return { skipped: "not a damage roll, or Sequencer missing" };
  const item = message.getAssociatedActivity?.()?.item ?? message.getAssociatedItem?.() ?? null;
  const parts = wallTable()[item?.system?.identifier]?.hit;
  if ( !parts?.length ) return { skipped: "no hit for this item" };
  const tokens = (message.system?.targets ?? []).map(t => fromUuidSync(t.token ?? "", { strict: false })?.object).filter(Boolean);
  if ( !tokens.length ) return { skipped: "no target on the viewed scene" };
  const sequence = new Sequence({ moduleName: MODULE_ID });
  for ( const part of parts ) {
    if ( !known(part.animation) ) continue;
    for ( const token of tokens ) {
      const effect = sequence.effect().file(part.animation).atLocation(token).scaleToObject(part.scale ?? 1.5);
      if ( part.duration ) effect.attachTo(token).duration(part.duration).fadeOut(500);
      if ( part.delay ) effect.delay(part.delay);
      if ( part.tint ) effect.tint(part.tint);
    }
    if ( part.sound ) addSound(sequence, part.sound, { delay: part.delay ?? 0 });
  }
  sequence.play();
  return { burnt: tokens.map(t => t.name) };
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
  Hooks.on("createChatMessage", message => {
    if ( !isExecutor() ) return;
    try { hitTargets(message); } catch(err) { console.error(`${MODULE_ID} | wall hit`, err); }
  });
}
