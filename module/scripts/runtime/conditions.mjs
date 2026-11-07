/**
 * SPEC §21, lot 3 bis : une boucle JB2A sur le token tant qu'un état dure (Effrayé, Charmé, Empoisonné, Étourdi, Paralysé, Entravé…),
 * retirée avec l'état. Table : data/conditions.mjs ; choix : core/conditions.mjs.
 *
 * Le MJ actif pose et arrête les boucles : des effets Sequencer **persistants** (`persist()`), attachés au token et nommés
 * `darsh-condition-<statut>` — Sequencer les diffuse à tous les clients et les garde au rechargement. À chaque changement d'effet
 * actif d'un acteur, et à chaque affichage de scène, on compare les statuts de l'acteur aux boucles qui tournent sur ses tokens.
 * Avec BLFX actif, ses états à lui (sa boucle, posée par ses sorts) lui sont laissés, sauf réglage `conditionsWithBlfx`.
 * Sequencer masque un effet selon la vision du spectateur, comme le reste.
 */
import { MODULE_ID, blfxActive, jb2aActive, log } from "./shared.mjs";
import { known } from "./sequencer.mjs";
import { chain, domainOn, yieldBlfx } from "./sources.mjs";
import { CONDITIONS, CONDITION_OPACITY } from "../data/conditions.mjs";
import { conditionDiff, conditionName, wantedConditions } from "../core/conditions.mjs";

const isExecutor = () => game.users.activeGM?.isSelf === true;
const setting = key => { try { return game.settings.get(MODULE_ID, key); } catch { return false; } };
const pending = new Map();

/** Les états dont la boucle tourne déjà sur ce token. */
function playingOn(token) {
  const manager = globalThis.Sequencer?.EffectManager;
  if ( !manager ) return [];
  return Object.keys(CONDITIONS).filter(status => manager.getEffects({ object: token, name: conditionName(status) }).length);
}

/** Met les boucles d'un token d'accord avec les statuts de son acteur. Rend `{ add, remove }` (ce qui a changé). */
export async function reconcile(token, { force=false }={}) {
  if ( !token?.actor || (token.scene !== canvas.scene) ) return { add: [], remove: [] };
  // Fenêtre « Sources d'animation » : domaine « conditions » allumé et JB2A utilisable ; JB2A placé avant BLFX joue aussi les états que
  // BLFX anime de lui-même (ancien réglage `conditionsWithBlfx`).
  const on = force || domainOn("conditions");
  const jb2a = force ? jb2aActive() : chain("conditions").includes("jb2a");
  const wanted = (on && jb2a) ? wantedConditions(token.actor.statuses, { blfx: blfxActive(), withBlfx: !yieldBlfx("conditions", "jb2a") }) : [];
  const diff = conditionDiff(wanted, playingOn(token));
  for ( const status of diff.remove ) await Sequencer.EffectManager.endEffects({ object: token, name: conditionName(status) });
  const added = [];
  for ( const status of diff.add ) {
    const w = wanted.find(x => x.status === status);
    const file = w.animation.find(known);
    if ( !file ) continue;
    new Sequence({ moduleName: MODULE_ID }).effect().file(file).name(conditionName(status))
      .attachTo(token, { bindVisibility: true }).scaleToObject(w.scale).opacity(CONDITION_OPACITY).persist().fadeIn(400).fadeOut(400)
      .play();
    added.push(status);
  }
  if ( added.length || diff.remove.length ) log(`conditions on ${token.name}: +${added.join(", ") || "—"} −${diff.remove.join(", ") || "—"}`);
  return { add: added, remove: diff.remove };
}

/** Après un changement d'effet actif : les tokens de l'acteur sur la scène affichée, une fois (regroupé). */
function schedule(actor) {
  if ( !actor || !isExecutor() || !canvas.ready ) return;
  const key = actor.uuid;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    for ( const token of actor.getActiveTokens(false, false).filter(t => t.scene === canvas.scene) ) {
      reconcile(token).catch(err => console.error(`${MODULE_ID} | condition animation`, err));
    }
  }, 250));
}

const actorOf = effect => ((effect?.parent?.documentName === "Actor") ? effect.parent : effect?.parent?.actor) ?? null;

/** Toute la scène affichée (au chargement, et quand un réglage change). */
export async function reconcileScene() {
  if ( !isExecutor() || !canvas.ready ) return;
  for ( const token of canvas.tokens.placeables ) await reconcile(token).catch(() => {});
}

/** Pour vérifier en jeu : pose l'état puis le retire, ou dit ce qui tourne. `previewCondition({ token, status })`. */
export async function previewCondition({ token, status=null }={}) {
  const t = canvas.scene?.tokens.find(d => (d.id === token) || (d.name === token))?.object ?? null;
  if ( !t ) throw new Error(`token not found: ${token}`);
  if ( status ) await t.actor.toggleStatusEffect(status);
  await new Promise(r => setTimeout(r, 400));
  return { statuses: [...t.actor.statuses], playing: playingOn(t), result: await reconcile(t) };
}

export function registerConditions() {
  game.settings.register(MODULE_ID, "conditions", {
    name: "DARSHANIM.Settings.Conditions.Name", hint: "DARSHANIM.Settings.Conditions.Hint",
    scope: "world", config: false, type: Boolean, default: true, onChange: () => reconcileScene()
  });
  game.settings.register(MODULE_ID, "conditionsWithBlfx", {
    name: "DARSHANIM.Settings.ConditionsWithBlfx.Name", hint: "DARSHANIM.Settings.ConditionsWithBlfx.Hint",
    scope: "world", config: false, type: Boolean, default: false, onChange: () => reconcileScene()
  });
  for ( const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"] ) {
    Hooks.on(hook, effect => schedule(actorOf(effect)));
  }
  Hooks.on("canvasReady", () => setTimeout(() => reconcileScene().catch(err => console.error(`${MODULE_ID} | condition animations`, err)), 1000));
}
