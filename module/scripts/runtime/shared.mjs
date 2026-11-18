export const MODULE_ID = "darsh-animations";
export const BLFX = "boss-loot-assets-premium";
/** JB2A gratuit et Patreon : le même préfixe « jb2a » dans Sequencer (le gratuit ne l'enregistre pas quand le Patreon est actif). */
export const JB2A = Object.freeze(["JB2A_DnD5e", "jb2a_patreon"]);
/** PSFX gratuit et Patreon : deux modules pour les mêmes sons (issue #10 : le Patreon s'installe sous `psfx-patreon`). */
export const PSFX = Object.freeze(["psfx", "psfx-patreon"]);
export const AA = "autoanimations";

export const loc = (key, data) => data ? game.i18n.format(`DARSHANIM.${key}`, data) : game.i18n.localize(`DARSHANIM.${key}`);
export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/**
 * BLFX est-il là pour jouer ? Son module d'assets actif et Sequencer chargé. Sans lui : pas d'Auto-Rec ; le reste passe au rendu
 * suivant (runtime/renderer.mjs).
 */
export const blfxActive = () => !!(game.modules.get(BLFX)?.active && globalThis.Sequence);

/** JB2A (gratuit ou Patreon) actif, et Sequencer chargé. Les sons PSFX sont un plus : sans eux, les animations jouent sans son. */
export const jb2aActive = () => !!(JB2A.some(id => game.modules.get(id)?.active) && globalThis.Sequence);
export const psfxActive = () => !!(PSFX.some(id => game.modules.get(id)?.active) && globalThis.Sequence);

/** Automated Animations actif. */
export const aaActive = () => !!(game.modules.get(AA)?.active && globalThis.AutomatedAnimations);
