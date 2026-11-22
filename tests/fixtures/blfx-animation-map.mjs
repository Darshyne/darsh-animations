/** Un extrait minimal de l'`ANIMATION_MAP` de BLFX (scripts/animationMap.js) pour les tests : un sort qu'il reconnaît. */
export const ANIMATION_MAP = {
  dnd5e: {
    spell: {
      "detect-magic": { afterActiveEffects: { macro: null, defaultParams: {} } }
    }
  }
};
