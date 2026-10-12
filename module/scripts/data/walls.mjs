/**
 * Les murs de sort posés par points (le moteur de combat les pose en régions de formes « line », ou en anneau) : une animation en
 * boucle le long de chaque segment, tant que la région est là (runtime/walls.mjs). BLFX ne les joue pas : il ne voit pas de gabarit.
 *
 * Clé : l'identifiant dnd5e du sort. Une entrée :
 *   animations  { longueur en pieds: nom Sequencer } — on prend, pour chaque segment, celle dont la longueur est la plus proche
 *               (le pack BLFX a des murs de 10, 20, 30, 60 et 90 ft, à 40 px par pied, 400 px d'épaisseur)
 *   native      la hauteur de l'animation, en pixels (son épaisseur une fois couchée le long du mur)
 *   thickness   l'épaisseur de l'image, en cases (la flamme n'en occupe que le milieu : 2 cases donnent un feu d'une demi-case)
 *   ring        facultatif : { module, animation, native } — un anneau tout fait, si ce module est actif ; sinon l'anneau est fait
 *               de segments
 *   sound       facultatif : { name, volume, reach } — un son d'ambiance en boucle (nom Sequencer d'un son du pack BLFX) au milieu de
 *               chaque segment, ou au centre de l'anneau, entendu jusqu'à `reach` pieds au-delà du mur
 */

const fireWall = n => `blfx.spell.template.line.wall_of_fire1.loop.orange.width-${n}ft`;

export const WALLS = Object.freeze({
  "wall-of-fire": {
    animations: { 10: fireWall(10), 20: fireWall(20), 30: fireWall(30), 60: fireWall(60), 90: fireWall(90) },
    native: 400,
    thickness: 2,
    // JB2A (gratuit), anneau de 20 ft de diamètre dans une image de 400 px.
    ring: { module: "JB2A_DnD5e", animation: "jb2a.wall_of_fire.ring.yellow", native: 400 },
    sound: { name: "blfx.sound.spell.loop_channel.fire_burning1.1", volume: 0.5, reach: 30 }
  }
});
