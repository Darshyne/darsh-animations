/**
 * Les animations des pièges. Un piège n'est pas une capacité que BLFX sait jouer : son acteur n'a pas de token (un token serait
 * pris pour une créature par le moteur de combat), et tous les hooks dnd5e de BLFX s'arrêtent sans token source. Le module qui
 * pose les pièges annonce leur déclenchement par un hook public (`darsh-loot.trapFired`) ; on joue alors nous-mêmes, par
 * Sequencer, avec les animations et les sons du pack BLFX (runtime/traps.mjs).
 *
 * Clé : l'acteur piège — son id, ou celui de sa source dans un compendium (`_stats.compendiumSource`). Les pièges du DMG 2024
 * ont tous le même nom d'objet (« Déclencher le piège ») et l'identifiant `new-item` : ni l'un ni l'autre ne les distingue.
 *
 * Une partie :
 *   at          "area" : au centre de la zone d'effet, à la taille de sa boîte ; "targets" : sur chaque cible
 *   animation   nom Sequencer du pack BLFX (prive/docs/catalogue-blfx.json) ; un groupe vaut (Sequencer en tire un)
 *   sound       facultatif, joué une fois par partie
 *   scale       facultatif : facteur sur la zone, ou sur la taille du token (défaut 1 / 1,5)
 *   delay       facultatif, en ms depuis le déclenchement
 *   duration    facultatif, en ms : pour une animation en boucle
 *   below       facultatif : sous les tokens
 *
 * Sans entrée pour son acteur, un piège reçoit l'impact du premier type de dégâts de son activité sur chaque cible
 * (BY_DAMAGE) ; sans dégâts, rien.
 */

const impact = (type, extra={}) => ({ at: "targets", animation: `blfx.spell.impact.damage.${type}.1.color1`, ...extra });

export const TRAPS = Object.freeze({
  // Des fléchettes jaillissent des murs : piqûres puis poison sur chaque cible.
  dmgPoisonedDarts: [
    impact("piercing", { sound: "blfx.sound.weapon.range.dart_hit1" }),
    impact("poison", { delay: 350 })
  ],
  // Une aiguille dans une serrure : petite piqûre, poison.
  dmgPoisonedNeedl: [
    impact("piercing", { scale: 1, sound: "blfx.sound.weapon.range.blowgun_dart_hit1" }),
    impact("poison", { delay: 300, scale: 1.2 })
  ],
  // La statue crache le feu sur la zone.
  dmgFireCastingSt: [
    { at: "area", animation: "blfx.spell.template.circle.explosion7.fire_flames_particles.2.color1",
      sound: "blfx.sound.spell.cast.burning_hands" },
    impact("fire", { delay: 500 })
  ],
  // L'amanite explose en boule de feu.
  dmgFireballFungu: [
    { at: "area", animation: "blfx.spell.template.circle.explosion1.fireball1.orange", sound: "blfx.sound.misc.explosion.fire.1" },
    impact("fire", { delay: 600 })
  ],
  // Le plafond s'effondre : éboulis, poussière, coups.
  dmgCollapsingRoo: [
    { at: "area", animation: "blfx.spell.template.circle.explosion8.boulder_rock_debris1.2.color1", sound: "blfx.sound.misc.shock_wave" },
    { at: "area", animation: "blfx.spell.template.circle.explosion3.dust.smoke.puff.color1", delay: 400, scale: 1.2 },
    impact("bludgeoning", { delay: 300 })
  ],
  // La pierre roule dans le couloir : onde de choc et poussière, coup sur les cibles.
  dmgRollingStoneT: [
    { at: "area", animation: "blfx.spell.template.circle.wave3.shockwave1.ring.smoke.orange", sound: "blfx.sound.misc.impact.ground.hit.1" },
    impact("bludgeoning", { delay: 250, sound: "blfx.sound.misc.impact.hit" })
  ],
  // Le filet tombe sur les cibles.
  dmgFallingNetTra: [
    { at: "targets", animation: "blfx.spell.template.square.nature.web.1.color1", scale: 1.6, sound: "blfx.sound.misc.web.1" }
  ],
  // Le sol cède sous la cible : trou, poussière, chute.
  dmgHiddenPitTrap: [
    { at: "targets", animation: "blfx.spell.template.circle.hole1.crack1.dust1.black", scale: 1.8, below: true,
      sound: "blfx.sound.misc.impact.ground.hit.1" },
    impact("bludgeoning", { delay: 500 })
  ],
  // Même chute, sur des pieux.
  dmgSpikedPitTrap: [
    { at: "targets", animation: "blfx.spell.template.circle.hole1.crack1.dust1.black", scale: 1.8, below: true,
      sound: "blfx.sound.misc.impact.ground.hit.1" },
    impact("piercing", { delay: 500, sound: "blfx.sound.misc.bone_cracking" })
  ],
  // Le sable s'ouvre et aspire : tourbillon sous la zone.
  dmgQuicksandPit0: [
    { at: "area", animation: "blfx.spell.template.circle.hole1.crack1.dust1.black", below: true, sound: "blfx.sound.misc.wave.1" },
    { at: "targets", animation: "blfx.spell.cast.swirl1.liquid1.color1", delay: 300, scale: 1.4, below: true }
  ]
});

/** Sans entrée : l'impact du type de dégâts sur chaque cible. */
export const BY_DAMAGE = Object.freeze(Object.fromEntries(
  ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing",
    "thunder"].map(type => [type, [impact(type, { sound: "blfx.sound.misc.impact" })]])));
