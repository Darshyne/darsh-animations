/**
 * L'image animée JB2A posée sur le token d'une invocation, à la place de l'illustration du compendium (SPEC §26, demande de
 * baileywiki) : l'Arme spirituelle devient l'arme spectrale animée de JB2A, la Sphère de feu sa sphère, etc. Seul le token posé
 * change, jamais un acteur (runtime/summon-art.mjs).
 *
 * Clé = identifiant dnd5e du sort (celui du Manuel des joueurs 2024) ; `ALIASES` donne l'identifiant du SRD quand il diffère.
 * Une entrée :
 * - `family` : le préfixe Sequencer des variantes. Les variantes proposées au lanceur sont lues À L'EXÉCUTION dans la base de
 *   Sequencer sous ce préfixe : JB2A gratuit en offre quelques-unes, JB2A Premium bien plus, sans qu'aucun nom du Premium soit écrit ici.
 * - `default` : la variante posée d'office (et présélectionnée la première fois). Nom de JB2A GRATUIT, présent aussi dans le Premium.
 * - `scale` : échelle de la texture, en fois la case du token (les fichiers JB2A gardent une marge autour du sujet).
 * - `group` : vrai si le segment qui suit `family` est un choix à part (l'arme de l'Arme spirituelle : masse, épée longue…), proposé
 *   dans une première liste ; la seconde liste donne alors le style et la couleur.
 *
 * Écartés après relevé (SPEC §26.1) : Œil magique (seul `jb2a.eyes.01` existe, des yeux dans le noir, pas un œil magique invisible),
 * Gardien de la foi, Chien de garde, Serviteur invisible, Lumière et Flamme éternelle (rien dans JB2A, gratuit ou Premium).
 */

export const SUMMON_ART = Object.freeze({
  "spiritual-weapon": { family: "jb2a.spiritual_weapon", default: "jb2a.spiritual_weapon.mace.spectral.blue", scale: 2, group: true },
  "mordenkainens-sword": { family: "jb2a.spiritual_weapon", default: "jb2a.spiritual_weapon.longsword.01.spectral.02.green",
    scale: 2, group: true },
  "flaming-sphere": { family: "jb2a.flaming_sphere", default: "jb2a.flaming_sphere.200px.orange.01", scale: 1.2 },
  "bigbys-hand": { family: "jb2a.arcane_hand", default: "jb2a.arcane_hand.blue", scale: 1 },
  "mage-hand": { family: "jb2a.arcane_hand", default: "jb2a.arcane_hand.green", scale: 1.4 },
  "dancing-lights": { family: "jb2a.dancing_light", default: "jb2a.dancing_light.yellow", scale: 1.2 }
});

/** Identifiants du SRD 5.2 (dnd5e) → ceux du Manuel des joueurs, quand ils diffèrent. */
export const SUMMON_ART_ALIASES = Object.freeze({
  "arcane-hand": "bigbys-hand",
  "arcane-sword": "mordenkainens-sword"
});
