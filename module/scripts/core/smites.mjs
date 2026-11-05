/**
 * SPEC §18 : les châtiments que DAS · Core ajoute à une attaque d'arme (Châtiment divin, Châtiment ardent…). Le moteur ajoute leurs
 * dés au jet de dégâts de l'arme et note le châtiment sur la carte de dégâts (`flags.dnd5e-combat.smite`) : BLFX, qui attend une
 * utilisation du sort, ne voit que l'arme et ne joue jamais l'animation du sort (issue GitHub darsh-animations #1). Ce qui se décide
 * sans Foundry : l'animation « après les dégâts » de BLFX pour ce châtiment.
 */
import { slugify } from "./blfx.mjs";

/** Le déclencheur de BLFX rejoué : celui du jet de dégâts, où le châtiment a lieu. */
export const SMITE_TRIGGER = "afterDamage";

/**
 * L'animation de BLFX pour l'objet du châtiment, rendue comme dans sa table (`{ macro, defaultParams }`), ou null. Sa clé comme BLFX
 * la calcule : l'identifiant s'il est dans la table, sinon le nom en slug.
 * @param {object|null} map  `ANIMATION_MAP` de BLFX (scripts/animationMap.js)
 * @param {{ type: string, name?: string, identifier?: string }} item
 */
export function smiteAnimation(map, { type, name="", identifier=null }={}) {
  const table = map?.dnd5e?.[type];
  if ( !table ) return null;
  const key = (identifier && Object.hasOwn(table, identifier)) ? identifier : slugify(name);
  const anim = table[key]?.[SMITE_TRIGGER];
  return (typeof anim?.macro === "function") ? anim : null;
}

/**
 * Qui joue le châtiment (SPEC §18 bis, issue GitHub darsh-animations #5) : BLFX s'il a une animation « après les dégâts » pour ce sort,
 * sinon Automated Animations s'il a une entrée (ou des drapeaux) pour ce sort, sinon personne. Un seul des deux, jamais les deux.
 * @param {{ blfx?: boolean, aa?: boolean }} available
 * @returns {"blfx"|"aa"|null}
 */
export function smiteBackend({ blfx=false, aa=false }={}) {
  if ( blfx ) return "blfx";
  if ( aa ) return "aa";
  return null;
}
