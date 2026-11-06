/**
 * L'apparition d'une créature invoquée quand BLFX n'est pas là (issue dnd5e-combat#38) : avec BLFX, c'est son Auto-Rec (« After
 * Summon ») qui l'anime — ses propres entrées, et les nôtres pour les sorts qu'il ne connaît pas (data/animations.mjs). Sans lui,
 * JB2A gratuit (+ les sons de PSFX s'il est actif) : un cercle de conjuration sous la créature, puis un éclat (runtime/summons.mjs).
 *
 * Une partie : `animation` (nom Sequencer ; un groupe vaut), `sound` facultatif, `scale` (fois la taille du token, défaut 1),
 * `delay` (ms), `below` (sous les tokens).
 */

export const JB2A_SUMMON = Object.freeze([
  { animation: "jb2a.magic_signs.circle.02.conjuration.complete.yellow", scale: 1.6, below: true,
    sound: "psfx.2nd-level-spells.misty-step.v1.complete.generic" },
  { animation: "jb2a.impact.006.yellow", scale: 1.2, delay: 900 }
]);
