/**
 * Automated Animations (AA, `autoanimations`) dans toutes les langues, et sans doublon avec BLFX ni avec ce que ce module joue
 * lui-même (SPEC §17). Rien n'est écrit : ni dans les réglages d'AA, ni sur les objets.
 *
 * - **Noms** (réglage `aaNames`) : au hook `aa.getRequiredData` (dist/autoanimations.js:108874, appelé sur l'objet vivant avant la
 *   recherche), si AA ne trouve rien avec ses propres noms, on retrouve son entrée par les clés anglaises de l'objet (nom d'origine
 *   de Babele, table de la langue `module/names/<langue>.json`, identifiant dnd5e, arme de base — core/aa.mjs) et on met son
 *   libellé exact en tête de `overrideNames`. Remplace le module « Automated Animation for Babele ».
 * - **BLFX d'abord** (réglage `aaYieldToBlfx`) : au hook `AutomatedAnimations-WorkflowStart` (15848), si BLFX joue déjà cet objet, AA
 *   s'arrête (`stopWorkflow`, lu en 15850). Ne couvre pas l'animation de critique d'AA, jouée plus tôt (108966).
 * - **`aaPlays`** : les consommables, zones et murs que ce module joue lui-même se taisent quand AA les joue (même calcul, mêmes
 *   réglages du monde, chez le MJ).
 */

import { AA, MODULE_ID, aaActive, blfxActive, log } from "./shared.mjs";
import { blfxPlays } from "./blfxmap.mjs";
import { MENUS, englishKeys, normalize, resolveLabel, aaWillPlay } from "../core/aa.mjs";

export const BABELE_COMPANION = "automated-animation-for-babele";

/** Nom normalisé dans la langue du monde → nom anglais (module/names/<langue>.json, plus ce que d'autres modules ajoutent). */
const names = {};
const added = [];

/** Charge la table de la langue du client (s'il y en a une), puis les ajouts. */
async function loadNames() {
  const lang = game.i18n.lang;
  if ( lang && (lang !== "en") ) {
    try {
      const response = await fetch(foundry.utils.getRoute(`modules/${MODULE_ID}/names/${lang}.json`));
      if ( response.ok ) Object.assign(names, (await response.json())?.names ?? {});
    } catch { /* pas de table pour cette langue */ }
  }
  for ( const map of added ) Object.assign(names, map);
}

/**
 * Ajoute des noms (nom dans la langue du monde → nom anglais), pour une langue sans table ou des objets maison :
 * `api.aa.addNames({ "Flèche de givre": "Ice Knife" })`.
 */
export function addNames(map={}) {
  const normalized = Object.fromEntries(Object.entries(map).map(([local, english]) => [normalize(local), String(english)]));
  added.push(normalized);
  Object.assign(names, normalized);
  return Object.keys(normalized).length;
}

/** Les menus de l'Auto-Rec d'AA (réglages du monde). */
function autorec() {
  const out = {};
  for ( const menu of MENUS ) {
    try { out[menu] = game.settings.get(AA, `aaAutorec-${menu}`) ?? []; } catch { out[menu] = []; }
  }
  return out;
}

const setting = key => { try { return game.settings.get(MODULE_ID, key); } catch { return true; } };

/** Les clés anglaises d'un objet et de son activité. */
function keysOf(item, activity=null) {
  return englishKeys({
    name: item?.name, activityName: activity?.name, babeleName: item?.flags?.babele?.originalName,
    identifier: item?.system?.identifier, baseItem: item?.system?.type?.baseItem
  }, names);
}

/** Les noms qu'AA essaie de lui-même : l'activité (sauf « heal » / « summon », 108967), puis l'objet. */
function nativeNamesOf(item, activity=null) {
  const out = [];
  if ( activity?.name && !["heal", "summon"].includes(activity.name.trim()) ) out.push(activity.name);
  if ( item?.name ) out.push(item.name);
  return out;
}

/** `aa.getRequiredData` : donne à AA le libellé anglais de l'objet, en tête. */
function onRequiredData(data) {
  if ( !setting("aaNames") || data?.activeEffect ) return;
  const item = data?.item;
  if ( !item?.name || (item.documentName !== "Item") ) return;
  const nativeNames = [...(data.overrideNames ?? []), item.name, ...(data.extraNames ?? [])];
  const found = resolveLabel(autorec(), { keys: keysOf(item, data.activity), nativeNames, itemName: item.name,
    isTemplate: !!data.isTemplate });
  if ( !found ) return;
  data.overrideNames ??= [];
  data.overrideNames.unshift(found.label);
  log(`Automated Animations: ${item.name} → "${found.label}" (${found.menu}, by ${found.key})`);
}

/** `AutomatedAnimations-WorkflowStart` : AA se tait devant BLFX. */
function onWorkflowStart(data, animation) {
  if ( !animation || !setting("aaYieldToBlfx") || !blfxActive() ) return;
  const item = data?.item;
  if ( item?.documentName !== "Item" || !blfxPlays(item) ) return;
  data.stopWorkflow = true;
  log(`Automated Animations: ${item.name} left to BLFX`);
}

/**
 * AA jouera-t-il cette utilisation ? Pour que ce module se taise (consommables, zones, murs). Faux si AA n'est pas là, ou s'il se
 * tait devant BLFX pour cet objet.
 * @param {Item} item
 * @param {{ activity?: object, isTemplate?: boolean }} [options]
 */
export function aaPlays(item, { activity=null, isTemplate=false }={}) {
  if ( !aaActive() || (item?.documentName !== "Item") ) return false;
  if ( setting("aaYieldToBlfx") && blfxActive() && blfxPlays(item) ) return false;
  let autorecDisabled = false;
  try { autorecDisabled = !!game.settings.get(AA, "disableAutoRec"); } catch {}
  return aaWillPlay({
    itemFlags: item.flags?.autoanimations ?? null, activityFlags: activity?.flags?.autoanimations ?? null, autorecDisabled,
    settings: autorec(), keys: keysOf(item, activity), nativeNames: nativeNamesOf(item, activity), itemName: item.name, isTemplate,
    translate: !!setting("aaNames")
  });
}

/**
 * Pour vérifier (MJ, connecteur MCP) : ce qu'AA trouvera pour un objet. `item` : uuid ; `activity` : id d'activité (facultatif).
 * Rend les clés anglaises, ce qu'AA trouve seul, notre libellé, et si ce module se taira.
 */
export async function aaResolve({ item, activity=null, isTemplate=false }={}) {
  const doc = await fromUuid(item);
  if ( !doc ) return { error: `item not found: ${item}` };
  const act = activity ? doc.system?.activities?.get(activity) : null;
  const settings = autorec();
  const nativeNames = nativeNamesOf(doc, act);
  return {
    active: aaActive(), name: doc.name, keys: keysOf(doc, act), nativeNames,
    label: resolveLabel(settings, { keys: keysOf(doc, act), nativeNames, itemName: doc.name, isTemplate }),
    plays: aaPlays(doc, { activity: act, isTemplate }), blfx: blfxPlays(doc), names: Object.keys(names).length
  };
}

export function registerAA() {
  game.settings.register(MODULE_ID, "aaNames", {
    name: "DARSHANIM.Settings.AaNames.Name", hint: "DARSHANIM.Settings.AaNames.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "aaYieldToBlfx", {
    name: "DARSHANIM.Settings.AaYield.Name", hint: "DARSHANIM.Settings.AaYield.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  Hooks.on("aa.getRequiredData", data => {
    try { onRequiredData(data); } catch(err) { console.error(`${MODULE_ID} | Automated Animations names`, err); }
  });
  Hooks.on("AutomatedAnimations-WorkflowStart", (data, animation) => {
    try { onWorkflowStart(data, animation); } catch(err) { console.error(`${MODULE_ID} | Automated Animations and BLFX`, err); }
  });
  Hooks.once("ready", () => {
    loadNames();
    if ( game.user.isGM && game.modules.get(BABELE_COMPANION)?.active && game.modules.get(AA)?.active && setting("aaNames") ) {
      ui.notifications.info("DARSHANIM.AA.BabeleCompanion", { localize: true });
    }
  });
}
