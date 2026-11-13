/**
 * L'image animée JB2A sur le token d'une invocation (data/summon-art.mjs, core/summon-art.mjs, SPEC §26). Au hook `dnd5e.postSummon`
 * `(activity, profile, tokens, options)`, chez le client qui invoque (c'est lui qui a créé les tokens, il peut donc les modifier) :
 *
 * 1. rien si le réglage de monde `summonArt` est coupé, si le domaine « Invocations » est coupé ou si JB2A n'y est pas une source
 *    (fenêtre « Sources d'animation »), ou si le sort n'a pas d'entrée dans la table ;
 * 2. rien si le MJ a choisi l'image lui-même — critère : l'acteur invoqué doit venir d'un COMPENDIUM (profil pointant vers un acteur du
 *    monde = choix du MJ), et l'image du token posé doit être celle de cet acteur de compendium (une copie du monde dont le MJ a changé
 *    l'image de token, ou un autre module qui l'a changée, donne une autre image : on n'y touche pas) ;
 * 3. sinon : les variantes que la base de Sequencer offre (JB2A gratuit, ou Premium), la dernière que ce personnage a choisie pour ce
 *    sort (drapeau sur l'acteur qui lance), sinon celle de la table ; elle est posée tout de suite, sur ces tokens seulement — jamais
 *    l'acteur du compendium ni un acteur du monde —, puis, s'il y a plus d'une variante et que le réglage client `summonArtAsk` est
 *    allumé, une petite fenêtre propose d'en choisir une autre (ui/summon-art-window.mjs), « Comme la dernière invocation » en premier.
 *
 * BLFX ne change pas l'image du token (son « After Summon » joue une apparition) : l'image se pose avec ou sans lui.
 */

import { MODULE_ID } from "./shared.mjs";
import { chain } from "./sources.mjs";
import { artEntry, artUpdate, chooseVariant, isCompendiumUuid, isOriginalArt, restoreUpdate, variantsOf } from "../core/summon-art.mjs";
import { askSummonArt } from "../ui/summon-art-window.mjs";

export const SUMMON_ART_SETTING = "summonArt";
export const SUMMON_ART_ASK = "summonArtAsk";

const on = () => game.settings.get(MODULE_ID, SUMMON_ART_SETTING) !== false;

/** Les variantes de cette entrée dans la base de Sequencer chargée. */
export function variantsFor(entry) {
  const flat = globalThis.Sequencer?.Database?.flattenedEntriesAdvanced ?? [];
  return variantsOf(entry, flat);
}

/** La dernière variante que cet acteur a choisie pour ce sort (clé de la table). */
const lastOf = (actor, key) => actor?.getFlag?.(MODULE_ID, `summonArt.${key}`) ?? null;

async function remember(actor, key, name) {
  if ( !actor?.isOwner || !name ) return;
  try { await actor.setFlag(MODULE_ID, `summonArt.${key}`, name); }
  catch(err) { console.warn(`${MODULE_ID} | summon art: could not remember the choice`, err); }
}

/** Pose cette variante sur ces tokens (une seule mise à jour de la scène). */
export async function applyVariant(entry, variant, tokens) {
  const byScene = new Map();
  for ( const token of tokens ) {
    const list = byScene.get(token.parent) ?? [];
    list.push({ _id: token.id, ...artUpdate(entry, variant, token, { moduleId: MODULE_ID }) });
    byScene.set(token.parent, list);
  }
  for ( const [scene, updates] of byScene ) await scene.updateEmbeddedDocuments("Token", updates);
}

/**
 * Pourquoi ce token ne prend pas l'image (texte court), ou null s'il la prend. `source` : l'acteur du compendium d'origine.
 */
function refusal(token, source) {
  if ( !token?.canUserModify?.(game.user, "update") ) return "this user cannot update the token";
  if ( !isOriginalArt({ tokenSrc: token.texture?.src, sourceSrc: source.prototypeToken?.texture?.src, sourceImg: source.img,
    defaultToken: CONST.DEFAULT_TOKEN }) ) return "token image chosen by the GM (not the compendium's)";
  return null;
}

/**
 * Ce qui sera posé pour cette invocation : `{ entry, variants, chosen, tokens, actor }`, ou `{ skipped }`.
 */
export async function planSummonArt(activity, profile, tokens, { force=false }={}) {
  if ( !force && !on() ) return { skipped: "summon art turned off (world setting)" };
  if ( !chain("summons").includes("jb2a") ) return { skipped: "summons: JB2A not available or turned off" };
  const entry = artEntry(activity?.item?.system?.identifier);
  if ( !entry ) return { skipped: `no summon art for ${activity?.item?.system?.identifier}` };
  const placed = (tokens ?? []).map(t => t?.document ?? t).filter(t => t?.documentName === "Token");
  if ( !placed.length ) return { skipped: "no summoned token" };
  // Profil : l'acteur choisi dans le sort. Mode « par FP » : pas d'UUID, celle d'où vient la copie du monde.
  const sourceUuid = profile?.uuid || placed[0].actor?._stats?.compendiumSource;
  if ( !isCompendiumUuid(sourceUuid) ) return { skipped: "summoned actor is the GM's own world actor" };
  const source = await fromUuid(sourceUuid);
  if ( !source ) return { skipped: `source actor not found: ${sourceUuid}` };
  const kept = placed.filter(t => !refusal(t, source));
  if ( !kept.length ) return { skipped: refusal(placed[0], source) };
  const variants = variantsFor(entry);
  const actor = activity?.actor ?? null;
  const last = lastOf(actor, entry.key);
  const chosen = chooseVariant(variants, { last, fallback: entry.default });
  if ( !chosen ) return { skipped: "no variant known to Sequencer" };
  return { entry, variants, chosen, last, tokens: kept, actor };
}

/** Au hook `dnd5e.postSummon` : pose l'image, puis propose d'en changer. */
export async function onSummoned(activity, profile, tokens, { ask=null, force=false }={}) {
  const plan = await planSummonArt(activity, profile, tokens, { force });
  if ( plan.skipped ) return plan;
  await applyVariant(plan.entry, plan.chosen, plan.tokens);
  const wantsAsk = ask ?? (game.settings.get(MODULE_ID, SUMMON_ART_ASK) !== false);
  if ( wantsAsk && (plan.variants.length > 1) ) {
    askSummonArt({ entry: plan.entry, variants: plan.variants, current: plan.chosen, hasLast: !!plan.last,
      itemName: activity?.item?.name ?? "" }).then(async picked => {
      if ( !picked || (picked.name === plan.chosen.name) ) {
        if ( !plan.last ) await remember(plan.actor, plan.entry.key, plan.chosen.name);
        return;
      }
      const alive = plan.tokens.filter(t => t.parent?.tokens?.has(t.id));
      if ( alive.length ) await applyVariant(plan.entry, picked, alive);
      await remember(plan.actor, plan.entry.key, picked.name);
    }).catch(err => console.error(`${MODULE_ID} | summon art choice`, err));
  }
  else if ( !plan.last ) await remember(plan.actor, plan.entry.key, plan.chosen.name);
  return { applied: plan.chosen.name, file: plan.chosen.file, tokens: plan.tokens.map(t => t.id), variants: plan.variants.length };
}

export function registerSummonArt() {
  game.settings.register(MODULE_ID, SUMMON_ART_SETTING, {
    name: "DARSHANIM.Settings.SummonArt.Name", hint: "DARSHANIM.Settings.SummonArt.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, SUMMON_ART_ASK, {
    name: "DARSHANIM.Settings.SummonArtAsk.Name", hint: "DARSHANIM.Settings.SummonArtAsk.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  Hooks.on("dnd5e.postSummon", (activity, profile, tokens) => {
    onSummoned(activity, profile, tokens).catch(err => console.error(`${MODULE_ID} | summon art`, err));
  });
}

/**
 * Pour vérifier en jeu (connecteur MCP) : pose l'image d'un sort sur un token de la scène affichée, sans invocation ni fenêtre.
 * `identifier` (défaut : celui de la table qui correspond à l'acteur), `variant` (nom Sequencer, défaut : celui de la table),
 * `restore: true` pour remettre l'image d'avant. Ne vérifie pas le critère « image du MJ » (c'est l'affaire de `onSummoned`).
 */
export async function previewSummonArt({ tokenId, identifier, variant=null, restore=false }={}) {
  const token = canvas.scene?.tokens.get(tokenId);
  if ( !token ) return { error: `token not found: ${tokenId}` };
  if ( restore ) {
    const update = restoreUpdate(token, { moduleId: MODULE_ID });
    if ( !update ) return { skipped: "nothing to restore" };
    await token.update(update);
    return { restored: token.texture.src };
  }
  const entry = artEntry(identifier);
  if ( !entry ) return { error: `no summon art for ${identifier}` };
  const variants = variantsFor(entry);
  const chosen = variants.find(v => v.name === variant) ?? chooseVariant(variants, { fallback: entry.default });
  if ( !chosen ) return { skipped: "no variant known to Sequencer" };
  await applyVariant(entry, chosen, [token]);
  return { applied: chosen.name, file: chosen.file, variants: variants.length };
}

/** Les variantes offertes pour un sort sur ce client (pour les scénarios et le connecteur). */
export function summonArtVariants({ identifier }={}) {
  const entry = artEntry(identifier);
  if ( !entry ) return { error: `no summon art for ${identifier}` };
  const variants = variantsFor(entry);
  return { key: entry.key, default: entry.default, count: variants.length, groups: [...new Set(variants.map(v => v.group))].filter(Boolean),
    variants: variants.map(v => v.name) };
}
