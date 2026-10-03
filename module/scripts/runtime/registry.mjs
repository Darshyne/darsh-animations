/**
 * Les animations d'autres modules — API publique, deux chemins équivalents :
 *
 *   Hooks.once("darsh-animations.register", register => register("mon-module", { animations, without, sources }));
 *   game.modules.get("darsh-animations")?.api?.register("mon-module", { animations, without, sources });
 *
 * `animations` : `{ identifiant dnd5e: [animation…] }`, la forme de data/animations.mjs ; `without` (facultatif) : les
 * capacités volontairement sans animation ; `sources` (facultatif) : des compendiums `module.pack` où chercher les items qui
 * portent ces identifiants. Le hook est appelé une fois, à `setup` (s'y inscrire depuis son propre `init`), donc avant la
 * synchronisation de `ready` ; un appel direct plus tard demande `api.sync()` pour être versé. Chaque animation est vérifiée
 * (core/registry.mjs) : une animation fausse est écartée et dite dans la console. Réenregistrer la même source la remplace.
 */

import { combine, checkRegistration } from "../core/registry.mjs";
import { ANIMATIONS, SOURCES, WITHOUT } from "../data/animations.mjs";
import { MODULE_ID, log } from "./shared.mjs";

export const REGISTER_HOOK = `${MODULE_ID}.register`;

/** source (id du module) → table validée, dans l'ordre d'enregistrement. */
const REGISTERED = new Map();
let current = combine({ animations: ANIMATIONS, without: WITHOUT, sources: SOURCES }, []);

/**
 * @param {string} source
 * @param {{animations: object, without?: object, sources?: string[]}} data
 * @returns {{source: string, animations: string[], errors: string[]}}
 */
export function register(source, data) {
  if ( (typeof source !== "string") || !source ) throw new Error(`${MODULE_ID} | register : l'id du module source est requis`);
  const { table, errors } = checkRegistration(data);
  REGISTERED.set(source, table);
  current = combine({ animations: ANIMATIONS, without: WITHOUT, sources: SOURCES }, REGISTERED.values());
  if ( errors.length ) console.error(`${MODULE_ID} | animations de ${source} : écartées`, errors);
  log(`${Object.keys(table.animations).length} animation(s) enregistrée(s) par ${source}`);
  return { source, animations: Object.keys(table.animations), errors };
}

/** À `setup` : les autres modules donnent leurs animations par le hook. */
export function collectRegistrations() {
  Hooks.callAll(REGISTER_HOOK, register);
}

/** La table en vigueur : livrée + enregistrée. */
export const animations = () => current.animations;
export const without = () => current.without;
export const sources = () => current.sources;
/** `{ source: [identifiants] }`. */
export const registered = () => Object.fromEntries(Array.from(REGISTERED, ([s, t]) => [s, Object.keys(t.animations)]));
