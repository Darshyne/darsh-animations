/**
 * Les animations des pièges (data/traps.mjs). Exception assumée à « BLFX déclenche, pas nous » (SPEC §7) : BLFX ne joue rien
 * sans token source, et un acteur piège n'en a pas. On écoute le hook public `darsh-loot.trapFired`, émis par le MJ actif au
 * déclenchement, et on joue par Sequencer — ses effets et ses sons partent chez tous les clients. Ce module ne connaît pas
 * celui qui émet le hook : n'importe quel module peut l'appeler avec la même charge.
 *
 * Charge : `{ actor, activity, targets: TokenDocument[], region, effectRegion? }` (Actor, Activity, Region).
 */

import { MODULE_ID } from "./shared.mjs";
import { renderer } from "./renderer.mjs";
import { placeTokenMagic } from "./consumables.mjs";
import { playNative } from "./native.mjs";
import { COLORS } from "../data/consumables.mjs";
import { trapParts } from "../core/traps.mjs";
import { BY_DAMAGE, TRAPS } from "../data/traps.mjs";
import * as JB2A from "../data/jb2a.mjs";
import { addSound, known } from "./sequencer.mjs";

/** Les tables de chaque rendu Sequencer : BLFX (data/traps.mjs), JB2A + PSFX (data/jb2a.mjs). */
const TABLES = { blfx: { traps: TRAPS, byDamage: BY_DAMAGE }, jb2a: { traps: JB2A.TRAPS, byDamage: JB2A.TRAPS_BY_DAMAGE } };

export const TRAP_HOOK = "darsh-loot.trapFired";

/** Les types de dégâts d'une activité, dans l'ordre de ses parties. */
function damageTypes(activity) {
  return (activity?.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]);
}

/** La boîte d'une région sur la scène : centre et taille. */
function areaOf(region) {
  const b = region?.bounds;
  if ( !b || !(b.width > 0) ) return null;
  return { x: b.x + (b.width / 2), y: b.y + (b.height / 2), width: b.width, height: b.height };
}

/**
 * Joue les animations d'un piège. Rend ce qui a été lancé (pour la vérification), ou la raison de ne rien jouer.
 * @param {{ actor: Actor, activity?: object, targets?: TokenDocument[], region?: Region, effectRegion?: Region }} payload
 */
export function playTrap({ actor, activity=null, targets=[], region=null, effectRegion=null }={}) {
  // BLFX > JB2A + PSFX > Token Magic FX > rendu autonome (runtime/renderer.mjs) : sans les deux premiers, une lueur rouge et une
  // onde, ou un anneau rouge, sur chaque victime — un piège est toujours une mauvaise nouvelle.
  const backend = renderer();
  if ( !backend ) return { skipped: "renderer set to none" };
  if ( !TABLES[backend] ) return playTrapFallback(backend, targets);
  const { traps, byDamage } = TABLES[backend];
  // Source de compendium : `_stats.compendiumSource`, ou l'ancien drapeau `core.sourceId` (acteur copié à la main).
  const sourceId = actor?._stats?.compendiumSource ?? actor?.flags?.core?.sourceId;
  const parts = trapParts({ id: actor?.id, sourceId, damageTypes: damageTypes(activity) }, traps, byDamage);
  if ( !parts.length ) return { skipped: "no animation for this trap" };
  const area = areaOf(effectRegion ?? region);
  const onScene = targets.map(t => t?.object).filter(Boolean);
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const played = [];
  for ( const part of parts ) {
    const places = (part.at === "area") ? (area ? [area] : []) : onScene;
    if ( !known(part.animation) ) continue;
    for ( const place of places ) {
      const effect = sequence.effect().file(part.animation);
      if ( part.at === "area" ) {
        const scale = part.scale ?? 1;
        effect.atLocation({ x: place.x, y: place.y }).size({ width: place.width * scale, height: place.height * scale });
      }
      else effect.atLocation(place).scaleToObject(part.scale ?? 1.5);
      if ( part.delay ) effect.delay(part.delay);
      if ( part.duration ) effect.duration(part.duration).fadeOut(400);
      if ( part.below ) effect.belowTokens();
      if ( part.tint ) effect.tint(part.tint);
      played.push(part.animation);
    }
    if ( part.sound && places.length && addSound(sequence, part.sound, { delay: part.delay ?? 0 }) ) played.push(part.sound);
  }
  if ( !played.length ) return { skipped: "no area or target on the viewed scene" };
  sequence.play();
  return { backend, played };
}

/** Le piège sans BLFX ni JB2A : sur chaque victime de la scène affichée. */
async function playTrapFallback(backend, targets) {
  const tokens = targets.map(t => t?.object).filter(Boolean);
  if ( !tokens.length ) return { skipped: "no target on the viewed scene" };
  if ( backend === "tokenmagic" ) {
    return { played: await placeTokenMagic(tokens, { glow: { strength: 6, loops: 1 }, wave: true }, COLORS.red, "trap") };
  }
  playNative(tokens, COLORS.red);
  return { played: tokens.map(t => `ring:red:${t.name}`) };
}

/** Au déclenchement d'un piège, chez le client qui émet le hook (le MJ actif). */
export function registerTraps() {
  Hooks.on(TRAP_HOOK, payload => {
    try { Promise.resolve(playTrap(payload)).catch(err => console.error(`${MODULE_ID} | trap animation`, err)); }
    catch(err) { console.error(`${MODULE_ID} | trap animation`, err); }
  });
}

/**
 * Pour vérifier en jeu (MJ, ou connecteur MCP) : joue les animations d'un acteur piège sur une région et des tokens de la scène
 * affichée, sans rien déclencher. `actor` : id ou uuid d'un acteur (du monde ou d'un compendium) ; `targets` : ids ou noms.
 */
export async function previewTrap({ actor, regionId=null, targets=[] }={}) {
  const doc = String(actor).includes(".") ? await fromUuid(actor) : game.actors.get(actor);
  if ( !doc ) return { error: `actor not found: ${actor}` };
  const activity = doc.items.find(i => i.system.activities?.size)?.system.activities.contents[0] ?? null;
  const tokens = targets.map(ref => canvas.scene.tokens.get(ref) ?? canvas.scene.tokens.find(t => t.name === ref)).filter(Boolean);
  const region = regionId ? canvas.scene.regions.get(regionId) : null;
  return playTrap({ actor: doc, activity, targets: tokens, region });
}
