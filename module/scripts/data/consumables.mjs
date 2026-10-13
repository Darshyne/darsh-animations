/**
 * Les effets des potions et des consommables (SPEC §13). BLFX n'en reconnaît aucun (son Auto-Rec intégrée n'a que les lanternes
 * et les baies magiques) : on les joue nous-mêmes, à la carte d'utilisation, avec le premier rendu disponible —
 *   blfx        animations et sons du pack BLFX, joués par Sequencer ;
 *   tokenmagic  filtres de Token Magic FX posés sur le token, qui s'effacent d'eux-mêmes ;
 *   native      sans aucun des deux : un anneau qui pulse autour du token, de la couleur de l'humeur (runtime/native.mjs).
 *
 * Un consommable reçoit une **sorte** (core/consumables.mjs, `classify`) d'après son sous-type dnd5e et ses activités, sauf si
 * son identifiant est dans BY_IDENTIFIER, une **couleur** (COLORS), une **humeur** (positive, négative, neutre : la couleur du rendu
 * autonome) et parfois une **signature** (SIGNATURES : l'effet propre à une potion marquante, en plus de celui de sa sorte).
 *
 * Sortes :
 *   heal    potion qui soigne (ou donne des PV temporaires) : sur la créature qui la boit ou à qui on l'administre
 *   potion  toute autre potion bue (sort, effet) : sur la créature qui la boit
 *   poison  poison appliqué ou ingéré : sur la créature empoisonnée
 *   thrown  flasque lancée (feu grégeois, acide, eau bénite, huile) : de l'utilisateur à la cible, éclaboussure
 *   scroll  parchemin lu : sur le lecteur
 *   drink   boisson : sur celui qui boit
 *   food    nourriture : sur celui qui mange
 */

/** Les couleurs : lueurs de soin du pack BLFX (`…heal2.particles1.glow.<couleur>`), teinte Token Magic et du rendu autonome. */
export const COLORS = Object.freeze({
  red: 0xff3040,
  orange: 0xff9020,
  yellow: 0xffe040,
  green: 0x40ff70,
  blue: 0x40a0ff,
  purple: 0xb060ff,
  poison: 0x9ad000
});

/** Les humeurs et leur couleur dans le rendu autonome (décision utilisateur, 2026-10-13). */
export const MOODS = Object.freeze({ positive: "green", negative: "red", neutral: "blue" });

/** Les sortes : couleur et humeur par défaut. */
export const KINDS = Object.freeze({
  heal: { color: "red", mood: "positive" },
  potion: { color: "purple", mood: "positive" },
  poison: { color: "poison", mood: "negative" },
  thrown: { color: "orange", mood: "negative" },
  scroll: { color: "blue", mood: "neutral" },
  drink: { color: "blue", mood: "neutral" },
  food: { color: "yellow", mood: "neutral" }
});

/**
 * Par identifiant dnd5e (Manuel des joueurs, Guide du maître, SRD — relevé du 2026-10-13) : la sorte si le classement générique
 * se tromperait, la couleur, l'humeur, la signature, et pour une flasque lancée le type de dégâts de l'éclaboussure (`damage`).
 * Toutes les potions relevées y sont, pour qu'aucune ne tombe sur le violet par défaut sans l'avoir voulu.
 */
export const BY_IDENTIFIER = Object.freeze({
  // Flasques lancées : en 2024, des sauvegardes de Dextérité contre une créature à portée de jet.
  "alchemists-fire": { kind: "thrown", color: "orange", damage: "fire" },
  "acid": { kind: "thrown", color: "green", damage: "acid" },
  "holy-water": { kind: "thrown", color: "yellow", damage: "radiant" },
  "oil": { kind: "thrown", color: "orange" },
  // Soins.
  "potion-of-healing": { color: "red" },
  "greater-potion-of-healing": { color: "red" },
  "superior-potion-of-healing": { color: "red" },
  "supreme-potion-of-healing": { color: "red" },
  "potion-of-heroism": { color: "yellow", signature: "shield" },
  "elixir-of-health": { kind: "heal", color: "green" },
  "keoghtoms-ointment": { kind: "heal", color: "green" },
  "potion-of-vitality": { color: "green" },
  "potion-of-longevity": { color: "green" },
  "antitoxin": { color: "green" },
  // Force de géant : la couleur du géant.
  "hill-potion-of-giant-strength": { color: "orange", signature: "grow" },
  "stone-potion-of-giant-strength": { color: "orange", signature: "grow" },
  "frost-potion-of-giant-strength": { color: "blue", signature: "grow" },
  "fire-potion-of-giant-strength": { color: "red", signature: "grow" },
  "cloud-potion-of-giant-strength": { color: "blue", signature: "grow" },
  "storm-potion-of-giant-strength": { color: "purple", signature: "grow" },
  "potion-of-giant-strength": { color: "orange", signature: "grow" },
  // Potions à effet marquant.
  "potion-of-invisibility": { color: "blue", signature: "vanish" },
  "potion-of-greater-invisibility": { color: "purple", signature: "vanish" },
  "oil-of-etherealness": { color: "purple", signature: "ethereal" },
  "potion-of-gaseous-form": { color: "blue", signature: "mist" },
  "potion-of-fire-breath": { color: "orange", signature: "fire" },
  "potion-of-flying": { color: "blue", signature: "wings" },
  "potion-of-water-breathing": { color: "blue", signature: "bubbles" },
  "potion-of-invulnerability": { color: "yellow", signature: "shield" },
  "potion-of-resistance": { color: "purple", signature: "shield" },
  "potion-of-growth": { color: "orange", signature: "grow" },
  "potion-of-diminution": { color: "orange", signature: "shrink" },
  "potion-of-clairvoyance": { color: "purple", signature: "eye" },
  "potion-of-mind-reading": { color: "purple", signature: "eye" },
  "potion-of-comprehension": { color: "purple", signature: "eye" },
  "philter-of-love": { color: "red", mood: "neutral", signature: "heart" },
  "potion-of-speed": { color: "yellow" },
  "potion-of-climbing": { color: "green" },
  "potion-of-animal-friendship": { color: "green" },
  "potion-of-pugilism": { color: "red" },
  "oil-of-sharpness": { color: "yellow" },
  "oil-of-slipperiness": { color: "blue", mood: "neutral" },
  // Potions qui nuisent à qui les boit.
  "potion-of-poison": { kind: "poison" },
  "truth-serum": { color: "purple", mood: "negative", signature: "eye" },
  // Nourriture magique.
  "fruit-of-restoration": { kind: "food", color: "green", mood: "positive" }
});

/**
 * Ce que BLFX joue déjà de lui-même (son Auto-Rec intégrée, section `consumable` : prive/docs/blfx-autorec.json) : jamais deux
 * fois avec le rendu BLFX.
 */
export const BLFX_BUILTIN = Object.freeze(["bullseye-lantern", "hooded-lantern", "magical-berries"]);

/**
 * Rendu BLFX (Sequencer), par sorte. `at` : "user" (l'utilisateur), "targets" (chaque créature touchée) ; `{color}` est remplacé
 * par la couleur du consommable. `throw` : le projectile de l'utilisateur vers chaque cible, puis `splash` sur la cible.
 */
export const BLFX_RECIPES = Object.freeze({
  heal: [
    { at: "user", sound: "blfx.sound.misc.potion.drink" },
    { at: "targets", animation: "blfx.spell.melee.heal2.particles1.glow.{color}", scale: 1.6, delay: 500,
      sound: "blfx.sound.spell.cast.heal.1" }
  ],
  potion: [
    { at: "user", sound: "blfx.sound.misc.potion.drink" },
    { at: "targets", animation: "blfx.spell.melee.heal2.particles1.glow.{color}", scale: 1.6, delay: 500,
      sound: "blfx.sound.spell.cast.buff.1" }
  ],
  poison: [
    { at: "targets", animation: "blfx.spell.melee.heal2.particles1.glow.poison", scale: 1.5,
      sound: "blfx.sound.misc.impact.liquid1" },
    { at: "targets", animation: "blfx.spell.impact.damage.poison.1.color1", scale: 1.3, delay: 400 }
  ],
  thrown: [
    { at: "targets", throw: "blfx.misc.range.throw.concoction_flask_potion.1.color1", sound: "blfx.sound.misc.impact.liquid1",
      splash: "blfx.spell.impact.explosion.liquid_sphere.1.color1" }
  ],
  scroll: [
    { at: "user", animation: "blfx.misc.enchantment.3.paper_scroll_signet_sigil.1.color1", scale: 1.6,
      sound: "blfx.sound.spell.cast.buff.2" }
  ],
  drink: [
    { at: "user", sound: "blfx.sound.misc.potion.drink" }
  ],
  food: [
    { at: "user", animation: "blfx.spell.misc.heal.rings_particles.1.color1", scale: 1.2 }
  ]
});

/** L'impact des dégâts d'une flasque lancée, sur la cible, après l'éclaboussure. */
export const IMPACT = "blfx.spell.impact.damage.{damage}.1.color1";

/**
 * Rendu Token Magic FX, par sorte : les filtres posés sur chaque token concerné (`at`, comme ci-dessus), qui s'effacent
 * d'eux-mêmes après `loops` passages (`autoDestroy`). `glow` : lueur pulsée de la couleur ; `bloom` : éclat ; `wave` : onde de choc.
 * Formes des paramètres relevées dans les préréglages de Token Magic FX 0.8.4 (fx/presets/defaultpresets.js).
 */
export const TOKENMAGIC_RECIPES = Object.freeze({
  heal: { at: "targets", glow: { strength: 6, loops: 2 }, bloom: true },
  potion: { at: "targets", glow: { strength: 5, loops: 2 } },
  poison: { at: "targets", glow: { strength: 5, loops: 3 } },
  thrown: { at: "targets", glow: { strength: 6, loops: 1 }, wave: true },
  scroll: { at: "user", glow: { strength: 5, loops: 2 }, bloom: true },
  drink: { at: "user", glow: { strength: 3, loops: 1 } },
  food: { at: "user", glow: { strength: 3, loops: 1 } }
});

/**
 * Les signatures : ce qu'une potion marquante joue **en plus** de sa sorte, sur la même créature, après la gorgée.
 *   blfx        une animation du pack (échelle, durée si elle boucle, sous le token)
 *   tokenmagic  un filtre de plus : `fade` (le token s'estompe et revient : `adjustment.alpha`), `blur` (flou : `blur.blur`),
 *               `scale` (grossit ou rétrécit un instant : `transform.scaleX/Y`), ou rien (la lueur de la sorte suffit)
 * Le rendu autonome ignore les signatures : son anneau dit seulement l'humeur.
 */
export const SIGNATURES = Object.freeze({
  vanish: { blfx: { animation: "blfx.spell.cast.blink.1.gravity.color1", scale: 1.8 }, tokenmagic: { fade: 0.15 } },
  ethereal: { blfx: { animation: "blfx.misc.enchantment.25.ethereal1.blink.teleport.loop.color1", scale: 1.8, duration: 2500 },
    tokenmagic: { fade: 0.35, blur: 4 } },
  mist: { blfx: { animation: "blfx.spell.template.circle.smoke1.mist1.storm1.color1", scale: 2.4, duration: 3000, below: true },
    tokenmagic: { blur: 8, fade: 0.5 } },
  fire: { blfx: { animation: "blfx.misc.spell.bubble1.explosion1.fire.above.orange", scale: 1.6 }, tokenmagic: {} },
  wings: { blfx: { animation: "blfx.ability.wings1.attack1.fade-in-out.color1", scale: 2 }, tokenmagic: {} },
  bubbles: { blfx: { animation: "blfx.misc.nature.water.bubble1.loop.color1", scale: 1.6, duration: 2500 }, tokenmagic: {} },
  shield: { blfx: { animation: "blfx.spell.cast.impact.shield.center.color1", scale: 1.8 }, tokenmagic: {} },
  heart: { blfx: { animation: "blfx.misc.enchantment.4.heart_beat1.color1", scale: 1.4 }, tokenmagic: {} },
  eye: { blfx: { animation: "blfx.spell.cast.eye1.color1", scale: 1.4 }, tokenmagic: {} },
  grow: { blfx: null, tokenmagic: { scale: 1.25 } },
  shrink: { blfx: null, tokenmagic: { scale: 0.75 } }
});

/** Rendu autonome : l'anneau qui pulse (runtime/native.mjs). Rayon en fraction de la taille du token. */
export const NATIVE = Object.freeze({ rings: 2, duration: 1100, from: 0.45, to: 0.95, width: 6 });
