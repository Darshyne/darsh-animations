/**
 * SPEC §21 : le choix d'une recette d'attaque d'arme (lot 1), sans Foundry. Le runtime résume l'objet et l'attaque, puis joue ce que ce
 * module décide ici : quelle forme (coup, tir, lancer, sur la cible), quels noms candidats (dans l'ordre), quel son, quel impact.
 */
import { COLOR_FALLBACKS, DAMAGE_COLORS, ELEMENTS, GENERIC, NATURAL, SOUNDS, STRIKE_IMPACTS, SWOOSH_BY_DAMAGE, TIMING, UNARMED, WEAPONS }
  from "../data/strikes.mjs";

const PHYSICAL = new Set(["bludgeoning", "piercing", "slashing"]);

/**
 * @typedef {object} StrikeSummary
 * @property {string} itemType          "weapon", "spell", "feat"…
 * @property {string} [weaponType]      `system.type.value` : "simpleM", "martialR", "natural", "improv"…
 * @property {string} [baseItem]        `system.type.baseItem`
 * @property {string[]} [keys]          clés anglaises normalisées (core/aa.mjs `normalize` : identifiant, nom d'origine Babele, nom
 *                                      traduit par la table de la langue, nom de l'objet)
 * @property {string[]} [properties]    propriétés de l'arme ("hvy", "ret", "two", "mgc", "thr"…)
 * @property {string} [attackMode]      mode d'attaque de dnd5e ("oneHanded", "twoHanded", "offhand", "thrown", "thrown-offhand", "ranged")
 * @property {string} [attackType]      `activity.attack.type.value` : "melee" ou "ranged"
 * @property {string} [classification]  `activity.attack.type.classification` : "weapon", "spell", "unarmed"
 * @property {string[]} [damageTypes]   types de dégâts de l'attaque (arme puis dégâts en plus)
 */

/** Les types de dégâts non physiques en plus (le premier donne la couleur d'une arme magique, D7). */
export function extraDamage(damageTypes=[]) {
  return damageTypes.find(t => !PHYSICAL.has(t)) ?? null;
}

/** Le type physique de l'attaque (impact), à défaut tranchant. */
export function physicalDamage(damageTypes=[]) {
  return damageTypes.find(t => PHYSICAL.has(t)) ?? "slashing";
}

/** Une attaque d'arme que le lot 1 joue ? (pas un sort, ni une attaque de sort d'un objet) */
export function isWeaponAttack(s) {
  if ( s.classification === "spell" ) return false;
  if ( s.classification === "unarmed" ) return true;
  return (s.itemType === "weapon") || (s.classification === "weapon");
}

/** La forme : "melee", "ranged", "thrown", ou null. */
export function strikeForm(s) {
  if ( !isWeaponAttack(s) ) return null;
  if ( s.attackMode?.startsWith("thrown") ) return "thrown";
  if ( (s.attackMode === "ranged") || (s.attackType === "ranged") ) return "ranged";
  return "melee";
}

const natural = s => (s.weaponType === "natural") || ((s.itemType !== "weapon") && (s.classification === "weapon"));

/** La recette de l'arme : `{ recipe, family, fire }` (family : ce qui l'a désignée, pour le journal et les tests). */
export function weaponRecipe(s) {
  const form = strikeForm(s);
  if ( !form ) return null;
  const keys = s.keys ?? [];
  const physical = physicalDamage(s.damageTypes);
  if ( (s.classification === "unarmed") || keys.some(k => /unarmedstrike|flurryofblows/.test(k)) ) {
    return { form, family: "unarmed", recipe: UNARMED };
  }
  const weapon = WEAPONS[s.baseItem] ?? keys.map(k => WEAPONS[k]).find(Boolean) ?? null;
  if ( weapon ) {
    const recipe = weapon[form] ?? ((form === "thrown") ? (weapon.ranged ?? GENERIC.thrown) : null)
      ?? ((form === "ranged") ? (weapon.thrown ?? GENERIC.ranged) : weapon.melee);
    if ( recipe ) return { form, family: s.baseItem || keys[0], recipe, fire: weapon.fire ?? null, heavy: !!weapon.heavy };
  }
  if ( natural(s) && (form === "melee") ) {
    const words = keys.join(" ");
    const found = NATURAL.find(([word]) => words.includes(word));
    if ( found ) return { form, family: `natural:${found[0]}`, recipe: found[1] };
    return { form, family: `natural:${physical}`, recipe: (physical === "slashing") ? GENERIC.natural : GENERIC[physical] };
  }
  if ( form === "ranged" ) return { form, family: "generic:ranged", recipe: GENERIC.ranged };
  if ( form === "thrown" ) return { form, family: "generic:thrown", recipe: GENERIC.thrown };
  return { form, family: `generic:${physical}`, recipe: GENERIC[physical] };
}

/** Les couleurs à essayer, dans l'ordre, pour une couleur voulue ; le blanc à la fin. */
export function colorChain(color) {
  const chain = [...(COLOR_FALLBACKS[color] ?? [color])];
  if ( !chain.includes("white") ) chain.push("white");
  return chain;
}

/**
 * Développe des noms candidats : `{color}` par chaque couleur de la chaîne, `{element}` par la famille du type de dégâts (sinon
 * "physical"), `{hands}` par "two_handed" (arme à deux mains, ou Lourde) ou "one_handed". Doublons retirés, ordre gardé.
 */
export function expand(names=[], { color="white", element="physical", hands="one_handed" }={}) {
  const out = [];
  for ( const name of names ) {
    const withVars = name.replaceAll("{element}", element).replaceAll("{hands}", hands);
    if ( withVars.includes("{color}") ) for ( const c of colorChain(color) ) out.push(withVars.replaceAll("{color}", c));
    else out.push(withVars);
  }
  return [...new Set(out)];
}

/**
 * Ce qu'il faut jouer pour une attaque d'arme : `{ form, family, kind, animation[], back[], swoosh, impact, color }`, ou null.
 * `animation` et `back` sont des candidats (le premier connu de Sequencer est joué).
 */
export function chooseStrike(s) {
  const found = weaponRecipe(s);
  if ( !found ) return null;
  const { form, family, recipe, fire, heavy } = found;
  const extra = extraDamage(s.damageTypes);
  const color = (extra && DAMAGE_COLORS[extra]) ? DAMAGE_COLORS[extra] : "white";
  const props = new Set(s.properties ?? []);
  const twoHanded = heavy || props.has("hvy") || props.has("two") || (s.attackMode === "twoHanded");
  const vars = { color, element: ELEMENTS[extra] ?? "physical", hands: twoHanded ? "two_handed" : "one_handed" };
  const names = [...((extra === "fire") && fire ? [fire] : []), ...recipe.animation];
  const returning = (form === "thrown") && props.has("ret") && recipe.back;
  const swooshKey = SWOOSH_BY_DAMAGE[extra] ?? recipe.sound ?? (twoHanded ? "heavy" : "light");
  return {
    form, family, kind: recipe.kind, color,
    animation: expand(names, vars),
    back: returning ? expand(recipe.back, vars) : [],
    swoosh: SOUNDS[swooshKey] ?? SOUNDS.light,
    impact: STRIKE_IMPACTS[physicalDamage(s.damageTypes)]
  };
}

/**
 * Le déroulé, cible par cible : `[{ token, hit, critical, shielded, delay }]`. `targets` : `{ token, hit, critical, reason }` (verdict du
 * Core, ou calculé contre la CA). Une cible au verdict inconnu (`hit` null) est jouée comme touchée sans impact. Bouclier (`reason`
 * "reaction") : le coup s'arrête sur le bouclier, pas d'impact sur la créature.
 */
export function strikeTimeline(targets=[]) {
  return targets.map((t, i) => ({
    token: t.token, hit: t.hit !== false, critical: !!t.critical && (t.hit === true),
    impact: t.hit === true, shielded: (t.hit === false) && (t.reason === "reaction"), delay: i * TIMING.between
  }));
}

/** L'instant de l'impact dans l'animation, selon la forme jouée. */
export function hitDelay(kind) {
  return { swing: TIMING.swingHit, shot: TIMING.shotHit, onTarget: TIMING.onTargetHit }[kind] ?? TIMING.swingHit;
}

/** Échelle d'un critique (D6, défaut retenu : plus grand, impact doublé). */
export const CRITICAL_SCALE = TIMING.criticalScale;

/** Touché, raté, critique contre la CA notée sur le message (dnd5e 6 : `system.targets[].ac`). */
export function judgeAgainstAc(roll, targets=[]) {
  return targets.map(t => {
    if ( roll?.isFumble ) return { ...t, hit: false, critical: false, reason: "fumble" };
    if ( roll?.isCritical ) return { ...t, hit: true, critical: true, reason: "critical" };
    if ( !Number.isFinite(t.ac) || !Number.isFinite(roll?.total) ) return { ...t, hit: null, critical: false, reason: null };
    const hit = roll.total >= t.ac;
    return { ...t, hit, critical: false, reason: hit ? "hit" : "miss" };
  });
}
