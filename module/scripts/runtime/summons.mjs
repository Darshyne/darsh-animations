/**
 * L'apparition d'une créature invoquée sans BLFX (data/summons.mjs). dnd5e annonce la pose chez le client qui invoque
 * (`dnd5e.postSummon` `(activity, profile, tokens, options)`, documents/activity/summon.mjs, après la création des tokens) ; on y
 * joue par Sequencer, sur chaque token posé — Sequencer diffuse à tous les clients. Avec BLFX actif, rien : son Auto-Rec
 * (« After Summon ») s'en charge, la nôtre comble les sorts qu'il ne connaît pas (data/animations.mjs).
 */

import { MODULE_ID, blfxActive } from "./shared.mjs";
import { renderer } from "./renderer.mjs";
import { JB2A_SUMMON } from "../data/summons.mjs";
import { addSound, known } from "./sequencer.mjs";

/** Joue l'apparition sur des tokens (TokenDocument ou Token). Rend ce qui a été lancé, ou la raison de ne rien jouer. */
export function playSummon(tokens, { force=false }={}) {
  if ( blfxActive() && !force ) return { skipped: "BLFX plays its own After Summon" };
  if ( renderer() !== "jb2a" ) return { skipped: `no summon animation for ${renderer() ?? "none"}` };
  const placed = (tokens ?? []).map(t => t?.object ?? t).filter(t => t?.document?.parent === canvas.scene);
  if ( !placed.length ) return { skipped: "no summoned token on the viewed scene" };
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const played = [];
  for ( const token of placed ) {
    for ( const part of JB2A_SUMMON ) {
      if ( !known(part.animation) ) continue;
      const effect = sequence.effect().file(part.animation).atLocation(token).scaleToObject(part.scale ?? 1);
      if ( part.delay ) effect.delay(part.delay);
      if ( part.below ) effect.belowTokens();
      played.push(part.animation);
      if ( part.sound && addSound(sequence, part.sound, { delay: part.delay ?? 0 }) ) played.push(part.sound);
    }
  }
  if ( !played.length ) return { skipped: "animations unknown to Sequencer" };
  sequence.play();
  return { played };
}

export function registerSummons() {
  Hooks.on("dnd5e.postSummon", (activity, profile, tokens) => {
    try { playSummon(tokens); }
    catch(err) { console.error(`${MODULE_ID} | summon animation`, err); }
  });
}

/** Pour vérifier en jeu (connecteur MCP) : joue l'apparition sur un token de la scène affichée, BLFX ou non. */
export function previewSummon({ tokenId }={}) {
  const token = canvas.scene?.tokens.get(tokenId);
  if ( !token ) return { error: `token not found: ${tokenId}` };
  return playSummon([token], { force: true });
}
