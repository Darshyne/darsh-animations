/**
 * Le rendu propre des attaques (SPEC §21, lot 1 : armes) : les recettes JB2A + PSFX, sans aucune référence à Foundry. Le choix se
 * fait dans core/strikes.mjs, la lecture dans runtime/strikes.mjs.
 *
 * Une recette donne des **listes de noms candidats** : le premier que Sequencer connaît est joué (`entryExists`). Les noms du JB2A
 * Premium (`jb2a_patreon`, noms Sequencer seulement, aucun fichier) viennent en tête, le nom du JB2A gratuit en dernier : un MJ qui a le
 * Premium a la couleur, les autres le blanc du gratuit. Le Premium ne garde pas tous les noms du gratuit (SPEC §21.1) : d'où la liste, et
 * jamais un nom supposé commun. `{color}` est remplacé par la couleur voulue puis ses replis (COLOR_FALLBACKS), `{element}` par la famille de
 * projectile du type de dégâts (ELEMENTS). Les tests vérifient que le dernier candidat de chaque liste existe dans le JB2A gratuit
 * (`docs/catalogue-jb2a.json`), et chaque nom Premium contre `prive/docs/catalogue-jb2a-premium.json` quand `prive/` est là.
 *
 * Inspiré, pour le seul choix des familles (arme → animation, coup qui s'oriente vers la cible, projectile étiré, morsure sur la cible),
 * du classement de JB2A d'Automated Animations 7.1.10 (MIT) ; aucun code repris. Les sons viennent de PSFX : AA n'en choisit aucun.
 */

/** Couleur voulue par type de dégâts (arme magique : le type de ses dégâts en plus, D7). Absent : pas de teinte (blanc). */
export const DAMAGE_COLORS = Object.freeze({
  acid: "green", cold: "blue", fire: "orange", force: "purple", lightning: "blue", necrotic: "dark_purple", poison: "green",
  psychic: "pink", radiant: "yellow", thunder: "blue"
});

/** Replis d'une couleur, dans l'ordre (JB2A n'a pas toutes les couleurs pour toutes les animations). Le blanc est toujours essayé en dernier. */
export const COLOR_FALLBACKS = Object.freeze({
  orange: ["orange", "red", "yellow", "dark_orangepurple"],
  blue: ["blue", "bright_blue", "purple"],
  green: ["green", "bright_green", "dark_green"],
  purple: ["purple", "dark_purple", "pinkpurple", "pink"],
  dark_purple: ["dark_purple", "purple", "pinkpurple", "dark_orangepurple"],
  pink: ["pink", "pinkpurple", "purple"],
  yellow: ["yellow", "bright_yellow", "orange"],
  red: ["red", "dark_red", "orange"],
  white: ["white"]
});

/** La famille de projectile d'un type de dégâts (flèches et carreaux du Premium : `arrow.<element>.<couleur>`). */
export const ELEMENTS = Object.freeze({
  fire: "fire", cold: "cold", lightning: "lightning", thunder: "lightning", poison: "poison", acid: "poison"
});

/** Les sons PSFX. Un groupe (sans suffixe) : Sequencer en tire un au hasard. */
export const SOUNDS = Object.freeze({
  light: "psfx.weapon-swooshes.light.v1",
  heavy: "psfx.weapon-swooshes.heavy.v1",
  fire: "psfx.weapon-swooshes.fire.v1.group01",
  cold: "psfx.weapon-swooshes.cold.v1.group01",
  necrotic: "psfx.weapon-swooshes.necrotic.v1.group01",
  psychic: "psfx.weapon-swooshes.psychic.v1.group01",
  lightning: "psfx.weapon-swooshes.lightning.v1.group01",
  bow: "psfx.ranged-weapons.longbow.v1.30ft",
  gun: "psfx.ranged-weapons.guns.single-fire.revolver",
  slashing: "psfx.impacts.slashing.v1",
  bludgeoning: "psfx.impacts.bludgeoning.v1",
  piercing: "psfx.impacts.slashing.v1"
});

/** Le souffle d'une arme selon le type de dégâts en plus (arme magique), sinon léger / lourd (propriété Lourde). */
export const SWOOSH_BY_DAMAGE = Object.freeze({
  fire: "fire", cold: "cold", necrotic: "necrotic", psychic: "psychic", lightning: "lightning", thunder: "lightning"
});

/** L'impact sur la cible touchée, par type de dégâts physiques (JB2A gratuit), et son son. */
export const STRIKE_IMPACTS = Object.freeze({
  slashing: { animation: ["jb2a.impact.008.orange"], scale: 0.9, sound: SOUNDS.slashing },
  piercing: { animation: ["jb2a.impact.007.yellow"], scale: 0.8, sound: SOUNDS.piercing },
  bludgeoning: { animation: ["jb2a.impact.005.orange"], scale: 0.9, sound: SOUNDS.bludgeoning }
});

/** Coup de contact : arme qui s'oriente de l'attaquant vers la cible. */
const melee = (...animation) => ({ kind: "swing", animation });
/** Projectile étiré de l'attaquant à la cible (flèche, carreau, bille). */
const shot = (sound, ...animation) => ({ kind: "shot", animation, sound });
/** Arme lancée : elle tourne jusqu'à la cible ; `back` pour une arme qui revient (propriété « ret »). */
const throwing = (animation, back=null) => ({ kind: "shot", animation, ...(back ? { back } : {}), sound: "light" });
/** Sur la cible (morsure, griffes). */
const onTarget = (...animation) => ({ kind: "onTarget", animation });

const SWORD = melee("jb2a.sword.melee.01.{color}", "jb2a.sword.melee.01.white");
const SPEAR = melee("jb2a.spear.melee.01.{color}", "jb2a.spear.melee.01.white");
const MACE = melee("jb2a.mace.melee.01.{color}", "jb2a.mace.melee.01.white");
const HAMMER = melee("jb2a.hammer.melee.01.{color}", "jb2a.hammer.melee.01.white");
const WARHAMMER = melee("jb2a.warhammer.melee.01.{color}", "jb2a.warhammer.melee.01.white");
const ARROW = shot("bow", "jb2a.arrow.{element}.{color}", "jb2a.arrow.physical.{color}", "jb2a.arrow.physical.white.01");
const BOLT = shot("bow", "jb2a.bolt.{element}.{color}", "jb2a.bolt.physical.{color}", "jb2a.bolt.physical.white",
  "jb2a.bolt.physical.orange");
const BULLET = shot("light", "jb2a.bullet.01.{color}", "jb2a.bullet.01.orange");

/** Variante « feu » des armes du Premium (`<arme>.melee.fire.<couleur>`) : prise d'abord pour une arme aux dégâts de feu en plus. */
const FIRE = Object.freeze({
  sword: "jb2a.sword.melee.fire.{color}", dagger: "jb2a.dagger.melee.fire.{color}", mace: "jb2a.mace.melee.fire.{color}",
  spear: "jb2a.spear.melee.fire.{color}", greataxe: "jb2a.greataxe.melee.fire.{color}", handaxe: "jb2a.handaxe.melee.fire.{color}",
  rapier: "jb2a.rapier.melee.fire.{color}", greatclub: "jb2a.greatclub.fire.{color}", maul: "jb2a.maul.melee.fire.{color}",
  greatsword: "jb2a.greatsword.melee.fire.{color}"
});

/**
 * Les armes du PHB 2024, par arme de base dnd5e (`system.type.baseItem`). `melee` : le coup ; `thrown` : le lancer (mode « thrown ») ;
 * `ranged` : le tir ; `fire` : la variante feu (FIRE).
 */
export const WEAPONS = Object.freeze({
  club: { melee: melee("jb2a.club.melee.01.{color}", "jb2a.club.melee.01.white") },
  dagger: {
    melee: melee("jb2a.dagger.melee.02.white"), fire: FIRE.dagger,
    thrown: throwing(["jb2a.dagger.throw.01.{color}", "jb2a.dagger.throw.01.white"],
      ["jb2a.dagger.return.01.{color}", "jb2a.dagger.return.01.white"])
  },
  greatclub: { melee: melee("jb2a.greatclub.standard.white"), fire: FIRE.greatclub, heavy: true },
  handaxe: {
    melee: melee("jb2a.handaxe.melee.standard.white"), fire: FIRE.handaxe,
    thrown: throwing(["jb2a.handaxe.throw.01", "jb2a.dagger.throw.01.white"], ["jb2a.handaxe.return.01", "jb2a.dagger.return.01.white"])
  },
  javelin: { melee: SPEAR, thrown: throwing(["jb2a.javelin.01.throw", "jb2a.arrow.physical.white.01"], ["jb2a.javelin.01.return"]) },
  lighthammer: {
    melee: HAMMER, thrown: throwing(["jb2a.hammer.throw", "jb2a.dagger.throw.01.white"], ["jb2a.hammer.return", "jb2a.dagger.return.01.white"])
  },
  mace: { melee: MACE, fire: FIRE.mace },
  quarterstaff: { melee: melee("jb2a.quarterstaff.melee.01.{color}", "jb2a.quarterstaff.melee.01.white") },
  sickle: { melee: melee("jb2a.melee_attack.01.sickle.01") },
  spear: {
    melee: SPEAR, fire: FIRE.spear,
    thrown: throwing(["jb2a.spear.throw.01", "jb2a.arrow.physical.white.01"], ["jb2a.spear.return.01"])
  },
  dart: { ranged: shot("light", "jb2a.dart.01.throw.physical.white", "jb2a.bullet.02.orange") },
  lightcrossbow: { ranged: BOLT },
  handcrossbow: { ranged: BOLT },
  heavycrossbow: { ranged: BOLT },
  shortbow: { ranged: ARROW },
  longbow: { ranged: ARROW },
  sling: { ranged: shot("light", "jb2a.slingshot", "jb2a.bullet.01.orange") },
  blowgun: { ranged: shot("light", "jb2a.dart.01.throw.physical.white", "jb2a.bullet.02.orange") },
  musket: { ranged: shot("gun", "jb2a.bullet.Snipe.{color}", "jb2a.bullet.01.orange") },
  pistol: { ranged: shot("gun", "jb2a.bullet.01.{color}", "jb2a.bullet.01.orange") },
  battleaxe: { melee: melee("jb2a.melee_attack.02.battleaxe.01") },
  flail: { melee: melee("jb2a.melee_attack.01.flail.01") },
  glaive: { melee: melee("jb2a.glaive.melee.01.{color}", "jb2a.glaive.melee.01.white"), heavy: true },
  greataxe: { melee: melee("jb2a.greataxe.melee.standard.white"), fire: FIRE.greataxe, heavy: true },
  greatsword: { melee: melee("jb2a.greatsword.melee.standard.white"), fire: FIRE.greatsword, heavy: true },
  halberd: { melee: melee("jb2a.halberd.melee.01.{color}", "jb2a.halberd.melee.01.white"), heavy: true },
  lance: { melee: SPEAR, heavy: true },
  longsword: { melee: SWORD, fire: FIRE.sword },
  maul: { melee: melee("jb2a.maul.melee.standard.white"), fire: FIRE.maul, heavy: true },
  morningstar: { melee: MACE, fire: FIRE.mace },
  pike: { melee: SPEAR, heavy: true },
  rapier: { melee: melee("jb2a.rapier.melee.01.{color}", "jb2a.rapier.melee.01.white"), fire: FIRE.rapier },
  scimitar: { melee: melee("jb2a.scimitar.melee.01.{color}", "jb2a.scimitar.melee.01.white") },
  shortsword: { melee: melee("jb2a.melee_attack.01.shortsword.01") },
  trident: { melee: SPEAR, thrown: throwing(["jb2a.spear.throw.01", "jb2a.arrow.physical.white.01"], ["jb2a.spear.return.01"]) },
  warpick: { melee: WARHAMMER },
  warhammer: { melee: WARHAMMER },
  whip: { melee: melee("jb2a.melee_generic.slash.01.{color}", "jb2a.melee_generic.slash.01.orange") }
});

/** Coup à mains nues (identifiant dnd5e `unarmed-strike`), Déluge de coups. */
export const UNARMED = melee("jb2a.unarmed_strike.physical.01.{color}", "jb2a.unarmed_strike.physical.01.blue");

/**
 * Attaques naturelles : mot de l'identifiant anglais (ou du nom anglais) → recette. Le premier mot trouvé l'emporte, dans cet ordre.
 */
export const NATURAL = Object.freeze([
  ["bite", onTarget("jb2a.bite.400px.{color}", "jb2a.bite.400px.red")],
  ["fang", onTarget("jb2a.bite.400px.{color}", "jb2a.bite.400px.red")],
  ["beak", onTarget("jb2a.bite.400px.{color}", "jb2a.bite.400px.red")],
  ["claw", onTarget("jb2a.claws.400px.{color}", "jb2a.claws.400px.red")],
  ["talon", onTarget("jb2a.claws.400px.{color}", "jb2a.claws.400px.red")],
  ["rend", onTarget("jb2a.claws.400px.{color}", "jb2a.claws.400px.red")],
  ["pincer", melee("jb2a.melee_generic.creature_attack.pincer.001.{color}", "jb2a.melee_generic.creature_attack.pincer.001.red")],
  ["slam", melee("jb2a.melee_generic.creature_attack.fist.001.{color}", "jb2a.melee_generic.creature_attack.fist.001.red")],
  ["fist", melee("jb2a.melee_generic.creature_attack.fist.001.{color}", "jb2a.melee_generic.creature_attack.fist.001.red")],
  ["punch", UNARMED],
  ["unarmed", UNARMED],
  ["tentacle", melee("jb2a.melee_generic.creature_attack.fist.002.{color}", "jb2a.melee_generic.creature_attack.fist.002.blue")],
  ["tail", melee("jb2a.melee_generic.creature_attack.fist.002.{color}", "jb2a.melee_generic.creature_attack.fist.002.blue")],
  ["sting", SPEAR], ["horn", SPEAR], ["gore", SPEAR], ["tusk", SPEAR]
]);

/**
 * Repli par type de dégâts, pour une arme sans famille (arme maison sans arme de base) ou une attaque naturelle sans mot reconnu. Le
 * Premium a un coup générique par type, à une ou deux mains (`melee_generic.<type>.one_handed|two_handed`).
 */
export const GENERIC = Object.freeze({
  slashing: melee("jb2a.melee_generic.slashing.{hands}", "jb2a.melee_generic.slash.01.orange"),
  piercing: melee("jb2a.melee_generic.piercing.{hands}", "jb2a.spear.melee.01.white"),
  bludgeoning: melee("jb2a.melee_generic.bludgeoning.{hands}", "jb2a.club.melee.01.white"),
  natural: onTarget("jb2a.claws.400px.{color}", "jb2a.claws.400px.red"),
  ranged: ARROW,
  thrown: throwing(["jb2a.dagger.throw.01.{color}", "jb2a.dagger.throw.01.white"])
});

/** Temps (ms) : où tombe le coup dans l'animation (impact, son), l'écart entre deux cibles, et l'échelle d'un critique (D6). */
export const TIMING = Object.freeze({ swingHit: 450, shotHit: 600, onTargetHit: 250, between: 250, criticalScale: 1.3 });
