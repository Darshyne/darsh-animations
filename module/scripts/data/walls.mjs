/**
 * Les murs de sort posés par points (le moteur de combat les pose en régions de formes « line », ou en anneau) : une animation en
 * boucle le long du mur, tant que la région est là (runtime/walls.mjs). BLFX ne les joue pas : il ne voit pas de gabarit.
 *
 * Clé : l'identifiant dnd5e du sort. Une entrée a l'une ou l'autre façon de se dessiner :
 *   animations  { longueur en pieds: nom Sequencer } — un mur fin, couché le long de chaque segment : on prend, pour chaque segment,
 *               celle dont la longueur est la plus proche (le pack BLFX a des murs de 10, 20, 30, 60 et 90 ft, à 40 px par pied)
 *     native    la hauteur de l'animation, en pixels (son épaisseur une fois couchée le long du mur)
 *     thickness l'épaisseur de l'image, en cases (la flamme n'en occupe que le milieu : 2 cases donnent un feu d'une demi-case)
 *     ring      facultatif : { module, animation, native } — un anneau tout fait, si ce module est actif ; sinon des segments
 *   tile        { animation, scale? } — un mur épais, posé sur les cases : cette boucle (carrée) sur chaque case qu'il couvre, à
 *               `scale` fois la case
 * Et, dans les deux cas :
 *   sound       facultatif : { name, volume, reach } — un son d'ambiance en boucle (nom Sequencer d'un son du pack BLFX) au milieu de
 *               chaque segment, ou au centre de l'anneau, entendu jusqu'à `reach` pieds au-delà du mur
 *   hit         facultatif : sur chaque créature visée par un jet de dégâts du sort (à l'apparition, en traversant, en finissant son tour
 *               dedans ou du côté brûlant) — des parties comme celles des pièges : { animation, scale?, delay?, duration?, sound? }
 */

const fireWall = n => `blfx.spell.template.line.wall_of_fire1.loop.orange.width-${n}ft`;

export const WALLS = Object.freeze({
  "wall-of-fire": {
    animations: { 10: fireWall(10), 20: fireWall(20), 30: fireWall(30), 60: fireWall(60), 90: fireWall(90) },
    native: 400,
    thickness: 2,
    // JB2A (gratuit), anneau de 20 ft de diamètre dans une image de 400 px.
    ring: { module: "JB2A_DnD5e", animation: "jb2a.wall_of_fire.ring.yellow", native: 400 },
    sound: { name: "blfx.sound.spell.loop_channel.fire_burning1.1", volume: 0.5, reach: 30 },
    // L'impact du feu, puis la créature qui brûle quelques secondes.
    hit: [
      { animation: "blfx.spell.impact.damage.fire.1.color1", scale: 1.5, sound: "blfx.sound.misc.fire.ignite1.1" },
      { animation: "blfx.misc.fire2.flame.burning.loop.color1", scale: 1.1, delay: 300, duration: 3000 }
    ]
  },
  // Des ronces épineuses sur chaque case ; à chaque blessure, les épines qui griffent.
  "wall-of-thorns": {
    tile: { animation: "blfx.spell.template.square.nature.entangle1.vine_thorn.color1", scale: 1.1 },
    hit: [
      { animation: "blfx.misc.nature.hail_of_thorns1.vine.impact.color1", scale: 1.4 },
      { animation: "blfx.spell.impact.damage.slashing.1.color1", scale: 1.2, delay: 250, sound: "blfx.sound.weapon.melee.sword.slash.attack1" }
    ]
  },
  // Une nuée de lames qui tourbillonne sur chaque case ; à chaque blessure, l'entaille de force.
  "blade-barrier": {
    tile: { animation: "blfx.spell.template.square.cloud.daggers.1.color1", scale: 1 },
    hit: [
      { animation: "blfx.spell.impact.damage.force.1.color1", scale: 1.4, sound: "blfx.sound.weapon.melee.sword.slash.attack2" }
    ]
  }
});
