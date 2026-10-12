/**
 * Les murs de sort posés par points (le moteur de combat les pose en régions de formes « line », ou en anneau) : une animation en
 * boucle le long du mur, tant que la région est là (runtime/walls.mjs). BLFX ne les joue pas : il ne voit pas de gabarit.
 *
 * Clé : l'identifiant dnd5e du sort. Une entrée a l'une ou l'autre façon de se dessiner :
 *   animations  { longueur en pieds: nom Sequencer } — un mur fin, couché le long de chaque segment : on prend, pour chaque segment,
 *               celle dont la longueur est la plus proche (le pack BLFX a des murs de 10, 20, 30, 60 et 90 ft, à 40 px par pied)
 *     native    la hauteur de l'animation, en pixels (son épaisseur une fois couchée le long du mur)
 *     thickness l'épaisseur de l'image, en cases (la flamme n'en occupe que le milieu : 2 cases donnent un feu d'une demi-case)
 *     ring      facultatif : { animation, fill, module? } — un anneau tout fait (son cercle occupe `fill` de la largeur de l'image),
 *               si son module est actif quand il en nomme un ; sinon des segments
 *   tile        { animation, scale? } — un mur épais, posé sur les cases : cette boucle (carrée) sur chaque case qu'il couvre, à
 *               `scale` fois la case
 *   (ni l'un ni l'autre : rien de dessiné — le Mur prismatique, sans image dans le pack — mais `hit` joue)
 * Et, dans les deux cas :
 *   sound       facultatif : { name, volume, reach } — un son d'ambiance en boucle (nom Sequencer d'un son du pack BLFX) au milieu de
 *               chaque segment, ou au centre de l'anneau, entendu jusqu'à `reach` pieds au-delà du mur
 *   hit         facultatif : sur chaque créature visée par un jet de dégâts du sort (à l'apparition, en traversant, en finissant son tour
 *               dedans ou du côté brûlant) — des parties comme celles des pièges : { animation, scale?, delay?, duration?, sound? }
 */

const thinFire = n => `blfx.spell.template.line.fire_wall.thin.1.color1.loop.width-${n}ft`;
const wind = n => `blfx.spell.template.line.wind_wall1.loop.width-${n}ft`;
const frost = n => `blfx.spell.template.line.ice.frost.ground1.color01.${n}ft`;
const impact = type => `blfx.spell.impact.damage.${type}.1.color1`;

export const WALLS = Object.freeze({
  "wall-of-fire": {
    // Le mur de feu fin du pack 1.0.31 (fait pour ce sort) ; l'anneau de feu, à la mesure de l'anneau.
    animations: { 10: thinFire(10), 20: thinFire(20), 30: thinFire(30), 60: thinFire(60) },
    native: 400,
    thickness: 2,
    // Le cercle de flammes de l'image est à 346 px du centre sur 600 (mesuré sur une image de la vidéo) : 58 % de sa largeur.
    ring: { animation: "blfx.spell.template.circle.fire.ring.1.loop.color1", fill: 0.58 },
    sound: { name: "blfx.sound.spell.loop_channel.fire_burning1.1", volume: 0.5, reach: 30 },
    // L'impact du feu, puis la créature qui brûle quelques secondes.
    hit: [
      { animation: "blfx.spell.impact.damage.fire.1.color1", scale: 1.5, sound: "blfx.sound.misc.fire.ignite1.1" },
      { animation: "blfx.misc.fire2.flame.burning.loop.color1", scale: 1.1, delay: 300, duration: 3000 }
    ]
  },
  // Le mur de vent du pack, couché le long du mur ; à l'apparition, la bourrasque qui frappe.
  "wind-wall": {
    animations: { 10: wind(10), 20: wind(20), 30: wind(30), 60: wind(60) },
    native: 400,
    thickness: 2,
    hit: [{ animation: impact("bludgeoning"), scale: 1.4 }]
  },
  // Du givre au sol, le long du mur ; à l'apparition, le froid qui saisit.
  "wall-of-ice": {
    animations: { 5: frost("05"), 15: frost(15), 30: frost(30), 60: frost(60), 90: frost(90) },
    native: 400,
    thickness: 1,   // le givre remplit toute l'image (le feu n'en occupe que le milieu) : une case
    hit: [{ animation: impact("cold"), scale: 1.5, sound: "blfx.sound.misc.frost_ice.imapact.explosion.1" }]
  },
  // Mur prismatique : pas d'image dans le pack (sa lumière et sa zone d'aveuglement se voient) ; à la traversée, les cinq couleurs.
  "prismatic-wall": {
    hit: ["fire", "acid", "lightning", "poison", "cold"].map((type, i) => ({ animation: impact(type), scale: 1.4, delay: i * 250 }))
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
