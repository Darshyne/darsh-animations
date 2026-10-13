/**
 * L'incantation de BLFX qui ne s'arrête pas (bogue signalé par l'utilisateur le 2026-10-13) : pour un sort à zone, BLFX joue sur le
 * lanceur une animation et un son d'incantation **persistants** (`Video-<nom de l'item>-<id du token>`, `Sound-<…>`, dans
 * `macros/spell/spellMacro.js` de BLFX), qu'il n'arrête qu'à la pose de la zone (`onCircleTemplate` et ses semblables). Il ne connaît
 * l'annulation que pour les gabarits de V13 (`destroyMeasuredTemplate` au clic droit) : en V14, dnd5e 6 pose une **région**
 * (`canvas.regions.placeRegions`), et une pose annulée ne crée rien — l'incantation tourne sans fin sur le token.
 *
 * Ici, chez le client qui a utilisé l'activité : après l'utilisation (`dnd5e.postUseActivity`), une activité à zone sans zone posée
 * (`results.templates` vide) est surveillée. Tant que le moteur de combat vise encore une zone pour elle (murs par points, zones
 * visées : `api.ui.targeting()`, lu seulement s'il est là), on attend ; sans visée, et sans région créée pour cette activité peu après,
 * l'incantation est arrêtée. Rien n'est arrêté si la zone a été posée : BLFX s'en charge.
 */
import { MODULE_ID, blfxActive, log } from "./shared.mjs";

const ENGINE = "dnd5e-combat";
/** Après la fin de la visée, le temps laissé à la région pour apparaître. */
const GRACE_MS = 1500;
/** Au-delà, on cesse de surveiller (une visée oubliée ouverte). */
const MAX_WATCH_MS = 5 * 60 * 1000;
const POLL_MS = 500;

/** Activités dont une région vient d'être posée (uuid → instant). */
const placed = new Map();

/** Le moteur vise-t-il une zone pour cette activité en ce moment ? */
function engineAiming(activity) {
  const engine = game.modules.get(ENGINE);
  const state = engine?.active ? engine.api?.ui?.targeting?.() : null;
  if ( !state ) return false;
  return (state.activity === activity.uuid) || (state.kind === "area");
}

/** Le token du lanceur : celui de la carte d'utilisation, sinon un token actif de l'acteur sur la scène affichée. */
function casterToken(activity, results) {
  const speaker = results?.message?.speaker;
  if ( speaker?.token && (speaker.scene === canvas.scene?.id) ) return canvas.scene.tokens.get(speaker.token) ?? null;
  return activity.actor?.getActiveTokens?.(false, true)?.find(t => t.parent === canvas.scene) ?? null;
}

/**
 * Arrêter l'incantation de BLFX pour cet item sur ce token (les noms que BLFX lui donne). Rend le nombre d'effets et de sons arrêtés.
 * @param {string} itemName
 * @param {string} tokenId
 */
export async function endCasting(itemName, tokenId) {
  const video = `Video-${itemName}-${tokenId}`;
  const sound = `Sound-${itemName}-${tokenId}`;
  const effects = globalThis.Sequencer?.EffectManager?.getEffects?.({ name: video })?.length ?? 0;
  await globalThis.Sequencer?.EffectManager?.endEffects?.({ name: video });
  let sounds = 0;
  try {
    sounds = globalThis.Sequencer?.SoundManager?.getSounds?.({ name: sound })?.length ?? 0;
    await globalThis.Sequencer?.SoundManager?.endSounds?.({ name: sound });
  } catch { /* gestionnaire de sons absent */ }
  if ( effects || sounds ) log(`${itemName}: area placement cancelled, BLFX casting stopped (${effects} effect(s), ${sounds} sound(s))`);
  return { effects, sounds };
}

/** Surveiller une activité à zone dont la zone n'a pas (encore) été posée. */
function watch(activity, token) {
  const started = Date.now();
  let aimEnded = null;
  const timer = setInterval(() => {
    const now = Date.now();
    const posed = placed.get(activity.uuid);
    if ( (posed && (posed >= started)) || ((now - started) > MAX_WATCH_MS) ) return clearInterval(timer);
    if ( engineAiming(activity) ) { aimEnded = null; return; }
    aimEnded ??= now;
    if ( (now - aimEnded) < GRACE_MS ) return;
    clearInterval(timer);
    endCasting(activity.item.name, token.id).catch(err => console.error(`${MODULE_ID} | casting cleanup`, err));
  }, POLL_MS);
}

/**
 * Après une utilisation : une activité à zone sans zone posée est surveillée. Rend ce qui a été décidé (scénarios).
 */
export function onPostUse(activity, usageConfig, results) {
  if ( !blfxActive() || !activity?.item ) return { skipped: "no BLFX" };
  if ( !activity.target?.template?.type ) return { skipped: "no area" };
  if ( results?.templates?.length ) return { skipped: "area placed" };
  const token = casterToken(activity, results);
  if ( !token ) return { skipped: "no caster token" };
  watch(activity, token);
  return { watching: activity.uuid, token: token.id };
}

export function registerCasting() {
  Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => { onPostUse(activity, usageConfig, results); });
  Hooks.on("createRegion", region => {
    const uuid = region.flags?.dnd5e?.activity;
    if ( uuid ) placed.set(uuid, Date.now());
  });
}

/** Pour les scénarios : jouer une incantation persistante comme BLFX la nomme, puis la surveiller comme après une pose annulée. */
export async function previewCancelledCast({ tokenId, identifier, animation }={}) {
  const token = canvas.scene?.tokens.get(tokenId);
  const item = token?.actor?.items.find(i => i.system?.identifier === identifier);
  const activity = [...(item?.system?.activities ?? [])].find(a => a.target?.template?.type) ?? null;
  if ( !activity || !token ) return { error: "activity or token not found" };
  const name = `Video-${activity.item.name}-${token.id}`;
  await new Sequence({ moduleName: MODULE_ID }).effect().file(animation).atLocation(token.object).attachTo(token.object)
    .name(name).persist().play();
  const before = globalThis.Sequencer.EffectManager.getEffects({ name }).length;
  const decided = onPostUse(activity, {}, { templates: [], message: { speaker: { scene: token.parent.id, token: token.id } } });
  return { name, before, decided, activity: activity.uuid };
}

/** Pour les scénarios : combien d'effets portent encore ce nom ; `end` : les arrêter. */
export async function castingEffects({ name, end=false }={}) {
  const count = globalThis.Sequencer?.EffectManager?.getEffects?.({ name })?.length ?? 0;
  if ( end && count ) await globalThis.Sequencer.EffectManager.endEffects({ name });
  return { count };
}
