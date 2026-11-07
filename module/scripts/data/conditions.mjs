/**
 * SPEC §21, lot 3 bis : une animation persistante sur le token tant qu'un état dure (ce qu'Automated Animations faisait par son menu
 * « aefx » ; son seul défaut était Effrayé). Clé = statut dnd5e (`actor.statuses`). Noms JB2A candidats, le premier connu de Sequencer
 * est joué (Premium puis gratuit), comme data/strikes.mjs. Prone, Unconscious, Dead, Invisible et Concentrating ne sont pas animés : le
 * cœur, dnd5e ou DAS · Core les montrent déjà (icône, token couché ou estompé).
 *
 * `blfx: true` : BLFX a une boucle pour cet état (scripts/macros/spell/spellMacro.js, `CONDITION_ANIMATIONS`) qu'il joue quand un sort
 * qu'il reconnaît pose l'état ; avec BLFX actif, on lui laisse ces états-là pour ne pas doubler (réglage `conditionsWithBlfx`).
 */
export const CONDITIONS = Object.freeze({
  frightened: { animation: ["jb2a.markers.fear.dark_purple.03"], scale: 1.6, blfx: true },
  charmed: { animation: ["jb2a.markers.heart.pink.03"], scale: 1.6, blfx: true },
  poisoned: { animation: ["jb2a.markers.poison.dark_green.03"], scale: 1.6, blfx: true },
  stunned: { animation: ["jb2a.markers.stun.purple.03"], scale: 1.6, blfx: true },
  incapacitated: { animation: ["jb2a.dizzy_stars.400px.blueorange"], scale: 1.2, blfx: true },
  paralyzed: { animation: ["jb2a.markers.chain.spectral_standard.loop.02.blue"], scale: 1.5, blfx: true },
  restrained: { animation: ["jb2a.markers.chain.standard.loop.02.red"], scale: 1.5, blfx: true },
  grappled: { animation: ["jb2a.markers.chain.standard.loop.01.red"], scale: 1.4, blfx: true },
  blinded: { animation: ["jb2a.markers.smoke.ring.loop.bluepurple"], scale: 1.4, blfx: true },
  deafened: { animation: ["jb2a.markers.mute.dark_red.03"], scale: 1.6, blfx: true },
  silenced: { animation: ["jb2a.markers.mute.dark_red.03"], scale: 1.6, blfx: true },
  petrified: { animation: ["jb2a.markers.shield_cracked.purple.03"], scale: 1.6, blfx: true },
  cursed: { animation: ["jb2a.markers.skull.purple.03"], scale: 1.6 }
});

/** Préfixe du nom Sequencer des effets d'état de ce module (`darsh-condition-<statut>`), pour les retrouver et les arrêter. */
export const CONDITION_PREFIX = "darsh-condition-";

/** Opacité des boucles d'état (elles restent sous les yeux toute la durée de l'état). */
export const CONDITION_OPACITY = 0.85;
