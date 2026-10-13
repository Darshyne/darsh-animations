/**
 * Les effets de zone en Token Magic FX (SPEC §15) : quand BLFX n'est pas là, ou qu'il ne reconnaît pas le sort, la zone posée
 * (Mains brûlantes, Boule de feu, Rayon de lune…) reçoit un préréglage de **région** de Token Magic FX, choisi par le **type de
 * dégâts** de l'activité, sinon par l'identifiant dnd5e du sort (zones sans dégâts : brouillard, toile…).
 *
 * `preset` : un nom de la bibliothèque `tmfx-region` de Token Magic FX 0.8.4 (fx/presets/defaultpresets.js) ; `tint` : la teinte
 * (#rrggbb) ; `opacity` : l'opacité de la région (0–1).
 */

/** Par type de dégâts dnd5e (CONFIG.DND5E.damageTypes), plus `healing` pour une zone qui soigne. */
export const BY_DAMAGE = Object.freeze({
  acid: { preset: "Watery Surface 2", tint: "#4fbf1a", opacity: 0.6 },
  bludgeoning: { preset: "Waves 2", tint: "#b08a60", opacity: 0.5 },
  cold: { preset: "Zone : Blizzard", tint: "#8fd0ff", opacity: 0.6 },
  fire: { preset: "Zone : Fire", tint: null, opacity: 0.8 },
  force: { preset: "Waves 3", tint: "#b06bff", opacity: 0.6 },
  lightning: { preset: "Zone : Electricity", tint: "#9fd8ff", opacity: 0.7 },
  necrotic: { preset: "Smoke Filaments", tint: "#502673", opacity: 0.6 },
  piercing: { preset: "Waves", tint: "#c8c8c8", opacity: 0.4 },
  poison: { preset: "Smoky Area", tint: "#5fbf2a", opacity: 0.6 },
  psychic: { preset: "Classic Rays", tint: "#c060ff", opacity: 0.5 },
  radiant: { preset: "Annihilating Rays", tint: "#fff2a0", opacity: 0.6 },
  slashing: { preset: "Waves 2", tint: "#d06060", opacity: 0.4 },
  thunder: { preset: "Waves", tint: "#4080ff", opacity: 0.6 },
  healing: { preset: "Classic Rays", tint: "#60e090", opacity: 0.4 }
});

/** Par identifiant de sort : les zones sans dégâts, ou dont le dégât ne dit pas l'allure. */
export const BY_IDENTIFIER = Object.freeze({
  "web": { preset: "Spider Web 2", tint: "#d0d0d0", opacity: 0.6 },
  "fog-cloud": { preset: "Thick Fog", tint: "#e0e0e0", opacity: 0.8 },
  "stinking-cloud": { preset: "Smoky Area", tint: "#9ab020", opacity: 0.7 },
  "cloudkill": { preset: "Smoky Area", tint: "#7fbf2a", opacity: 0.7 },
  "incendiary-cloud": { preset: "Smoky Area", tint: "#ff7030", opacity: 0.7 },
  "grease": { preset: "Watery Surface", tint: "#6b4a1f", opacity: 0.6 },
  "sleet-storm": { preset: "Zone : Blizzard", tint: "#c0e4ff", opacity: 0.7 },
  "ice-storm": { preset: "Zone : Blizzard", tint: "#c0e4ff", opacity: 0.7 },
  "entangle": { preset: "Protoplasm", tint: "#3f8f2a", opacity: 0.5 },
  "plant-growth": { preset: "Protoplasm", tint: "#3f8f2a", opacity: 0.5 },
  "spike-growth": { preset: "Protoplasm", tint: "#6f7f2a", opacity: 0.5 },
  "faerie-fire": { preset: "Bloomed Texture", tint: "#c080ff", opacity: 0.5 },
  "silence": { preset: "Waves 2", tint: "#a0a0c0", opacity: 0.3 },
  "hunger-of-hadar": { preset: "Smoke Filaments", tint: "#200030", opacity: 0.8 },
  "moonbeam": { preset: "Annihilating Rays", tint: "#d0e8ff", opacity: 0.6 },
  "spirit-guardians": { preset: "Classic Rays", tint: "#fff2a0", opacity: 0.4 },
  "insect-plague": { preset: "Smoky Area", tint: "#4a3a20", opacity: 0.7 },
  "evards-black-tentacles": { preset: "Smoke Filaments", tint: "#101010", opacity: 0.7 }
});

/** Combien de temps, au moins, l'effet reste visible : une zone instantanée (Mains brûlantes) est retirée vite par le moteur. */
export const MIN_VISIBLE_MS = 3000;
