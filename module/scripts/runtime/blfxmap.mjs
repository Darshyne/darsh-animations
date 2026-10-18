/**
 * La table d'Auto-Rec intégrée de BLFX (`ANIMATION_MAP`, scripts/animationMap.js), lue une fois à `ready` sur chaque client : pour
 * savoir si BLFX jouera un objet (zones sans BLFX, Automated Animations qui se tait devant BLFX).
 */
import { BLFX, blfxActive, log } from "./shared.mjs";
import { animations } from "./registry.mjs";
import { blfxKnows } from "../core/areas.mjs";
import { ANIMATION_MAP_PATH } from "../core/blfx.mjs";

let blfxMap = null;

export async function loadBlfxMap() {
  if ( !blfxActive() ) return null;
  try { blfxMap = (await import(foundry.utils.getRoute(ANIMATION_MAP_PATH)))?.ANIMATION_MAP ?? null; }
  catch(err) { log("BLFX animation map unreadable", err); blfxMap = null; }
  return blfxMap;
}

/** BLFX jouera-t-il cet objet (son Auto-Rec allumée, l'objet dans sa table ou dans l'Auto-Rec personnalisée) ? */
export function blfxPlays(item) {
  if ( !blfxActive() || (item?.documentName !== "Item") ) return false;
  let auto = true;
  try { auto = game.settings.get(BLFX, "blfxAutoRecognition") !== false; } catch { auto = true; }
  const identifier = item.system?.identifier ?? null;
  if ( !auto && !identifier?.startsWith("blfx-") ) return false;
  return blfxKnows(blfxMap, { type: item.type, name: item.name, identifier, baseItem: item.system?.type?.baseItem ?? null },
    { custom: Object.keys(animations()) });
}
