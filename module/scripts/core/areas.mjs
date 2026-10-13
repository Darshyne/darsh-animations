/**
 * Les effets de zone (SPEC §15) — ce qui se décide sans Foundry : quel préréglage pour une zone, et BLFX la jouera-t-il ?
 */
import { slugify } from "./blfx.mjs";

/**
 * Le préréglage Token Magic d'une zone : par identifiant du sort d'abord, puis par le premier type de dégâts qui en a un, puis le
 * soin. Rend `{ key, preset, tint, opacity }` ou null.
 * @param {{ identifier?: string, damageTypes?: string[], healing?: boolean }} what
 * @param {{ byIdentifier: object, byDamage: object }} tables
 */
export function areaPreset({ identifier=null, damageTypes=[], healing=false }={}, { byIdentifier, byDamage }) {
  if ( identifier && byIdentifier[identifier] ) return { key: identifier, ...byIdentifier[identifier] };
  for ( const type of damageTypes ?? [] ) {
    if ( byDamage[type] ) return { key: type, ...byDamage[type] };
  }
  if ( healing && byDamage.healing ) return { key: "healing", ...byDamage.healing };
  return null;
}

/**
 * BLFX animera-t-il cet item ? Sa clé comme BLFX la calcule (`BlfxMacroExecutor.getBaseItem`) : l'arme de base, sinon l'identifiant
 * s'il est dans sa table, sinon le nom en slug ; un identifiant `blfx-…` est toujours à lui ; et l'Auto-Rec personnalisée
 * (nos entrées, par identifiant).
 * @param {object|null} map          `ANIMATION_MAP` de BLFX (scripts/animationMap.js), ou null s'il n'est pas lisible
 * @param {{ type: string, name: string, identifier?: string, baseItem?: string }} item
 * @param {{ custom?: Set<string>|string[] }} [options]   identifiants de l'Auto-Rec personnalisée
 */
export function blfxKnows(map, { type, name, identifier=null, baseItem=null }, { custom=[] }={}) {
  if ( identifier?.startsWith("blfx-") ) return true;
  if ( identifier && [...custom].includes(identifier) ) return true;
  const table = map?.dnd5e?.[type];
  if ( !table ) return false;
  const valid = identifier && (identifier !== "new-item") && Object.hasOwn(table, identifier);
  const key = baseItem || (valid ? identifier : slugify(name));
  const entry = table[key];
  return !!entry && (typeof entry === "object") && (Object.keys(entry).length > 0);
}
