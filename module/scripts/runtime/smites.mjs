/**
 * SPEC §18 : l'animation BLFX d'un châtiment que DAS · Core a ajouté à une attaque d'arme (issue GitHub #1, Châtiment divin). Le
 * moteur ajoute les dés du sort au jet de dégâts de l'arme et note le châtiment sur la carte de dégâts :
 * `flags.dnd5e-combat.smite = { item, target, name, … }` (uuid de l'objet du châtiment, uuid du token visé ; dnd5e-combat,
 * runtime/smite.mjs, `onPreRollDamage`). BLFX ne voit que l'arme : à la création de cette carte, le client qui a fait le jet joue
 * l'animation « après les dégâts » que BLFX a pour le sort (`ANIMATION_MAP`), avec ses paramètres — Sequencer la diffuse à tous.
 * Les effets que le sort pose ensuite (Ardent, Aveuglé…) restent à BLFX, qui les voit (`afterActiveEffects`).
 * Sans animation BLFX pour ce sort (BLFX absent, Auto-Rec coupée, rien « après les dégâts ») : Automated Animations, par son API
 * publique, s'il a une entrée pour le sort (issue GitHub #5, SPEC §18 bis). Jamais les deux.
 */
import { BLFX, MODULE_ID, aaActive, blfxActive, log } from "./shared.mjs";
import { ANIMATION_MAP_PATH } from "../core/blfx.mjs";
import { smiteAnimation, smiteBackend } from "../core/smites.mjs";
import { SMITE_MARK, aaOverrideNames, aaPlays } from "./aa.mjs";

const ENGINE = "dnd5e-combat";
let map = null;

async function animationMap() {
  if ( map ) return map;
  try { map = (await import(foundry.utils.getRoute(ANIMATION_MAP_PATH)))?.ANIMATION_MAP ?? null; }
  catch(err) { log("BLFX animation map unreadable", err); map = null; }
  return map;
}

/** BLFX joue-t-il ses propres animations (Auto-Rec allumée) ? */
function blfxAutoRec() {
  try { return game.settings.get(BLFX, "blfxAutoRecognition") !== false; } catch { return true; }
}

/** Joue l'animation de ce châtiment : BLFX, sinon Automated Animations. Rend ce qui a été joué, ou la raison de ne rien jouer. */
export async function playSmite(smite, { roll=null }={}) {
  const blfxOn = blfxActive() && blfxAutoRec();
  if ( !blfxOn && !aaActive() ) return { skipped: "neither BLFX nor Automated Animations active" };
  const item = smite?.item ? await fromUuid(smite.item).catch(() => null) : null;
  if ( !item ) return { skipped: "smite item not found" };
  const label = item.system?.identifier || item.name;
  const activity = item.system?.activities?.find?.(a => a.type === "damage") ?? item.system?.activities?.contents?.[0] ?? null;
  const anim = blfxOn
    ? smiteAnimation(await animationMap(), { type: item.type, name: item.name, identifier: item.system?.identifier })
    : null;
  const backend = smiteBackend({ blfx: !!anim, aa: !anim && aaPlays(item, { activity, ignoreBlfx: true }) });
  if ( !backend ) return { skipped: `no BLFX or Automated Animations animation for ${label}` };
  const sourceToken = item.actor?.getActiveTokens(true)[0] ?? null;
  const target = smite.target ? await fromUuid(smite.target).catch(() => null) : null;
  const targetTokens = target?.object ? [target.object] : [];
  if ( !sourceToken ) return { skipped: "caster token not on this scene" };
  if ( backend === "blfx" ) {
    await anim.macro({ sourceToken, targetTokens, templateDocument: null, item, roll, activity, effect: null, data: null,
      ...(anim.defaultParams ?? {}) });
  } else {
    // API publique d'AA (7.1.x) : elle ne passe pas par `aa.getRequiredData`, d'où les noms anglais donnés ici (runtime/aa.mjs).
    await globalThis.AutomatedAnimations.playAnimation(sourceToken, item, {
      targets: targetTokens, hitTargets: targetTokens, hit: true, activity,
      overrideNames: aaOverrideNames(item, activity), [SMITE_MARK]: true
    });
  }
  log(`smite animation (${backend}): ${item.name} → ${targetTokens.map(t => t.name).join(", ") || "no target"}`);
  return { played: label, by: backend, source: sourceToken.name, targets: targetTokens.map(t => t.name) };
}

function onCreateMessage(message) {
  const smite = message.getFlag?.(ENGINE, "smite");
  if ( !smite?.item || !message.isAuthor ) return;
  playSmite(smite, { roll: message.rolls?.[0] ?? null }).catch(err => console.error(`${MODULE_ID} | smite animation`, err));
}

export function registerSmites() {
  Hooks.on("createChatMessage", onCreateMessage);
}
