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
 * l'incantation est arrêtée.
 *
 * Zone posée tout de suite (signalé sur le Discord le 2026-11-17, Éclair) : BLFX démarre le son d'incantation avec un retard
 * (`DELAY_SOUND12: 500` pour Éclair, Mur de feu) et ne l'arrête qu'à la pose, par son nom. Quand le moteur pose la zone dès
 * l'utilisation (visée avant le lancement : cône, ligne, cube de portée personnelle, murs par points), cet arrêt arrive avant que
 * le son existe, et la boucle tourne sans fin. Chez le client qui a créé la région, l'incantation est donc arrêtée une seconde fois
 * un peu plus tard (`LATE_END_MS`) : sans effet si BLFX l'a déjà arrêtée, jamais le son de la zone elle-même (autre nom).
 *
 * Toujours en boucle chez les autres (signalé de nouveau le 2026-11-19, Animations 0.16.1) : Sequencer n'arrête un son que là où il
 * l'a déjà chargé (`SoundManager.endSounds` part de la liste locale `RunningSounds`, et n'envoie rien si elle est vide). Un client
 * qui charge encore le son quand l'arrêt passe le garde. Donc, **sur chaque client** : à la création de la région, le nom du son
 * d'incantation est attendu pendant `EXPECT_MS` ; un son de ce nom qui commence (`createSequencerSound`, appelé avant le chargement)
 * est arrêté chez soi dès qu'il est chargé, et chaque client arrête aussi le sien à `LOCAL_ENDS_MS`.
 */
import { MODULE_ID, blfxActive, log } from "./shared.mjs";

const ENGINE = "dnd5e-combat";
/** Après la fin de la visée, le temps laissé à la région pour apparaître. */
const GRACE_MS = 1500;
/** Au-delà, on cesse de surveiller (une visée oubliée ouverte). */
const MAX_WATCH_MS = 5 * 60 * 1000;
const POLL_MS = 500;
/** Après la création d'une région, le temps laissé à l'incantation retardée de BLFX pour démarrer avant le second arrêt. */
const LATE_END_MS = 2000;
/** Sur chaque client, après la création d'une région : les arrêts locaux de rattrapage. */
const LOCAL_ENDS_MS = Object.freeze([2000, 5000, 10000]);
/** Pendant combien de temps un son d'incantation qui démarre est arrêté dès son chargement. */
const EXPECT_MS = 15000;
/** Combien de temps attendre qu'un son qui démarre soit chargé. */
const LOAD_WAIT_MS = 10000;

/** Les sons d'incantation à arrêter dès leur chargement (nom → instant limite). */
const expected = new Map();

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
export async function endCasting(itemName, tokenId, { push=true }={}) {
  const video = `Video-${itemName}-${tokenId}`;
  const sound = soundName(itemName, tokenId);
  const effects = globalThis.Sequencer?.EffectManager?.getEffects?.({ name: video })?.length ?? 0;
  if ( push ) await globalThis.Sequencer?.EffectManager?.endEffects?.({ name: video });
  let sounds = 0;
  try {
    sounds = globalThis.Sequencer?.SoundManager?.getSounds?.({ name: sound })?.length ?? 0;
    if ( sounds ) await globalThis.Sequencer.SoundManager.endSounds({ name: sound }, push);
  } catch { /* gestionnaire de sons absent */ }
  if ( effects || sounds ) log(`${itemName}: area placement cancelled, BLFX casting stopped (${effects} effect(s), ${sounds} sound(s))`);
  return { effects, sounds };
}

/** Le nom que BLFX donne au son d'incantation. */
const soundName = (itemName, tokenId) => `Sound-${itemName}-${tokenId}`;

/** Un son de Sequencer commence sur ce client (avant son chargement) : si c'est une incantation attendue, l'arrêter une fois chargé. */
export async function onSoundStarting(data) {
  const name = data?.name;
  const until = name ? expected.get(name) : null;
  if ( !until ) return { skipped: "not expected" };
  if ( Date.now() > until ) { expected.delete(name); return { skipped: "expired" }; }
  const start = Date.now();
  while ( (Date.now() - start) < LOAD_WAIT_MS ) {
    if ( globalThis.Sequencer?.SoundManager?.getSounds?.({ name })?.length ) {
      await globalThis.Sequencer.SoundManager.endSounds({ name }, false);
      log(`${name}: late BLFX casting sound stopped on this client`);
      return { ended: name };
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { skipped: "never loaded" };
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

/** Le token du lanceur d'une région posée pour une activité : son origine (`flags.dnd5e.origin`), sinon un token de l'acteur sur sa scène. */
function regionCaster(region, activity) {
  const origin = region.flags?.dnd5e?.origin;
  const doc = origin ? fromUuidSync(origin, { strict: false }) : null;
  if ( (doc?.documentName === "Token") && (doc.parent === region.parent) ) return doc;
  return activity.actor?.getActiveTokens?.(false, true)?.find(t => t.parent === region.parent) ?? null;
}

/**
 * Une région vient d'être posée pour une activité (sur chaque client) : attendre le son d'incantation retardé de BLFX pour l'arrêter
 * dès son chargement, l'arrêter chez soi aux rattrapages, et, chez le client qui a posé la région, l'arrêter partout un peu plus tard
 * (la course décrite en tête du fichier). Rend ce qui a été décidé (scénarios).
 */
export async function onRegionPlaced(region, userId) {
  const uuid = region?.flags?.dnd5e?.activity;
  if ( !uuid ) return { skipped: "no activity" };
  placed.set(uuid, Date.now());
  if ( !blfxActive() ) return { skipped: "no BLFX" };
  const activity = await fromUuid(uuid).catch(() => null);
  const itemName = activity?.item?.name;
  const token = activity ? regionCaster(region, activity) : null;
  if ( !itemName || !token ) return { skipped: "no item or caster" };
  const fail = err => console.error(`${MODULE_ID} | casting cleanup`, err);
  expected.set(soundName(itemName, token.id), Date.now() + EXPECT_MS);
  for ( const ms of LOCAL_ENDS_MS ) setTimeout(() => endCasting(itemName, token.id, { push: false }).catch(fail), ms);
  const ours = userId === game.user.id;
  if ( ours ) setTimeout(() => endCasting(itemName, token.id).catch(fail), LATE_END_MS);
  return { lateEnd: ours ? LATE_END_MS : null, localEnds: LOCAL_ENDS_MS, expected: soundName(itemName, token.id), token: token.id };
}

export function registerCasting() {
  Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => { onPostUse(activity, usageConfig, results); });
  Hooks.on("createRegion", (region, options, userId) => {
    onRegionPlaced(region, userId).catch(err => console.error(`${MODULE_ID} | casting cleanup`, err));
  });
  Hooks.on("createSequencerSound", data => {
    onSoundStarting(data).catch(err => console.error(`${MODULE_ID} | casting cleanup`, err));
  });
}

/**
 * Pour les scénarios : jouer une incantation persistante comme BLFX la nomme, puis la surveiller comme après une pose annulée
 * (`watch: false` : seulement la jouer, comme le son retardé de BLFX qui démarre après la pose de la zone).
 */
export async function previewCancelledCast({ tokenId, identifier, animation, watch=true }={}) {
  const token = canvas.scene?.tokens.get(tokenId);
  const item = token?.actor?.items.find(i => i.system?.identifier === identifier);
  const activity = [...(item?.system?.activities ?? [])].find(a => a.target?.template?.type) ?? null;
  if ( !activity || !token ) return { error: "activity or token not found" };
  const name = `Video-${activity.item.name}-${token.id}`;
  await new Sequence({ moduleName: MODULE_ID }).effect().file(animation).atLocation(token.object).attachTo(token.object)
    .name(name).persist().play();
  const before = globalThis.Sequencer.EffectManager.getEffects({ name }).length;
  const decided = watch
    ? onPostUse(activity, {}, { templates: [], message: { speaker: { scene: token.parent.id, token: token.id } } })
    : { watching: null };
  return { name, before, decided, activity: activity.uuid };
}

/** Pour les scénarios : combien d'effets portent encore ce nom ; `end` : les arrêter. */
export async function castingEffects({ name, end=false }={}) {
  const count = globalThis.Sequencer?.EffectManager?.getEffects?.({ name })?.length ?? 0;
  if ( end && count ) await globalThis.Sequencer.EffectManager.endEffects({ name });
  return { count };
}

/**
 * Pour les scénarios : jouer sur ce client seulement (comme un client qui charge le son après l'arrêt) un son en boucle nommé comme
 * l'incantation de BLFX pour cet objet et ce token (ou `name`, pour un témoin). Rend son nom.
 */
export async function previewCastingSound({ tokenId, identifier, file="sounds/notify.wav", name=null }={}) {
  const token = canvas.scene?.tokens.get(tokenId);
  const item = token?.actor?.items.find(i => i.system?.identifier === identifier);
  if ( !item || !token ) return { error: "item or token not found" };
  name ??= soundName(item.name, token.id);
  new Sequence({ moduleName: MODULE_ID }).sound().file(file).name(name).volume(0).duration(60000).locally().play();
  return { name };
}

/** Pour les scénarios : combien de sons portent encore ce nom sur ce client ; `end` : les arrêter (ici seulement). */
export async function castingSounds({ name, end=false }={}) {
  const count = globalThis.Sequencer?.SoundManager?.getSounds?.({ name })?.length ?? 0;
  if ( end && count ) await globalThis.Sequencer.SoundManager.endSounds({ name }, false);
  return { count };
}
