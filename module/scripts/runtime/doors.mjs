/**
 * Les animations des serrures de porte (data/doors.mjs). Exception à « BLFX déclenche, pas nous », comme les pièges (SPEC §7) : une
 * porte n'a ni objet ni activité. On écoute les hooks publics de DAS · Core, émis chez le MJ actif après les dés (le moteur attend la
 * fin de l'animation de Dice So Nice avant de juger l'essai), et on joue par Sequencer au milieu de la porte — chez tous les clients.
 *  - `dnd5e-combat.noise` `({ token, point, scene, cause, wall })` : `cause` « forceDoor » → un coup contre la porte ;
 *  - `dnd5e-combat.doorUnlocked` `({ door, token, method })` : crochetée ou à la clé → la serrure cède ; forcée → la porte éclate.
 * Rendu (runtime/renderer.mjs) : BLFX, ou JB2A + PSFX ; sans eux, rien (pas de token où poser un anneau ou un filtre).
 */

import { MODULE_ID } from "./shared.mjs";
import { renderer } from "./renderer.mjs";
import { doorMoment } from "../core/doors.mjs";
import { BLFX_DOORS, JB2A_DOORS } from "../data/doors.mjs";
import { addSound, known } from "./sequencer.mjs";

export const NOISE_HOOK = "dnd5e-combat.noise";
export const DOOR_UNLOCKED_HOOK = "dnd5e-combat.doorUnlocked";

const TABLES = { blfx: BLFX_DOORS, jb2a: JB2A_DOORS };

/** Le milieu d'une porte (WallDocument). */
function doorCenter(wall) {
  const c = wall?.c;
  return c ? { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 } : null;
}

/**
 * Joue un moment de serrure (« unlock », « force », « burst ») au point donné, sur la scène affichée. Rend ce qui a été lancé, ou la
 * raison de ne rien jouer.
 */
export function playDoor(moment, { point=null, scene=null }={}) {
  const backend = renderer();
  const parts = TABLES[backend]?.[moment];
  if ( !parts ) return { skipped: backend ? `no door animation for ${backend}` : "renderer set to none" };
  if ( !point ) return { skipped: "no door position" };
  if ( scene && (scene !== canvas.scene) ) return { skipped: "door on another scene" };
  const size = canvas.grid?.size ?? 100;
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const played = [];
  for ( const part of parts ) {
    if ( !known(part.animation) ) continue;
    const side = size * (part.scale ?? 1);
    const effect = sequence.effect().file(part.animation).atLocation(point).size({ width: side, height: side });
    if ( part.delay ) effect.delay(part.delay);
    if ( part.below ) effect.belowTokens();
    played.push(part.animation);
    if ( part.sound && addSound(sequence, part.sound, { delay: part.delay ?? 0 }) ) played.push(part.sound);
  }
  if ( !played.length ) return { skipped: "animations unknown to Sequencer" };
  sequence.play();
  return { backend, moment, played };
}

function safely(fn) {
  try { Promise.resolve(fn()).catch(err => console.error(`${MODULE_ID} | door animation`, err)); }
  catch(err) { console.error(`${MODULE_ID} | door animation`, err); }
}

/** Chez le client qui émet les hooks (le MJ actif) : Sequencer diffuse à tous. */
export function registerDoors() {
  Hooks.on(NOISE_HOOK, ({ point, scene, cause }={}) => safely(() => {
    const moment = doorMoment("noise", { cause });
    if ( moment ) playDoor(moment, { point, scene });
  }));
  Hooks.on(DOOR_UNLOCKED_HOOK, ({ door, method }={}) => safely(() => {
    const moment = doorMoment("doorUnlocked", { method });
    if ( moment ) playDoor(moment, { point: doorCenter(door), scene: door?.parent });
  }));
}

/** Pour vérifier en jeu (MJ, ou connecteur MCP) : joue un moment sur une porte de la scène affichée, sans rien déverrouiller. */
export function previewDoor({ wallId, moment="unlock" }={}) {
  const wall = canvas.scene?.walls.get(wallId);
  if ( !wall ) return { error: `wall not found: ${wallId}` };
  return playDoor(moment, { point: doorCenter(wall), scene: wall.parent });
}
