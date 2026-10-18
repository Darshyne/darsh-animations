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

/** Les préfixes des noms Sequencer de chaque rendu : BLFX (`blfx.*`), ou JB2A gratuit et PSFX (data/jb2a.mjs). */
const LIBRARIES = Object.freeze({
  blfx: { animation: ["blfx."], sound: ["blfx.sound."], label: "BLFX" },
  jb2a: { animation: ["jb2a."], sound: ["psfx."], label: "JB2A / PSFX" }
});

/** Les erreurs de forme d'une partie (vide si elle est bonne). `library` : "blfx" (data/traps.mjs) ou "jb2a" (data/jb2a.mjs). */
export function checkTrapPart(part, label, library="blfx") {
  const lib = LIBRARIES[library] ?? LIBRARIES.blfx;
  const errors = [];
  if ( !TRAP_PLACES.includes(part?.at) ) errors.push(`${label}: "at" must be ${TRAP_PLACES.join(" or ")}`);
  if ( (typeof part?.animation !== "string") || !lib.animation.some(p => part.animation.startsWith(p)) ) {
    errors.push(`${label}: ${lib.label} animation expected`);
  }
  if ( (part?.sound !== undefined) && !lib.sound.some(p => String(part.sound).startsWith(p)) ) errors.push(`${label}: ${lib.label} sound expected`);
  if ( (part?.tint !== undefined) && !/^#[0-9a-f]{6}$/i.test(String(part.tint)) ) errors.push(`${label}: invalid tint`);
  for ( const key of ["scale", "delay", "duration"] ) {
    if ( (part?.[key] !== undefined) && !(Number.isFinite(part[key]) && (part[key] >= 0)) ) errors.push(`${label}: invalid ${key}`);
  }
  return errors;
}
