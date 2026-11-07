/**
 * Les sources d'animation dans le jeu (SPEC §23) : le réglage de monde `sources` (ordre, sources coupées, domaines), ce qui est
 * installé, et la source de chaque domaine. Les choix sont purs (core/sources.mjs). Tant que le MJ n'a pas enregistré la fenêtre, la
 * valeur est tirée des anciens réglages (`renderer`, `strikes`, `conditions`, `aaYieldToBlfx`), gardés cachés pour cette lecture.
 */

import { AA, BLFX, JB2A, MODULE_ID, PSFX, aaActive, blfxActive, jb2aActive } from "./shared.mjs";
import { DOMAINS, migrateSources, normalizeSources, pickSource, ranksBefore, sourceChain, yieldsToBlfx }
  from "../core/sources.mjs";

export const SOURCES_SETTING = "sources";
const TOKENMAGIC = "tokenmagic";
const tokenMagicOn = () => !!(game.modules.get(TOKENMAGIC)?.active && globalThis.TokenMagic);

const read = key => { try { return game.settings.get(MODULE_ID, key); } catch { return undefined; } };

/** Ce qui est là pour jouer, par source. */
export function available() {
  return { blfx: blfxActive(), aa: aaActive(), jb2a: jb2aActive(), tokenmagic: tokenMagicOn(), native: true };
}

/** La valeur en vigueur (complétée), enregistrée ou tirée des anciens réglages. */
export function sourcesValue() {
  const stored = read(SOURCES_SETTING);
  if ( stored && (typeof stored === "object") && Array.isArray(stored.order) ) return normalizeSources(stored);
  return normalizeSources(migrateSources({ renderer: read("renderer"), strikes: read("strikes"), conditions: read("conditions"),
    aaYieldToBlfx: read("aaYieldToBlfx") }));
}

/** Les sources utilisables d'un domaine, dans l'ordre. */
export const chain = domain => sourceChain(domain, sourcesValue(), available());
/** La source que ce module utilise pour un domaine (sans AA), ou null. */
export const pick = domain => pickSource(domain, sourcesValue(), available());
/** Le domaine est-il allumé ? */
export const domainOn = domain => sourcesValue().domains[domain] !== false;
/** `a` avant `b` dans l'ordre réglé ? */
export const before = (a, b) => ranksBefore(sourcesValue(), a, b);
/** Notre source `own` se tait-elle devant BLFX dans ce domaine (pour un objet que BLFX reconnaît) ? */
export const yieldBlfx = (domain, own) => yieldsToBlfx(domain, sourcesValue(), own);

/** Le domaine d'une utilisation vue par Automated Animations. */
export function domainOf(item, { isTemplate=false }={}) {
  if ( isTemplate ) return "areas";
  return (item?.type === "consumable") ? "consumables" : "strikes";
}

/** L'état d'un module pour la fenêtre. */
function moduleState(id) {
  const mod = game.modules.get(id);
  return { id, installed: !!mod, active: !!mod?.active, title: mod?.title ?? id, version: mod?.version ?? null };
}

/** Ce que la fenêtre montre de la détection. */
export function detection() {
  const ids = ["sequencer", BLFX, ...JB2A, PSFX, TOKENMAGIC, AA];
  const modules = Object.fromEntries(ids.map(id => [id, moduleState(id)]));
  let blfxCustomUpdates = true, blfxAutoRec = true;
  try { blfxCustomUpdates = !!game.settings.get(BLFX, "blfxCustomAutoRecUpdates"); } catch {}
  try { blfxAutoRec = game.settings.get(BLFX, "blfxAutoRecognition") !== false; } catch {}
  return { modules, sequencer: !!globalThis.Sequence, blfxCustomUpdates, blfxAutoRec, available: available() };
}

/** Enregistre une valeur (MJ). */
export async function saveSources(value) {
  await game.settings.set(MODULE_ID, SOURCES_SETTING, normalizeSources(value));
}

/** Pour les scénarios : sans argument rend la valeur ; avec `value` (objet ou ancien nom de rendu) l'applique et rend l'ancienne. */
export async function sourcesSetting({ value }={}) {
  const before = sourcesValue();
  if ( value === undefined ) return before;
  const next = (typeof value === "string") ? { ...migrateSources({ renderer: value }), domains: before.domains } : value;
  if ( (typeof value === "string") && (value !== "none") ) {
    for ( const d of ["consumables", "traps", "walls", "areas", "doors", "summons"] ) next.domains[d] = true;
  }
  await saveSources(next);
  return before;
}

export function registerSources(onChange=() => {}) {
  game.settings.register(MODULE_ID, SOURCES_SETTING, {
    scope: "world", config: false, type: Object, default: null, onChange: () => onChange()
  });
}

export { DOMAINS };
