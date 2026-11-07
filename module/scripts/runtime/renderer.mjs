/**
 * Le rendu des consommables : la source du domaine « consumables » dans la fenêtre « Sources d'animation » (runtime/sources.mjs,
 * SPEC §23), par défaut BLFX > JB2A + PSFX > Token Magic FX > rendu autonome (décisions utilisateur, 2026-10-13 et 2026-10-18). Les
 * autres domaines lisent leur propre source (`pick(domaine)`). L'ancien réglage `renderer` reste déclaré, caché : il ne sert plus qu'à
 * tirer la valeur de départ de la fenêtre.
 */

import { MODULE_ID, blfxActive, jb2aActive } from "./shared.mjs";
import { pickBackend } from "../core/consumables.mjs";
import { pick, sourcesSetting } from "./sources.mjs";

export const TOKENMAGIC = "tokenmagic";

export const tokenMagicActive = () => !!(game.modules.get(TOKENMAGIC)?.active && globalThis.TokenMagic);

/** Le rendu des consommables : "blfx", "jb2a", "tokenmagic", "native", ou null (domaine coupé). `setting` : un ancien nom, pour forcer. */
export function renderer(setting=null) {
  if ( setting ) return pickBackend(setting, { blfx: blfxActive(), jb2a: jb2aActive(), tokenmagic: tokenMagicActive() });
  return pick("consumables");
}

export function registerRenderer() {
  game.settings.register(MODULE_ID, "renderer", {
    name: "DARSHANIM.Settings.Renderer.Name", hint: "DARSHANIM.Settings.Renderer.Hint",
    scope: "world", config: false, type: String, default: "auto",
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

/**
 * Pour les scénarios : sans argument, rend la valeur des sources ; avec `value` (un ancien nom de rendu, « auto », « blfx »…, ou une
 * valeur rendue plus tôt), l'applique et rend l'ancienne (runtime/sources.mjs).
 */
export const rendererSetting = args => sourcesSetting(args);
