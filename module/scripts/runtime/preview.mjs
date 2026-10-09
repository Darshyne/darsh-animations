/**
 * Jouer une animation de la table sans passer par un jet : pour la choisir et la vérifier en jeu (MJ, ou connecteur MCP
 * par `call-module-api`). Même portée que celle que BLFX donne à une macro d'Auto-Rec personnalisée
 * (BlfxMacroExecutor.executeMacro : une macro de script temporaire, les clés du contexte comme variables).
 *
 * Une animation de zone (`createTemplate`) se joue sur une région : l'aperçu en pose une temporaire de la forme du modèle (cercle
 * autour de la source, cône ou ligne vers la première cible), puis la retire. Ce qui est réellement joué est relevé
 * (runtime/recorder.mjs).
 */

import { aliasCommand, applyParams } from "../core/blfx.mjs";
import { animations } from "./registry.mjs";
import { loadTemplates } from "./sync.mjs";
import { startRecording, stopRecording } from "./recorder.mjs";
import { loc } from "./shared.mjs";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Un token par uuid, id ou nom, sur la scène affichée. */
function tokenOf(ref) {
  if ( !ref ) return null;
  if ( ref instanceof foundry.canvas.placeables.Token ) return ref;
  const byUuid = String(ref).includes(".") ? fromUuidSync(ref)?.object : null;
  return byUuid ?? canvas.tokens.get(ref) ?? canvas.tokens.placeables.find(t => t.name === ref) ?? null;
}

/** La région temporaire d'une animation de zone : la forme du modèle, de la source vers la cible. */
async function temporaryRegion(template, sourceToken, target) {
  const size = canvas.grid.size;
  const { x, y } = sourceToken.center;
  const to = target?.center ?? { x: x + size, y };
  const rotation = Math.toDegrees(Math.atan2(to.y - y, to.x - x));
  const shapes = {
    circle: [{ type: "circle", x, y, radius: size * 2 }],
    square: [{ type: "rectangle", x: x - size, y: y - size, width: size * 2, height: size * 2 }],
    cone: [{ type: "cone", x, y, radius: size * 6, angle: 53.13, rotation }],
    line: [{ type: "line", x, y, length: size * 6, width: size, rotation }]
  }[template];
  if ( !shapes ) return null;
  const ft = canvas.scene.grid.distance;
  const [region] = await canvas.scene.createEmbeddedDocuments("Region", [{
    name: loc("Preview.Region"), shapes, visibility: CONST.REGION_VISIBILITY.ALWAYS,
    ...(canvas.level?.id ? { levels: [canvas.level.id] } : {}),
    flags: { dnd5e: { dimensions: { size: (template === "circle" ? 2 : 6) * ft, width: ft, units: canvas.scene.grid.units } } }
  }]);
  return region ?? null;
}

/**
 * @param {object} args
 * @param {string} args.identifier         Une clé de la table.
 * @param {number} [args.index=0]          L'animation de la liste à jouer.
 * @param {string} args.source             Le token d'où part l'animation.
 * @param {string[]} [args.targets=[]]     Les tokens visés.
 * @returns {Promise<object>}  Ce qui a été joué (fichiers d'effets et de sons), ou l'erreur.
 */
export async function preview({ identifier, index=0, source, targets=[] }={}) {
  const animation = animations()[identifier]?.[index];
  if ( !animation ) return { error: `no animation ${index} for "${identifier}"` };
  const sourceToken = tokenOf(source);
  if ( !sourceToken ) return { error: `source token not found: ${source}` };
  const targetTokens = targets.map(tokenOf).filter(Boolean);
  let region = null;
  startRecording();
  try {
    const command = animation.alias
      ? aliasCommand(animation.alias, animation.aliasTrigger ?? animation.trigger)
      : applyParams((await loadTemplates())[animation.template], animation.params);
    // L'item réel (sur l'acteur source, sinon le premier acteur du monde qui l'a) : des macros de BLFX lisent l'item ou
    // l'activité (`playOnlyForActivityType`).
    const own = actor => actor?.items.find(i => i.system.identifier === identifier);
    const item = own(sourceToken.actor) ?? game.actors.find(own)?.items.find(i => i.system.identifier === identifier) ?? null;
    const activity = item?.system.activities?.find(a => !animation.activity || (a.type === animation.activity)) ?? null;
    if ( animation.trigger === "createTemplate" ) region = await temporaryRegion(animation.template ?? "circle", sourceToken, targetTokens[0]);
    const macro = new CONFIG.Macro.documentClass({ name: "darsh-animations preview", type: "script",
      command: `return await (async () => {\n${command}\n})();` });
    await macro.execute({ sourceToken, targetTokens, templateDocument: region, item, roll: undefined, activity, effect: null, data: null });
    await pause(400);
    return { played: identifier, index, trigger: animation.trigger, source: sourceToken.name, targets: targetTokens.map(t => t.name),
      ...stopRecording() };
  } catch(err) {
    return { identifier, index, error: err.message, ...stopRecording() };
  } finally {
    if ( region && canvas.scene.regions.has(region.id) ) await region.delete().catch(() => null);
  }
}

/** Toute la table, entrée par entrée : ce qui a été joué, ou l'erreur. */
export async function previewAll({ source, targets=[], only=null, gap=600 }={}) {
  const report = [];
  for ( const [identifier, list] of Object.entries(animations()) ) {
    if ( only && !only.some(o => identifier.includes(o)) ) continue;
    for ( let index = 0; index < list.length; index++ ) {
      const r = await preview({ identifier, index, source, targets });
      report.push({ identifier, index, trigger: list[index].trigger, effects: r.effects?.length ?? 0, sounds: r.sounds?.length ?? 0,
        files: [...(r.effects ?? []), ...(r.sounds ?? [])].filter(Boolean).map(f => String(f).split("/").pop()).slice(0, 4), error: r.error ?? null });
      await pause(gap);
    }
  }
  return report;
}
