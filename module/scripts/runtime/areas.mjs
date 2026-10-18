/**
 * Les effets de zone sans BLFX (SPEC §15, §17) : quand BLFX n'est pas là, ou qu'il ne reconnaît pas le sort, et qu'Automated
 * Animations ne le joue pas non plus, une zone posée par une activité dnd5e (région qui porte `flags.dnd5e.activity` : Mains
 * brûlantes, Boule de feu, Rayon de lune…) reçoit un effet choisi par l'identifiant du sort, sinon par le type de dégâts :
 *
 * - **JB2A + PSFX** (data/jb2a.mjs) : une animation Sequencer posée sur la forme de la zone (un cône ou une ligne étirés de
 *   l'origine vers le bout, le reste à la taille de la boîte de la région), avec son son ; en boucle, nommée, tant que la zone dure
 *   pour les sorts qui durent (Rayon de lune, Toile…), et rejouée quand la zone bouge.
 * - **Token Magic FX** (data/areas.mjs) : l'effet vit dans une **région compagne** créée par le MJ actif — mêmes formes, aucun
 *   comportement, visible de tous, verrouillée, marquée `flags["darsh-animations"].areaFx = <id de la zone>`, avec les options Token
 *   Magic (`tmfxPreset`, `tmfxTint`, `tmfxRegionOpacity`) que Token Magic lit à sa création (module/placeables/region.js,
 *   `preCreateRegion`). Elle suit les formes de la zone (un Rayon de lune déplacé).
 *
 * La zone du moteur et de dnd5e n'est jamais modifiée. L'effet disparaît avec elle — pas avant `MIN_VISIBLE_MS` après son
 * apparition : une zone instantanée est retirée vite par le moteur.
 */
import { MODULE_ID, jb2aActive, log } from "./shared.mjs";
import { renderer, tokenMagicActive } from "./renderer.mjs";
import { areaPreset } from "../core/areas.mjs";
import { lineEnds } from "../core/walls.mjs";
import { BY_DAMAGE, BY_IDENTIFIER, MIN_VISIBLE_MS } from "../data/areas.mjs";
import * as JB2A from "../data/jb2a.mjs";
import { blfxPlays, loadBlfxMap } from "./blfxmap.mjs";
import { aaPlays } from "./aa.mjs";
import { wallTable } from "./walls.mjs";
import { addSound, known } from "./sequencer.mjs";

const isExecutor = () => game.users.activeGM?.isSelf === true;
const isFx = region => !!region?.flags?.[MODULE_ID]?.areaFx;

/**
 * Zone → `{ fx: id de la compagne Token Magic ou null, jb2a: nom de l'effet JB2A persistant ou null, entry, at: horodatage }`.
 */
const companions = new Map();

/** Le nom Sequencer de l'effet JB2A persistant d'une zone. */
const fxName = regionId => `${MODULE_ID}.area.${regionId}`;

/**
 * Le rendu des zones : JB2A + PSFX ou Token Magic FX. Avec BLFX choisi mais qui ne connaît pas le sort : JB2A s'il est là, sinon
 * Token Magic. Le rendu autonome n'anime pas les zones.
 */
function areaBackend() {
  const backend = renderer();
  if ( backend === "jb2a" ) return "jb2a";
  if ( (backend === "tokenmagic") && tokenMagicActive() ) return "tokenmagic";
  if ( backend === "blfx" ) return jb2aActive() ? "jb2a" : (tokenMagicActive() ? "tokenmagic" : null);
  return null;
}

/** Ce qu'une zone montrerait : `{ backend, key, item, … }` (préréglage Token Magic, ou entrée JB2A), ou `{ skipped }`. */
export function areaPlan(region) {
  if ( !region || isFx(region) ) return { skipped: "not an activity area" };
  const activity = fromUuidSync(region.flags?.dnd5e?.activity ?? "", { strict: false });
  const item = activity?.item ?? fromUuidSync(region.flags?.dnd5e?.item ?? "", { strict: false });
  if ( !item ) return { skipped: "not an activity area" };
  const backend = renderer();
  const draw = areaBackend();
  if ( !draw ) return { skipped: `renderer ${backend ?? "none"}` };
  // Un mur de sort est dessiné par runtime/walls.mjs.
  if ( wallTable()[item.system?.identifier] ) return { skipped: "wall drawn by runtime/walls.mjs" };
  if ( (backend === "blfx") && blfxPlays(item) ) return { skipped: "played by BLFX" };
  if ( aaPlays(item, { activity, isTemplate: true }) ) return { skipped: "played by Automated Animations" };
  const activities = [activity, ...(item.system?.activities ?? [])].filter(Boolean);
  const damageTypes = [...new Set(activities.flatMap(a => (a.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])])))];
  const healing = activities.some(a => a.type === "heal");
  const tables = (draw === "jb2a") ? { byIdentifier: JB2A.AREAS_BY_IDENTIFIER, byDamage: JB2A.AREAS_BY_DAMAGE }
    : { byIdentifier: BY_IDENTIFIER, byDamage: BY_DAMAGE };
  const preset = areaPreset({ identifier: item.system?.identifier, damageTypes, healing }, tables);
  if ( !preset ) return { skipped: "no effect for this area" };
  return { ...preset, backend: draw, item: item.name, damageTypes };
}

/* -------------------------------------------- */
/*  JB2A + PSFX                                  */
/* -------------------------------------------- */

/** La première forme d'une région, en données. */
function firstShape(region) {
  const shape = region.shapes?.[0];
  return shape ? (shape.toObject?.() ?? shape) : null;
}

/**
 * L'animation JB2A d'une zone, posée sur sa forme : un cône ou une ligne étirés de l'origine vers le bout (JB2A les dessine pour ça),
 * le reste au centre de la boîte de la région, à sa taille. Persistante (nommée) si la zone dure.
 */
async function playJb2aArea(region, entry, { persist=entry.persist }={}) {
  const shape = firstShape(region);
  const kind = ((shape?.type === "cone") && entry.cone) ? "cone" : ((shape?.type === "line") && entry.line) ? "line" : "circle";
  const file = entry[kind] ?? entry.circle ?? entry.cone ?? entry.line;
  if ( !known(file) ) return { skipped: `unknown animation ${file}` };
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const effect = sequence.effect().file(file);
  if ( kind === "cone" ) {
    const [a, b] = lineEnds({ x: shape.x, y: shape.y, rotation: shape.rotation ?? 0, length: shape.radius });
    effect.atLocation(a).stretchTo(b);
  }
  else if ( kind === "line" ) {
    const [a, b] = lineEnds(shape);
    effect.atLocation(a).stretchTo(b);
  }
  else {
    const box = region.bounds;
    effect.atLocation({ x: box.x + (box.width / 2), y: box.y + (box.height / 2) }).size({ width: box.width, height: box.height });
  }
  if ( entry.tint ) effect.tint(entry.tint);
  if ( entry.below ) effect.belowTokens();
  if ( persist ) effect.persist().name(fxName(region.id)).fadeIn(500).fadeOut(500);
  addSound(sequence, entry.sound);
  await sequence.play();
  return { file, kind, persist: !!persist };
}

/** Arrête l'effet JB2A persistant d'une zone. */
async function stopJb2aArea(regionId) {
  if ( !globalThis.Sequencer?.EffectManager ) return;
  await Sequencer.EffectManager.endEffects({ name: fxName(regionId) }).catch(() => null);
}

/* -------------------------------------------- */
/*  Token Magic FX                               */
/* -------------------------------------------- */

/** Les données de la région compagne. */
function companionData(region, plan) {
  const source = region.toObject();
  const data = { name: `${MODULE_ID} · ${plan.item}`, shapes: source.shapes, color: plan.tint ?? source.color,
    visibility: CONST.REGION_VISIBILITY.ALWAYS, locked: true, behaviors: [],
    flags: {
      [MODULE_ID]: { areaFx: region.id, key: plan.key },
      tokenmagic: { options: { tmfxPreset: plan.preset, ...(plan.tint ? { tmfxTint: plan.tint } : {}), tmfxRegionOpacity: plan.opacity } }
    } };
  for ( const key of ["elevation", "levels", "highlightMode", "restriction"] ) if ( key in source ) data[key] = source[key];
  return data;
}

/* -------------------------------------------- */
/*  Entrées                                      */
/* -------------------------------------------- */

/** Poser l'effet d'une zone. Rend le plan, avec `fx` (id de la compagne Token Magic) ou `jb2a` (l'animation) s'il a été posé. */
export async function drawArea(region) {
  const plan = areaPlan(region);
  if ( plan.skipped ) return plan;
  if ( companions.has(region.id) ) return { ...plan, fx: companions.get(region.id).fx, jb2a: companions.get(region.id).jb2a };
  if ( plan.backend === "jb2a" ) {
    const played = await playJb2aArea(region, plan);
    if ( played.skipped ) return { ...plan, ...played };
    companions.set(region.id, { fx: null, jb2a: played.persist ? fxName(region.id) : null, entry: plan, at: Date.now() });
    log(`${plan.item}: area effect ${played.file} (${plan.key}) by jb2a`);
    return { ...plan, jb2a: played };
  }
  const [fx] = await region.parent.createEmbeddedDocuments("Region", [companionData(region, plan)]);
  if ( !fx ) return { ...plan, skipped: "not created" };
  companions.set(region.id, { fx: fx.id, jb2a: null, entry: plan, at: Date.now() });
  log(`${plan.item}: area effect ${plan.preset} (${plan.key}) by tokenmagic`);
  return { ...plan, fx: fx.id };
}

/**
 * Une zone que DAS · Core vient d'embraser (`flags.dnd5e-combat.area.burning` : huile au sol, toile) : son effet devient celui du
 * feu. Le moteur n'est ni requis ni appelé — on lit seulement ce qu'il écrit sur la région.
 */
async function drawBurning(region) {
  const draw = areaBackend();
  if ( draw === "jb2a" ) {
    await stopJb2aArea(region.id);
    const played = await playJb2aArea(region, JB2A.BURNING, { persist: true });
    if ( !played.skipped ) companions.set(region.id, { fx: null, jb2a: fxName(region.id), entry: JB2A.BURNING, at: Date.now() });
    log(`${region.name}: burning, area effect ${played.file ?? played.skipped}`);
    return;
  }
  if ( (draw !== "tokenmagic") || !BY_DAMAGE.fire ) return;
  const old = companions.get(region.id)?.fx ?? region.parent.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === region.id)?.id;
  companions.delete(region.id);
  if ( old && region.parent.regions.has(old) ) await region.parent.deleteEmbeddedDocuments("Region", [old]).catch(() => {});
  const item = fromUuidSync(region.flags?.dnd5e?.item ?? "", { strict: false });
  const plan = { key: "fire", ...BY_DAMAGE.fire, item: item?.name ?? region.name };
  const [fx] = await region.parent.createEmbeddedDocuments("Region", [companionData(region, plan)]);
  if ( fx ) companions.set(region.id, { fx: fx.id, jb2a: null, entry: plan, at: Date.now() });
  log(`${plan.item}: burning, area effect ${plan.preset}`);
}

/** Retirer l'effet d'une zone (pas avant `MIN_VISIBLE_MS` après son apparition). */
async function removeCompanion(scene, sourceId) {
  const entry = companions.get(sourceId);
  companions.delete(sourceId);
  const fxId = entry?.fx ?? scene.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === sourceId)?.id;
  if ( !fxId && !entry?.jb2a ) return;
  const wait = entry ? Math.max(0, MIN_VISIBLE_MS - (Date.now() - entry.at)) : 0;
  if ( wait ) await new Promise(resolve => setTimeout(resolve, wait));
  if ( entry?.jb2a ) await stopJb2aArea(sourceId);
  if ( fxId && scene.regions.has(fxId) ) await scene.deleteEmbeddedDocuments("Region", [fxId]).catch(() => {});
}

/** Les effets restés sans leur zone (un rechargement pendant un sort) : compagnes et animations JB2A persistantes retirées. */
async function sweep(scene) {
  if ( !scene ) return;
  const orphans = scene.regions.filter(r => isFx(r) && !scene.regions.has(r.flags[MODULE_ID].areaFx)).map(r => r.id);
  if ( orphans.length ) await scene.deleteEmbeddedDocuments("Region", orphans).catch(() => {});
  const prefix = `${MODULE_ID}.area.`;
  let effects = [];
  try { effects = globalThis.Sequencer?.EffectManager?.getEffects?.({ sceneId: scene.id }) ?? []; } catch { effects = []; }
  for ( const effect of effects ) {
    const name = effect?.data?.name ?? "";
    if ( name.startsWith(prefix) && !scene.regions.has(name.slice(prefix.length)) ) await stopJb2aArea(name.slice(prefix.length));
  }
}

export function registerAreas() {
  Hooks.once("ready", () => { loadBlfxMap(); if ( isExecutor() ) sweep(canvas.scene); });
  Hooks.on("canvasReady", () => { if ( isExecutor() ) sweep(canvas.scene); });
  Hooks.on("createRegion", region => {
    if ( !isExecutor() || isFx(region) || !region.flags?.dnd5e?.activity ) return;
    drawArea(region).catch(err => console.error(`${MODULE_ID} | area effect failed`, err));
  });
  Hooks.on("updateRegion", (region, changes) => {
    if ( !isExecutor() || isFx(region) ) return;
    if ( foundry.utils.getProperty(changes, "flags.dnd5e-combat.area.burning") ) {
      drawBurning(region).catch(err => console.error(`${MODULE_ID} | burning area effect failed`, err));
      return;
    }
    const entry = companions.get(region.id);
    if ( entry?.jb2a && ("shapes" in changes) ) {
      // L'animation JB2A suit la zone déplacée (Rayon de lune) : rejouée sur la nouvelle forme.
      stopJb2aArea(region.id).then(() => playJb2aArea(region, entry.entry, { persist: true }))
        .catch(err => console.error(`${MODULE_ID} | area effect failed`, err));
      return;
    }
    const fx = entry?.fx ? region.parent.regions.get(entry.fx) : null;
    if ( !fx || !["shapes", "elevation", "levels"].some(k => k in changes) ) return;
    const source = region.toObject();
    const update = { shapes: source.shapes };
    for ( const key of ["elevation", "levels"] ) if ( key in source ) update[key] = source[key];
    fx.update(update).catch(() => {});
  });
  Hooks.on("deleteRegion", region => {
    if ( !isExecutor() || isFx(region) ) return;
    if ( companions.has(region.id) || region.parent?.regions.some(r => r.flags?.[MODULE_ID]?.areaFx === region.id) ) {
      removeCompanion(region.parent, region.id).catch(() => {});
    }
  });
}

/** Pour les scénarios : le plan d'une zone et son effet. */
export function areaState({ regionId }={}) {
  const region = canvas.scene?.regions.get(regionId);
  if ( !region ) return { error: `region ${regionId} not found` };
  const fx = canvas.scene.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === regionId) ?? null;
  const entry = companions.get(regionId) ?? null;
  let jb2aEffects = null;
  try { jb2aEffects = (globalThis.Sequencer?.EffectManager?.getEffects?.({ name: fxName(regionId) }) ?? []).length; } catch {}
  return {
    plan: areaPlan(region), jb2a: entry?.jb2a ?? null, jb2aEffects,
    fx: fx ? { id: fx.id, preset: fx.flags?.tokenmagic?.options?.tmfxPreset ?? null, filters: (fx.flags?.tokenmagic?.filters ?? []).map(f => f.tmFilters?.tmFilterId) } : null
  };
}
