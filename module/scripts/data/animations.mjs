/**
 * Les animations, par identifiant dnd5e (`item.system.identifier`) : c'est la seule clé qui ne dépend pas de la langue.
 * La synchronisation retrouve dans le monde et les compendiums de SOURCES les items qui portent ces identifiants, et range
 * chaque animation sous leur nom et celui de leur activité, comme BLFX les cherche.
 *
 * Une animation :
 *   trigger      déclencheur BLFX : afterAttack, afterThrown, afterDamage, afterItemUse, afterActiveEffects, afterSummon,
 *                createTemplate (core/blfx.mjs, TRIGGERS)
 *   activity     facultatif : seulement les activités de ce type (attack, save, damage, heal, utility, summon…)
 *   et SOIT
 *   alias        « type.clé » d'une animation que BLFX a déjà (weapon.claw, feat.deathly-touch, spell.command) ;
 *                aliasTrigger si son déclencheur diffère du nôtre. Seulement vers une macro VÉRIFIÉE purement visuelle :
 *                certaines de BLFX écrivent (la fuite brumeuse du vampire supprime le token, le changement de forme change
 *                son image, `demonicRestoration` le cache) — voir SPEC §3.
 *   SOIT
 *   template     un modèle de l'éditeur BLFX (core/blfx.mjs, TEMPLATES) et
 *   params       les constantes du modèle à changer (ANIMATION1, SOUND2, ENABLED3…) ; noms d'animation et de son pris
 *                dans le catalogue BLFX (`npm run catalogue` → prive/docs/catalogue-blfx.json, non publié), ou un groupe
 *                de longueurs (rayon : Sequencer choisit selon la distance)
 *   note         facultatif : pourquoi ce choix
 *
 * Choix des déclencheurs avec le moteur de combat :
 *  - une zone posée (sort, souffle, zone « sur soi » que le moteur pose d'office) → createTemplate, BLFX joue sur la région ;
 *  - une RÉACTION à zone n'a pas de région (le moteur l'utilise sans gabarit, `measuredTemplate: false`) → afterItemUse,
 *    animation sur soi, à l'échelle de la zone (rayon de 18 m = 24 cases de diamètre pour un token d'une case) ;
 *  - une attaque → afterAttack (BLFX attend la fin des dés) ; une sauvegarde sans zone → afterItemUse sur les cibles.
 *
 * D'autres modules ajoutent leurs propres entrées (créatures d'une campagne, options d'un supplément) sans toucher à ce
 * fichier : hook `darsh-animations.register` ou `api.register` (runtime/registry.mjs).
 */

/** Les compendiums parcourus en plus des items du monde (acteurs et items isolés). */
export const SOURCES = Object.freeze([
  "dnd-ravenloft-horrors-within.actors",
  "dnd-ravenloft-horrors-within.options",
  "dnd-ravenloft-horrors-within.items",
  "dnd-ravenloft-horrors-within.bastions",
  "dnd-players-handbook.spells"
]);

/* -------------------------------------------- */
/*  Gestes récurrents                           */
/* -------------------------------------------- */

const sound = (n, file) => file ? { [`SOUND_ENABLED${n}`]: true, [`SOUND${n}`]: file } : {};

/** Une entrée de modèle : `extra` donne d'autres constantes du modèle, et éventuellement sa `note`. */
const entry = (trigger, template, params, { note, ...extra }={}) =>
  ({ trigger, template, ...(note ? { note } : {}), params: { ...params, ...extra } });

/** Une animation sur le lanceur (modèle « On Target or Token », partie 1), rien sur les cibles. */
const onSelf = (animation, file, scale=2, extra={}) => entry("afterItemUse", "target",
  { ANIMATION1: animation, SCALE1: scale, ENABLED1: true, ...sound(1, file), ENABLED2: false, ENABLED3: false }, extra);

/** Une animation sur chaque cible (partie 3), avec un rayon depuis le lanceur si `beam`. */
const onTargets = (animation, file, { beam=null, scale=2, trigger="afterItemUse" }={}) => ({ trigger, template: "target",
  params: { ENABLED1: false, ...(beam ? { ENABLED2: true, ANIMATION2: beam } : { ENABLED2: false }),
    ENABLED3: true, ANIMATION3: animation, SCALE3: scale, ...sound(3, file) } });

/** Une explosion sur la zone posée autour du lanceur (cercle), sans lancement ni rayon. */
const burst = (animation, file, extra={}) => entry("createTemplate", "circle",
  { ENABLED1: false, ENABLED2: false, ENABLED3: true, ANIMATION3: animation, ...sound(3, file) }, extra);

/** Un cône depuis le lanceur. */
const cone = (animation, file, extra={}) => entry("createTemplate", "cone",
  { ENABLED1: false, ENABLED3: true, ANIMATION3: animation, ...sound(3, file) }, extra);

/** Une ligne depuis le lanceur. */
const line = (animation, file, extra={}) => entry("createTemplate", "line",
  { ENABLED1: false, ENABLED2: false, ENABLED3: true, ANIMATION3: animation, ...sound(3, file) }, extra);

/** Une animation d'attaque que BLFX a déjà (arme, attaque naturelle). */
const strike = (alias, extra={}) => ({ trigger: "afterAttack", activity: "attack", alias, ...extra });

/* -------------------------------------------- */
/*  La table                                    */
/* -------------------------------------------- */

export const ANIMATIONS = Object.freeze({

  /* ---- Prêtre (Monster Manual 2024) ---- */
  "radiant-flame": [strike("spell.guiding-bolt", { note: "trait radiant à distance" })],

  /* ---- Sorts sans animation BLFX (Xanathar's, haut niveau) ---- */
  "absorb-elements": [onSelf("blfx.spell.misc.shield5.magic.protection.energy.fire1.loop.color1", "blfx.sound.spell.resistance.1", 1.5)],
  "cause-fear": [onTargets("blfx.condition.frightened1.dread.fear.skull.loop.red", "blfx.sound.spell.cast.bane.1")],
  "eyebite": [onSelf("blfx.spell.cast.eye1.color1", "blfx.sound.spell.cast.charm_person.3", 1.5)],
  "commune": [onSelf("blfx.spell.cast.divination.1.color1", "blfx.sound.spell.magic_light1.3")],
  "raise-dead": [onTargets("blfx.spell.cast.revivify1.color1", "blfx.sound.spell.cast.heal.2")],
  "finger-of-death": [{ ...onTargets("blfx.spell.impact.damage.necrotic.1.color1", "blfx.sound.spell.cast.inflict_wounds.3",
    { beam: "blfx.spell.range.ray.burst5.missile.sinusoidal.impact.intro.black" }), activity: "save" }]
});

/**
 * Les capacités volontairement sans animation : rien à montrer (un déplacement, une règle), ou une animation qui gênerait
 * plus qu'elle n'aide. `npm run inventaire` les compte comme traitées.
 */
export const WITHOUT = Object.freeze({
  "mask-of-the-wild": "trait d'espèce (se cacher), rien à montrer"
});
