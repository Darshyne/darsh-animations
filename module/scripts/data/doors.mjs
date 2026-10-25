/**
 * Les animations des serrures de porte (DAS · Core, SPEC §244 du moteur) : une porte n'est pas une capacité que BLFX sait jouer —
 * pas d'objet, pas d'activité. Le moteur annonce chez le MJ actif `dnd5e-combat.noise` (chaque essai de forçage, réussi ou non) et
 * `dnd5e-combat.doorUnlocked` (crochetée, forcée, ouverte à la clé) ; on joue alors nous-mêmes, par Sequencer, au milieu de la porte
 * (runtime/doors.mjs). Le cœur joue en plus le son de porte du mur (ouverture, déverrouillage) s'il en a un.
 *
 * Moments :
 *   unlock   la serrure cède au crochetage ou à la clé
 *   force    un coup contre la porte (essai de forçage, réussi ou non)
 *   burst    la porte forcée cède et s'ouvre
 *
 * Une partie : `animation` (nom Sequencer ; un groupe vaut), `sound` facultatif, `scale` (fois une case, défaut 1), `delay` (ms),
 * `below` (sous les tokens).
 */

export const DOOR_MOMENTS = Object.freeze(["unlock", "force", "burst"]);

/** Avec BLFX : le « Knock » de BLFX (le sort qui déverrouille) et son son de serrure ; des coups de masse ; la poussière. */
export const BLFX_DOORS = Object.freeze({
  unlock: [{ animation: "blfx.misc.enchantment.17.knock1.color1", scale: 1.2, sound: "blfx.sound.spell.cast.arcane_lock" }],
  force: [{ animation: "blfx.spell.impact.damage.bludgeoning.1.color1", scale: 1, sound: "blfx.sound.weapon.melee.maul" }],
  burst: [
    { animation: "blfx.spell.template.circle.explosion3.dust.smoke.puff.color1", scale: 1.6, delay: 250, below: true,
      sound: "blfx.sound.misc.impact.ground.hit.1" }
  ]
});

/** Sans BLFX, avec JB2A gratuit (+ les sons de PSFX s'il est actif) : une gerbe de runes, un impact, un nuage de fumée. */
export const JB2A_DOORS = Object.freeze({
  unlock: [{ animation: "jb2a.particle_burst.01.rune.bluepurple", scale: 1, sound: "psfx.doors.clean.lock.unlock.wooden.01" }],
  force: [{ animation: "jb2a.impact.007.orange", scale: 1, sound: "psfx.impacts.bludgeoning.v1" }],
  burst: [{ animation: "jb2a.smoke.puff.centered.grey", scale: 1.6, delay: 250, below: true }]
});
