/**
 * Automated Animations (AA, `autoanimations`) dans toutes les langues, et sans doublon avec BLFX ni avec ce que ce module joue
 * lui-même (SPEC §17). Rien n'est écrit : ni dans les réglages d'AA, ni sur les objets.
 *
 * - **Noms** (réglage `aaNames`) : au hook `aa.getRequiredData` (dist/autoanimations.js:108874, appelé sur l'objet vivant avant la
 *   recherche), si AA ne trouve rien avec ses propres noms, on retrouve son entrée par les clés anglaises de l'objet (nom d'origine
 *   de Babele, table de la langue `module/names/<langue>.json`, identifiant dnd5e, arme de base — core/aa.mjs) et on met son
 *   libellé exact en tête de `overrideNames`. Remplace le module « Automated Animation for Babele ».
 * - **Ordre des sources** (fenêtre « Sources d'animation », SPEC §23 ; l'ancien réglage `aaYieldToBlfx` n'en donne que la valeur de
 *   départ) : au hook `AutomatedAnimations-WorkflowStart` (15848), AA s'arrête (`stopWorkflow`, lu en 15850) devant ce qui passe avant lui. Ne couvre pas l'animation de critique d'AA, jouée plus tôt (108966).
 * - **`aaPlays`** : les consommables, zones et murs que ce module joue lui-même se taisent quand AA les joue (même calcul, mêmes
 *   réglages du monde, chez le MJ).
 */

import { AA, MODULE_ID, aaActive, blfxActive, log } from "./shared.mjs";
import { blfxPlays } from "./blfxmap.mjs";
import { MENUS, englishKeys, normalize, resolveLabel, aaWhich } from "../core/aa.mjs";
import { renderer } from "./renderer.mjs";
import { before, chain, domainOf, pick } from "./sources.mjs";
import { strikesWouldPlay } from "./strikes.mjs";

/** Marque posée sur les données d'un appel à AA fait par ce module pour un châtiment (lue à `AutomatedAnimations-WorkflowStart`). */
export const SMITE_MARK = "darshAnimationsSmite";

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

/**
 * Toutes les clés anglaises d'un objet, son propre nom compris (normalisées) : pour le rendu des attaques (runtime/strikes.mjs), qui
 * cherche par identifiant, nom d'origine Babele, table de la langue, puis nom.
 */
export function englishKeysOf(item, activity=null) {
  return [...new Set([...keysOf(item, activity), normalize(item?.system?.identifier), normalize(item?.name)].filter(Boolean))];
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

/**
 * DAS · Animations (ou BLFX) jouera-t-il cette utilisation ? Alors une entrée **livrée** d'AA se tait (SPEC §21.5 D1–D2) : zones et
 * consommables par le rendu en vigueur (runtime/renderer.mjs), attaques, sorts et aptitudes par runtime/strikes.mjs.
 */
function dasPlays(item, activity, isTemplate) {
  if ( blfxPlays(item) ) return true;
  if ( isTemplate ) return pick("areas") !== null;
  if ( item.type === "consumable" ) return renderer() !== null;
  return strikesWouldPlay(item, activity);
}

/**
 * `AutomatedAnimations-WorkflowStart` : AA ne joue que ses animations **personnalisées** (lot 5). Une entrée livrée se tait dès que
 * DAS · Animations ou BLFX joue l'objet. Une animation personnalisée suit sa place dans l'ordre de la fenêtre « Sources d'animation »
 * (SPEC §23) : elle se tait devant BLFX placé avant elle (pour un objet que BLFX reconnaît), devant une source de ce module placée avant
 * elle (qui a quelque chose pour l'objet), et toujours quand AA est coupé dans la fenêtre.
 */
function onWorkflowStart(data, animation) {
  // Un châtiment que ce module confie lui-même à AA (runtime/smites.mjs) : AA joue.
  if ( data?.[SMITE_MARK] || !animation ) return;
  const item = data?.item;
  if ( item?.documentName !== "Item" ) return;
  const activity = data.activity ?? null;
  const isTemplate = !!data.isTemplate;
  const kind = aaKind(item, { activity, isTemplate });
  if ( kind === "custom" ) {
    if ( aaPlays(item, { activity, isTemplate }) ) return;
    const off = !chain(domainOf(item, { isTemplate })).includes("aa");
    const other = blfxPlays(item) ? "BLFX" : (dasPlays(item, activity, isTemplate) ? "DAS · Animations" : null);
    if ( !off && !other ) return;
    data.stopWorkflow = true;
    log(`Automated Animations: ${item.name} (custom) ${off ? "turned off in the sources window" : `left to ${other}`}`);
    return;
  }
  if ( !dasPlays(item, activity, isTemplate) ) return;
  data.stopWorkflow = true;
  log(`Automated Animations: ${item.name} (default entry) left to ${blfxPlays(item) ? "BLFX" : "DAS · Animations"}`);
}

/** Ce qu'AA jouera : "custom", "default" ou null (core/aa.mjs, `aaWhich`). */
export function aaKind(item, { activity=null, isTemplate=false }={}) {
  if ( !aaActive() || (item?.documentName !== "Item") ) return null;
  let autorecDisabled = false;
  try { autorecDisabled = !!game.settings.get(AA, "disableAutoRec"); } catch {}
  return aaWhich({
    itemFlags: item.flags?.autoanimations ?? null, activityFlags: activity?.flags?.autoanimations ?? null, autorecDisabled,
    settings: autorec(), keys: keysOf(item, activity), nativeNames: nativeNamesOf(item, activity), itemName: item.name, isTemplate,
    translate: !!setting("aaNames")
  });
}

/**
 * AA jouera-t-il cette utilisation **avec une animation personnalisée** ? Alors ce module se tait (attaques, sorts, consommables,
 * zones, murs, châtiments). Une entrée livrée d'AA ne compte pas : c'est elle qui se tait (lot 5). Selon l'ordre de la fenêtre
 * « Sources d'animation » (SPEC §23) : faux quand AA y est coupé, quand BLFX est placé avant AA et reconnaît l'objet, ou quand la source
 * de ce module pour ce domaine (sauf BLFX, compté par son Auto-Rec) est placée avant AA.
 * @param {Item} item
 * @param {{ activity?: object, isTemplate?: boolean, ignoreBlfx?: boolean, domain?: string }} [options]   `ignoreBlfx` : ne pas se
 *   taire devant BLFX (les châtiments, que BLFX ne joue pas quand il n'a pas d'animation de dégâts pour eux) ; `domain` : celui de la
 *   fenêtre (déduit de l'objet sinon)
 */
export function aaPlays(item, { activity=null, isTemplate=false, ignoreBlfx=false, domain=null }={}) {
  if ( !aaActive() || (item?.documentName !== "Item") ) return false;
  const d = domain ?? domainOf(item, { isTemplate });
  if ( !chain(d).includes("aa") ) return false;
  if ( !ignoreBlfx && blfxActive() && before("blfx", "aa") && blfxPlays(item) ) return false;
  if ( aaKind(item, { activity, isTemplate }) !== "custom" ) return false;
  const own = pick(d);
  return !(own && (own !== "blfx") && before(own, "aa"));
}

/**
 * Les noms à donner à AA quand ce module l'appelle lui-même (`AutomatedAnimations.playAnimation`, dist/autoanimations.js:18736) :
 * cette fonction publique ne passe pas par `aa.getRequiredData`, mais sa recherche lit `overrideNames` (15661). Le libellé anglais
 * trouvé par nos clés en tête (réglage `aaNames`), puis le nom de l'activité comme AA le met de lui-même.
 */
export function aaOverrideNames(item, activity=null) {
  const out = [];
  if ( setting("aaNames") ) {
    const nativeNames = nativeNamesOf(item, activity);
    const found = resolveLabel(autorec(), { keys: keysOf(item, activity), nativeNames, itemName: item?.name ?? "" });
    if ( found ) out.push(found.label);
  }
  if ( activity?.name && !["heal", "summon"].includes(activity.name.trim()) ) out.push(activity.name);
  return out;
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
    kind: aaKind(doc, { activity: act, isTemplate }), plays: aaPlays(doc, { activity: act, isTemplate }), blfx: blfxPlays(doc),
    names: Object.keys(names).length
  };
}

export function registerAA() {
  game.settings.register(MODULE_ID, "aaNames", {
    name: "DARSHANIM.Settings.AaNames.Name", hint: "DARSHANIM.Settings.AaNames.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "aaYieldToBlfx", {
    name: "DARSHANIM.Settings.AaYield.Name", hint: "DARSHANIM.Settings.AaYield.Hint",
    scope: "world", config: false, type: Boolean, default: true
  });
  Hooks.on("aa.getRequiredData", data => {
    try { onRequiredData(data); } catch(err) { console.error(`${MODULE_ID} | Automated Animations names`, err); }
  });
  Hooks.on("AutomatedAnimations-WorkflowStart", (data, animation) => {
    try { onWorkflowStart(data, animation); } catch(err) { console.error(`${MODULE_ID} | Automated Animations and BLFX`, err); }
  });
  Hooks.once("ready", () => loadNames());
}
