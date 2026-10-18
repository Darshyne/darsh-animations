/**
 * Le rendu des effets que ce module joue lui-même (consommables, pièges, murs de sort, zones) : BLFX > JB2A + PSFX > Token Magic FX
 * > rendu autonome (décisions utilisateur, 2026-10-13 et 2026-10-18). Réglage de monde `renderer` ; « auto » prend le premier
 * disponible. L'Auto-Rec reste à BLFX seul ; Automated Animations joue lui-même ce qu'il reconnaît (runtime/aa.mjs).
 */

import { MODULE_ID, blfxActive, jb2aActive } from "./shared.mjs";
import { pickBackend } from "../core/consumables.mjs";

export const TOKENMAGIC = "tokenmagic";

export const tokenMagicActive = () => !!(game.modules.get(TOKENMAGIC)?.active && globalThis.TokenMagic);

/** Le rendu en vigueur : "blfx", "jb2a", "tokenmagic", "native", ou null (« none »). `setting` : pour forcer (aperçu). */
export function renderer(setting=game.settings.get(MODULE_ID, "renderer")) {
  return pickBackend(setting, { blfx: blfxActive(), jb2a: jb2aActive(), tokenmagic: tokenMagicActive() });
}

export function registerRenderer() {
  game.settings.register(MODULE_ID, "renderer", {
    name: "DARSHANIM.Settings.Renderer.Name", hint: "DARSHANIM.Settings.Renderer.Hint",
    scope: "world", config: true, type: String, default: "auto",
    choices: {
      auto: "DARSHANIM.Settings.Renderer.Auto",
      blfx: "DARSHANIM.Settings.Renderer.Blfx",
      jb2a: "DARSHANIM.Settings.Renderer.Jb2a",
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
