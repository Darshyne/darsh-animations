/**
 * darsh-dnd · Animations : la table d'animations (data/animations.mjs, plus celles que d'autres modules enregistrent —
 * runtime/registry.mjs) versée dans l'Auto-Rec personnalisée de BLFX. Le module ne joue rien lui-même en partie : c'est BLFX
 * qui déclenche, avec ses propres hooks — sauf les pièges, que BLFX ne sait pas jouer sans token (runtime/traps.mjs), et les murs
 * de sort posés par points, qu'il ne voit pas (runtime/walls.mjs), et les potions et consommables, qu'il ne reconnaît pas et qui doivent
 * aussi s'animer sans lui (runtime/consumables.mjs), et les zones de sort qu'il n'anime pas, en Token Magic FX (runtime/areas.mjs). Ce que ce module joue lui-même passe par BLFX, sinon Token Magic FX, sinon un
 * rendu autonome (runtime/renderer.mjs, runtime/native.mjs). BLFX est recommandé, pas requis.
 */

import { MODULE_ID } from "./runtime/shared.mjs";
import { collectItems, currentSignature, sync } from "./runtime/sync.mjs";
import { preview, previewAll } from "./runtime/preview.mjs";
import { startRecording, stopRecording } from "./runtime/recorder.mjs";
import { animations, collectRegistrations, register, registered } from "./runtime/registry.mjs";
import { playTrap, previewTrap, registerTraps } from "./runtime/traps.mjs";
import { drawWall, registerWalls } from "./runtime/walls.mjs";
import { previewConsumable, registerConsumables } from "./runtime/consumables.mjs";
import { registerRenderer, renderer, rendererSetting } from "./runtime/renderer.mjs";
import { registerNative } from "./runtime/native.mjs";
import { areaState, drawArea, registerAreas } from "./runtime/areas.mjs";

Hooks.once("init", () => {
  // La dernière table versée (empreinte) : on ne revient vers BLFX que si elle a changé.
  game.settings.register(MODULE_ID, "applied", { scope: "world", config: false, type: String, default: "" });
  const api = { sync, preview, previewAll, startRecording, stopRecording, collectItems, signature: currentSignature,
    // Les animations d'autres modules (voir runtime/registry.mjs) : `register(source, { animations, without, sources })`.
    register, registered, table: animations,
    // Pièges : joués par nous au hook `darsh-loot.trapFired` ; `previewTrap({ actor, regionId, targets })` pour vérifier.
    playTrap, previewTrap,
    // Murs de sort posés par points (Mur de feu) : joués par nous tant que leur région est là ; `drawWall(regionId)` pour vérifier.
    drawWall: args => drawWall(canvas.scene?.regions.get(args?.regionId ?? args)),
    // Potions et consommables : joués par nous à la carte d'utilisation (réglage « renderer » : BLFX > Token Magic FX > autonome).
    previewConsumable, renderer: () => renderer(),
    // Pour les scénarios : change le réglage « renderer » (MJ), rend l'ancienne valeur.
    rendererSetting,
    // Zones de sort sans BLFX (ou qu'il ne reconnaît pas) : effet Token Magic par type de dégâts sur une région compagne.
    areaState, drawArea: args => drawArea(canvas.scene?.regions.get(args?.regionId ?? args)) };
  // `mcp` : ce que le connecteur MCP appelle par `call-module-api`, comme pour le moteur de combat.
  game.modules.get(MODULE_ID).api = { ...api, mcp: api };
  registerRenderer();
  registerNative();
  registerTraps();
  registerWalls();
  registerConsumables();
  registerAreas();
});

// Après tous les `init` : les autres modules donnent leurs tables par le hook `darsh-animations.register`.
Hooks.once("setup", collectRegistrations);

Hooks.once("ready", () => {
  // BLFX enregistre ses écouteurs au `init` : à `ready`, il entend notre hook.
  sync().catch(err => console.error(`${MODULE_ID} | sync failed`, err));
});
