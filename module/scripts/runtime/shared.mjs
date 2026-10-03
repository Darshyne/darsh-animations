export const MODULE_ID = "darsh-animations";
export const BLFX = "boss-loot-assets-premium";

export const loc = (key, data) => data ? game.i18n.format(`DARSHANIM.${key}`, data) : game.i18n.localize(`DARSHANIM.${key}`);
export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
