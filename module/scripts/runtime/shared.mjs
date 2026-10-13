export const MODULE_ID = "darsh-animations";
export const BLFX = "boss-loot-assets-premium";

export const loc = (key, data) => data ? game.i18n.format(`DARSHANIM.${key}`, data) : game.i18n.localize(`DARSHANIM.${key}`);
export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/**
 * BLFX est-il là pour jouer ? Son module d'assets actif et Sequencer chargé. Sans lui : ni Auto-Rec, ni pièges, ni murs ; les
 * consommables passent par Token Magic FX (runtime/consumables.mjs).
 */
export const blfxActive = () => !!(game.modules.get(BLFX)?.active && globalThis.Sequence);
