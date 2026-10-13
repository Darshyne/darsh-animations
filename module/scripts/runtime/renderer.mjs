/**
 * Le rendu des effets que ce module joue lui-même (consommables, pièges) : BLFX > Token Magic FX > rendu autonome (décision
 * utilisateur, 2026-10-13). Réglage de monde `renderer` ; « auto » prend le premier disponible. Les murs de sort et l'Auto-Rec
 * restent à BLFX seul : les murs du moteur sont déjà de vrais murs de Foundry, visibles sans animation.
 */

import { MODULE_ID, blfxActive } from "./shared.mjs";
import { pickBackend } from "../core/consumables.mjs";

export const TOKENMAGIC = "tokenmagic";

export const tokenMagicActive = () => !!(game.modules.get(TOKENMAGIC)?.active && globalThis.TokenMagic);

/** Le rendu en vigueur : "blfx", "tokenmagic", "native", ou null (« none »). `setting` : pour forcer (aperçu). */
export function renderer(setting=game.settings.get(MODULE_ID, "renderer")) {
  return pickBackend(setting, { blfx: blfxActive(), tokenmagic: tokenMagicActive() });
}

export function registerRenderer() {
  game.settings.register(MODULE_ID, "renderer", {
    name: "DARSHANIM.Settings.Renderer.Name", hint: "DARSHANIM.Settings.Renderer.Hint",
    scope: "world", config: true, type: String, default: "auto",
    choices: {
      auto: "DARSHANIM.Settings.Renderer.Auto",
      blfx: "DARSHANIM.Settings.Renderer.Blfx",
      tokenmagic: "DARSHANIM.Settings.Renderer.TokenMagic",
      native: "DARSHANIM.Settings.Renderer.Native",
      none: "DARSHANIM.Settings.Renderer.None"
    }
  });
}

/** Pour les scénarios : change le réglage (MJ), rend l'ancienne valeur. */
export async function rendererSetting({ value }={}) {
  const before = game.settings.get(MODULE_ID, "renderer");
  if ( value ) await game.settings.set(MODULE_ID, "renderer", value);
  return before;
}
