/**
 * Les effets de zone en Token Magic FX (SPEC §15, demande de l'utilisateur du 2026-10-13) : quand BLFX n'est pas là, ou qu'il ne
 * reconnaît pas le sort, une zone posée par une activité dnd5e (région qui porte `flags.dnd5e.activity` : Mains brûlantes, Boule de
 * feu, Rayon de lune…) reçoit un effet Token Magic choisi par le type de dégâts (data/areas.mjs).
 *
 * L'effet vit dans une **région compagne** créée par le MJ actif : mêmes formes, aucun comportement, visible de tous, verrouillée,
 * marquée `flags["darsh-animations"].areaFx = <id de la zone>`, avec les options Token Magic (`tmfxPreset`, `tmfxTint`,
 * `tmfxRegionOpacity`) que Token Magic lit à sa création (module/placeables/region.js, `preCreateRegion`). La zone du moteur et de
 * dnd5e n'est jamais modifiée. La compagne suit les formes de la zone (un Rayon de lune déplacé), et disparaît avec elle — pas avant
 * `MIN_VISIBLE_MS` après son apparition : une zone instantanée est retirée vite par le moteur.
 */
import { MODULE_ID, BLFX, blfxActive, log } from "./shared.mjs";
import { renderer, tokenMagicActive } from "./renderer.mjs";
import { animations } from "./registry.mjs";
import { areaPreset, blfxKnows } from "../core/areas.mjs";
import { ANIMATION_MAP_PATH } from "../core/blfx.mjs";
import { BY_DAMAGE, BY_IDENTIFIER, MIN_VISIBLE_MS } from "../data/areas.mjs";
import { WALLS } from "../data/walls.mjs";

const isExecutor = () => game.users.activeGM?.isSelf === true;
const isFx = region => !!region?.flags?.[MODULE_ID]?.areaFx;

/** Zone → `{ fx: id de la compagne, at: horodatage }`. */
const companions = new Map();
/** La table d'Auto-Rec de BLFX, lue une fois. */
let blfxMap = null;

async function loadBlfxMap() {
  if ( !blfxActive() ) return null;
  try { blfxMap = (await import(foundry.utils.getRoute(ANIMATION_MAP_PATH)))?.ANIMATION_MAP ?? null; }
  catch(err) { log("BLFX animation map unreadable", err); blfxMap = null; }
  return blfxMap;
}

/** BLFX jouera-t-il cet item (son Auto-Rec allumée, l'item dans sa table ou dans l'Auto-Rec personnalisée) ? */
function blfxPlays(item) {
  if ( !blfxActive() ) return false;
  let auto = true;
  try { auto = game.settings.get(BLFX, "blfxAutoRecognition") !== false; } catch { auto = true; }
  const identifier = item.system?.identifier ?? null;
  if ( !auto && !identifier?.startsWith("blfx-") ) return false;
  return blfxKnows(blfxMap, { type: item.type, name: item.name, identifier, baseItem: item.system?.type?.baseItem ?? null },
    { custom: Object.keys(animations()) });
}

/** Ce qu'une zone montrerait : `{ preset, tint, opacity, key, item }`, ou `{ skipped }`. */
export function areaPlan(region) {
  if ( !region || isFx(region) ) return { skipped: "not an activity area" };
  const activity = fromUuidSync(region.flags?.dnd5e?.activity ?? "", { strict: false });
  const item = activity?.item ?? fromUuidSync(region.flags?.dnd5e?.item ?? "", { strict: false });
  if ( !item ) return { skipped: "not an activity area" };
  const backend = renderer();
  if ( !backend || (backend === "native") || !tokenMagicActive() ) return { skipped: `renderer ${backend ?? "none"}` };
  // Un mur de sort est dessiné par runtime/walls.mjs quand BLFX est là.
  if ( WALLS[item.system?.identifier] && blfxActive() ) return { skipped: "wall drawn by BLFX" };
  if ( (backend === "blfx") && blfxPlays(item) ) return { skipped: "played by BLFX" };
  const activities = [activity, ...(item.system?.activities ?? [])].filter(Boolean);
  const damageTypes = [...new Set(activities.flatMap(a => (a.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])])))];
  const healing = activities.some(a => a.type === "heal");
  const preset = areaPreset({ identifier: item.system?.identifier, damageTypes, healing }, { byIdentifier: BY_IDENTIFIER, byDamage: BY_DAMAGE });
  if ( !preset ) return { skipped: "no effect for this area" };
  return { ...preset, item: item.name, damageTypes };
}

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

/** Poser l'effet d'une zone. Rend le plan, avec `fx` (id de la compagne) s'il a été posé. */
export async function drawArea(region) {
  const plan = areaPlan(region);
  if ( plan.skipped ) return plan;
  if ( companions.has(region.id) ) return { ...plan, fx: companions.get(region.id).fx };
  const [fx] = await region.parent.createEmbeddedDocuments("Region", [companionData(region, plan)]);
  if ( !fx ) return { ...plan, skipped: "not created" };
  companions.set(region.id, { fx: fx.id, at: Date.now() });
  log(`${plan.item}: area effect ${plan.preset} (${plan.key}) by tokenmagic`);
  return { ...plan, fx: fx.id };
}

/**
 * Une zone que DAS · Core vient d'embraser (`flags.dnd5e-combat.area.burning` : huile au sol, toile) : sa compagne devient l'effet de
 * feu. Le moteur n'est ni requis ni appelé — on lit seulement ce qu'il écrit sur la région.
 */
async function drawBurning(region) {
  const backend = renderer();
  if ( !backend || (backend === "native") || !tokenMagicActive() || !BY_DAMAGE.fire ) return;
  const old = companions.get(region.id)?.fx ?? region.parent.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === region.id)?.id;
  companions.delete(region.id);
  if ( old && region.parent.regions.has(old) ) await region.parent.deleteEmbeddedDocuments("Region", [old]).catch(() => {});
  const item = fromUuidSync(region.flags?.dnd5e?.item ?? "", { strict: false });
  const plan = { key: "fire", ...BY_DAMAGE.fire, item: item?.name ?? region.name };
  const [fx] = await region.parent.createEmbeddedDocuments("Region", [companionData(region, plan)]);
  if ( fx ) companions.set(region.id, { fx: fx.id, at: Date.now() });
  log(`${plan.item}: burning, area effect ${plan.preset}`);
}

/** Retirer la compagne d'une zone (pas avant `MIN_VISIBLE_MS` après son apparition). */
async function removeCompanion(scene, sourceId) {
  const entry = companions.get(sourceId);
  companions.delete(sourceId);
  const fxId = entry?.fx ?? scene.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === sourceId)?.id;
  if ( !fxId ) return;
  const wait = entry ? Math.max(0, MIN_VISIBLE_MS - (Date.now() - entry.at)) : 0;
  if ( wait ) await new Promise(resolve => setTimeout(resolve, wait));
  if ( scene.regions.has(fxId) ) await scene.deleteEmbeddedDocuments("Region", [fxId]).catch(() => {});
}

/** Les compagnes restées sans leur zone (un rechargement pendant un sort) : retirées. */
async function sweep(scene) {
  if ( !scene ) return;
  const orphans = scene.regions.filter(r => isFx(r) && !scene.regions.has(r.flags[MODULE_ID].areaFx)).map(r => r.id);
  if ( orphans.length ) await scene.deleteEmbeddedDocuments("Region", orphans).catch(() => {});
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
    const fx = entry ? region.parent.regions.get(entry.fx) : null;
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

/** Pour les scénarios : le plan d'une zone et sa compagne. */
export function areaState({ regionId }={}) {
  const region = canvas.scene?.regions.get(regionId);
  if ( !region ) return { error: `region ${regionId} not found` };
  const fx = canvas.scene.regions.find(r => r.flags?.[MODULE_ID]?.areaFx === regionId) ?? null;
  return {
    plan: areaPlan(region),
    fx: fx ? { id: fx.id, preset: fx.flags?.tokenmagic?.options?.tmfxPreset ?? null, filters: (fx.flags?.tokenmagic?.filters ?? []).map(f => f.tmFilters?.tmFilterId) } : null
  };
}
