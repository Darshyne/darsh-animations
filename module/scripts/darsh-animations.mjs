/**
 * darsh-dnd · Animations : la table d'animations (data/animations.mjs, plus celles que d'autres modules enregistrent —
 * runtime/registry.mjs) versée dans l'Auto-Rec personnalisée de BLFX. Le module ne joue rien lui-même en partie : c'est BLFX
 * qui déclenche, avec ses propres hooks — sauf les pièges, que BLFX ne sait pas jouer sans token (runtime/traps.mjs).
 */

import { MODULE_ID } from "./runtime/shared.mjs";
import { collectItems, currentSignature, sync } from "./runtime/sync.mjs";
import { preview, previewAll } from "./runtime/preview.mjs";
import { startRecording, stopRecording } from "./runtime/recorder.mjs";
import { animations, collectRegistrations, register, registered } from "./runtime/registry.mjs";
import { playTrap, previewTrap, registerTraps } from "./runtime/traps.mjs";

Hooks.once("init", () => {
  // La dernière table versée (empreinte) : on ne revient vers BLFX que si elle a changé.
  game.settings.register(MODULE_ID, "applied", { scope: "world", config: false, type: String, default: "" });
  const api = { sync, preview, previewAll, startRecording, stopRecording, collectItems, signature: currentSignature,
    // Les animations d'autres modules (voir runtime/registry.mjs) : `register(source, { animations, without, sources })`.
    register, registered, table: animations,
    // Pièges : joués par nous au hook `darsh-loot.trapFired` ; `previewTrap({ actor, regionId, targets })` pour vérifier.
    playTrap, previewTrap };
  // `mcp` : ce que le connecteur MCP appelle par `call-module-api`, comme pour le moteur de combat.
  game.modules.get(MODULE_ID).api = { ...api, mcp: api };
  registerTraps();
});

// Après tous les `init` : les autres modules donnent leurs tables par le hook `darsh-animations.register`.
Hooks.once("setup", collectRegistrations);

Hooks.once("ready", () => {
  // BLFX enregistre ses écouteurs au `init` : à `ready`, il entend notre hook.
  sync().catch(err => console.error(`${MODULE_ID} | synchronisation impossible`, err));
});
