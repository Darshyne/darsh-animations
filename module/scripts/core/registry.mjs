/**
 * Les tables d'animations d'autres modules (créatures d'une campagne, options d'un supplément), en fonctions pures : leur
 * validation et leur fusion avec la table livrée (data/animations.mjs). Le registre vivant est dans runtime/registry.mjs.
 *
 * Une table enregistrée a la forme de la table livrée :
 *   { animations: { identifiant: [animation…] }, without?: { identifiant: raison }, sources?: [id de compendium…] }
 *
 * Aucune référence à `game`, `canvas`, `Hooks`, `CONFIG`, `foundry` ici.
 */

import { TEMPLATES, TRIGGERS } from "./blfx.mjs";

/** Les types d'activité dnd5e 6 qu'une animation peut viser. */
export const ACTIVITY_TYPES = Object.freeze(["attack", "cast", "check", "damage", "enchant", "forward", "heal", "save", "summon",
  "transform", "utility"]);

/** Les erreurs de forme d'une animation (sans le catalogue BLFX, que seuls les tests du dépôt lisent). */
export function checkAnimation(a, at="") {
  const errors = [];
  if ( !a || (typeof a !== "object") ) return [`${at} : objet attendu`];
  if ( !(a.trigger in TRIGGERS) ) errors.push(`${at}.trigger : ${Object.keys(TRIGGERS).join(", ")}`);
  if ( a.activity && !ACTIVITY_TYPES.includes(a.activity) ) errors.push(`${at}.activity : ${ACTIVITY_TYPES.join(", ")}`);
  if ( !!a.alias === !!a.template ) errors.push(`${at} : alias OU template`);
  if ( a.alias && !/^[a-z]+\.[\w-]+$/.test(a.alias) ) errors.push(`${at}.alias : « type.clé »`);
  if ( a.template && !(a.template in TEMPLATES) ) errors.push(`${at}.template : ${Object.keys(TEMPLATES).join(", ")}`);
  if ( a.params && ((typeof a.params !== "object") || Object.keys(a.params).some(k => !/^[A-Z_]+\d$/.test(k))) ) {
    errors.push(`${at}.params : constantes du modèle (ANIMATION1, SOUND3…)`);
  }
  return errors;
}

/**
 * Valide une table enregistrée. Les animations fausses sont écartées, le reste est gardé.
 * @returns {{ table: {animations: object, without: object, sources: string[]}, errors: string[] }}
 */
export function checkRegistration(data) {
  const errors = [];
  const table = { animations: {}, without: {}, sources: [] };
  if ( !data || (typeof data !== "object") ) return { table, errors: ["{ animations, without?, sources? } attendu"] };
  for ( const [id, list] of Object.entries(data.animations ?? {}) ) {
    if ( !Array.isArray(list) ) { errors.push(`${id} : liste d'animations attendue`); continue; }
    const bad = list.flatMap((a, i) => checkAnimation(a, `${id}[${i}]`));
    if ( bad.length ) errors.push(...bad);
    else table.animations[id] = list;
  }
  for ( const [id, why] of Object.entries(data.without ?? {}) ) {
    if ( typeof why === "string" ) table.without[id] = why;
    else errors.push(`without.${id} : une raison (texte)`);
  }
  for ( const id of data.sources ?? [] ) {
    if ( (typeof id === "string") && /^[\w-]+\.[\w-]+$/.test(id) ) table.sources.push(id);
    else errors.push(`sources : « module.pack » attendu (${id})`);
  }
  return { table, errors };
}

/**
 * La table livrée et les tables enregistrées, fusionnées dans l'ordre d'enregistrement : une table enregistrée remplace
 * l'entrée livrée de même identifiant.
 * @param {{animations: object, without: object, sources: string[]}} base
 * @param {Iterable<{animations: object, without: object, sources: string[]}>} tables
 */
export function combine(base, tables) {
  const out = { animations: { ...base.animations }, without: { ...base.without }, sources: [...base.sources] };
  for ( const t of tables ) {
    Object.assign(out.animations, t.animations);
    Object.assign(out.without, t.without);
    for ( const id of t.sources ) if ( !out.sources.includes(id) ) out.sources.push(id);
  }
  return out;
}
