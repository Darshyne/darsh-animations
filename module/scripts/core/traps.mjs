/**
 * Choisir les animations d'un piège (data/traps.mjs) : pur, testable hors du jeu.
 */

export const TRAP_PLACES = Object.freeze(["area", "targets"]);

/** Les clés possibles d'un acteur piège : son id, puis l'id de sa source de compendium (`Compendium.….Actor.<id>`). */
export function trapKeys({ id=null, sourceId=null }={}) {
  const keys = [];
  if ( id ) keys.push(id);
  const fromSource = String(sourceId ?? "").match(/\.Actor\.([^.]+)$/)?.[1];
  if ( fromSource && !keys.includes(fromSource) ) keys.push(fromSource);
  return keys;
}

/**
 * Les parties à jouer : l'entrée de l'acteur (par id ou source), sinon celle du premier type de dégâts connu, sinon rien.
 * @param {{ id?: string, sourceId?: string, damageTypes?: string[] }} trap
 * @param {object} table       data/traps.mjs TRAPS
 * @param {object} byDamage    data/traps.mjs BY_DAMAGE
 */
export function trapParts(trap, table, byDamage) {
  for ( const key of trapKeys(trap) ) if ( table[key] ) return table[key];
  for ( const type of trap.damageTypes ?? [] ) if ( byDamage[type] ) return byDamage[type];
  return [];
}

/** Les erreurs de forme d'une partie (vide si elle est bonne). */
export function checkTrapPart(part, label) {
  const errors = [];
  if ( !TRAP_PLACES.includes(part?.at) ) errors.push(`${label}: "at" must be ${TRAP_PLACES.join(" or ")}`);
  if ( typeof part?.animation !== "string" || !part.animation.startsWith("blfx.") ) errors.push(`${label}: BLFX animation expected`);
  if ( (part?.sound !== undefined) && !String(part.sound).startsWith("blfx.sound.") ) errors.push(`${label}: BLFX sound expected`);
  for ( const key of ["scale", "delay", "duration"] ) {
    if ( (part?.[key] !== undefined) && !(Number.isFinite(part[key]) && (part[key] >= 0)) ) errors.push(`${label}: invalid ${key}`);
  }
  return errors;
}
