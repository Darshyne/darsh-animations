/**
 * darsh-dnd · Animations : la table d'animations (data/animations.mjs, plus celles que d'autres modules enregistrent —
 * runtime/registry.mjs) versée dans l'Auto-Rec personnalisée de BLFX. Le module ne joue rien lui-même en partie : c'est BLFX
 * qui déclenche, avec ses propres hooks — sauf les pièges, que BLFX ne sait pas jouer sans token (runtime/traps.mjs), et les murs
 * de sort posés par points, qu'il ne voit pas (runtime/walls.mjs), et les potions et consommables, qu'il ne reconnaît pas et qui doivent
 * aussi s'animer sans lui (runtime/consumables.mjs), et les zones de sort qu'il n'anime pas, en Token Magic FX (runtime/areas.mjs). Ce que ce module joue lui-même passe par BLFX, sinon Token Magic FX, sinon un
 * rendu autonome (runtime/renderer.mjs, runtime/native.mjs) — avec, entre BLFX et Token Magic FX, JB2A gratuit et les sons de PSFX.
 * Automated Animations reconnaît les objets dans toutes les langues, et se tait devant BLFX (runtime/aa.mjs). Les châtiments que DAS · Core
 * ajoute à une attaque d'arme jouent l'animation BLFX de leur sort (runtime/smites.mjs). BLFX est recommandé,
 * pas requis.
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
import { castingEffects, previewCancelledCast, registerCasting } from "./runtime/casting.mjs";
import { aaPlays, aaResolve, addNames, registerAA } from "./runtime/aa.mjs";
import { playSmite, registerSmites } from "./runtime/smites.mjs";
import { playDoor, previewDoor, registerDoors } from "./runtime/doors.mjs";

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
    areaState, drawArea: args => drawArea(canvas.scene?.regions.get(args?.regionId ?? args)),
    // Incantation BLFX d'un sort à zone dont la pose est annulée : arrêtée (runtime/casting.mjs). Pour les scénarios.
    previewCancelledCast, castingEffects,
    // Châtiments ajoutés par DAS · Core à une attaque : l'animation BLFX du sort (runtime/smites.mjs). `playSmite({ item, target })`.
    playSmite: smite => playSmite(smite),
    // Serrures de porte de DAS · Core (hooks `noise` et `doorUnlocked`) : `previewDoor({ wallId, moment })` pour vérifier.
    playDoor, previewDoor,
    // Automated Animations : `aaResolve({ item, activity, isTemplate })` (ce qu'il trouvera), `aaNames(map)` (noms d'une langue
    // sans table, ou d'objets maison : nom local → nom anglais).
    aaResolve, aaNames: addNames, aaPlays: async ({ item, activity=null, isTemplate=false }={}) => {
      const doc = await fromUuid(item);
      return aaPlays(doc, { activity: activity ? doc?.system?.activities?.get(activity) : null, isTemplate });
    } };
  // `mcp` : ce que le connecteur MCP appelle par `call-module-api`, comme pour le moteur de combat.
  game.modules.get(MODULE_ID).api = { ...api, mcp: api };
  registerRenderer();
  registerNative();
  registerTraps();
  registerWalls();
  registerConsumables();
  registerAreas();
  registerCasting();
  registerAA();
  registerSmites();
  registerDoors();
});

// Après tous les `init` : les autres modules donnent leurs tables par le hook `darsh-animations.register`.
Hooks.once("setup", collectRegistrations);

Hooks.once("ready", () => {
  // BLFX enregistre ses écouteurs au `init` : à `ready`, il entend notre hook.
  sync().catch(err => console.error(`${MODULE_ID} | sync failed`, err));
});
