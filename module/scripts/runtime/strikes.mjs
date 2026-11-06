/**
 * SPEC §21, lot 1 : les attaques d'arme jouées par ce module (JB2A gratuit ou Premium + sons PSFX), pour se passer d'Automated
 * Animations. Recettes : data/strikes.mjs ; choix : core/strikes.mjs.
 *
 * - **Avec DAS · Core** (niveau Assisté ou Complet, hors Théâtre de l'esprit) : au hook public `dnd5e-combat.resolution`, une fois le
 *   verdict de l'attaque connu **après les réactions** (Bouclier compris : le coup s'arrête alors sur le bouclier), une seule fois par jet.
 *   Le Core a déjà attendu les dés 3D ; il attend à son tour les animations Sequencer qui partent de l'auteur avant d'appliquer.
 * - **Sans lui** : au message d'attaque de dnd5e, chez son auteur, touché / raté calculé contre la CA des cibles notées sur le message.
 *   Jamais les deux voies pour un même jet.
 * - On se tait quand BLFX joue l'objet (son Auto-Rec), ou quand Automated Animations le joue (lot 5 : seulement ses animations
 *   personnalisées). Réglage de monde `strikes`. Un joueur qui ne veut pas d'animations les coupe chez lui par le réglage de Sequencer.
 */
import { MODULE_ID, jb2aActive, log } from "./shared.mjs";
import { addSound, known } from "./sequencer.mjs";
import { blfxPlays } from "./blfxmap.mjs";
import { aaPlays, englishKeysOf } from "./aa.mjs";
import { CRITICAL_SCALE, chooseStrike, hitDelay, judgeAgainstAc, strikeForm, strikeTimeline } from "../core/strikes.mjs";

const ENGINE = "dnd5e-combat";
const played = new Set();

const setting = key => { try { return game.settings.get(MODULE_ID, key); } catch { return true; } };

/** DAS · Core résout-il les attaques (et donc nous annonce le verdict) ? */
export function engineResolves() {
  const engine = game.modules.get(ENGINE);
  if ( !engine?.active ) return false;
  try { if ( engine.api?.theater?.active?.() ) return false; } catch {}
  let level = "full";
  try { level = game.settings.get(ENGINE, "automationLevel"); } catch {}
  return level !== "essentials";
}

/** Le résumé que core/strikes.mjs lit. */
export function strikeSummary(item, activity=null, { attackMode=null }={}) {
  const sys = item?.system ?? {};
  const parts = activity?.damage?.parts ?? [];
  const base = sys.damage?.base?.types ? [...sys.damage.base.types] : [];
  const damageTypes = [...new Set([...base, ...parts.flatMap(p => [...(p.types ?? [])])])];
  return {
    itemType: item?.type, weaponType: sys.type?.value, baseItem: sys.type?.baseItem || null,
    keys: englishKeysOf(item, activity), properties: [...(sys.properties ?? [])], attackMode,
    attackType: activity?.attack?.type?.value ?? null, classification: activity?.attack?.type?.classification ?? null, damageTypes
  };
}

/** Le premier nom que Sequencer connaît parmi des candidats. */
const firstKnown = names => names.find(known) ?? null;

/** Le token de l'acteur qui attaque, sur la scène affichée. */
function sourceTokenOf(actor, speaker=null) {
  const scene = canvas.scene;
  if ( !scene ) return null;
  if ( (speaker?.scene === scene.id) && speaker.token ) return scene.tokens.get(speaker.token)?.object ?? null;
  return actor?.getActiveTokens?.(false, false)?.find(t => t.scene === scene) ?? null;
}

/**
 * Joue une attaque d'arme. `targets` : `[{ token: Token, hit, critical, reason }]`. Rend `{ played, family, … }` ou `{ skipped }`.
 * @param {{ item: Item, activity?: object, source: Token, targets: object[], attackMode?: string }} attack
 */
export function playStrike({ item, activity=null, source, targets=[], attackMode=null }, { force=false }={}) {
  if ( !force && !setting("strikes") ) return { skipped: "strike animations turned off" };
  if ( !jb2aActive() ) return { skipped: "JB2A (free or Premium) and Sequencer needed" };
  if ( !source ) return { skipped: "attacker token not on the viewed scene" };
  const live = targets.filter(t => t.token);
  if ( !live.length ) return { skipped: "no target on the viewed scene" };
  const summary = strikeSummary(item, activity, { attackMode });
  if ( !strikeForm(summary) ) return { skipped: "not a weapon attack" };
  if ( !force && blfxPlays(item) ) return { skipped: "played by BLFX" };
  if ( !force && aaPlays(item, { activity }) ) return { skipped: "played by Automated Animations" };
  const choice = chooseStrike(summary);
  const file = firstKnown(choice.animation);
  if ( !file ) return { skipped: `no known animation for ${choice.family}`, tried: choice.animation };
  const back = firstKnown(choice.back);
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const sounds = [];
  if ( addSound(sequence, choice.swoosh) ) sounds.push(choice.swoosh);
  const impactFile = firstKnown(choice.impact?.animation ?? []);
  const at = hitDelay(choice.kind);
  for ( const step of strikeTimeline(live) ) {
    const target = step.token;
    const scale = step.critical ? CRITICAL_SCALE : 1;
    const fx = sequence.effect().file(file).delay(step.delay);
    if ( choice.kind === "onTarget" ) fx.atLocation(target).scaleToObject(1.4 * scale);
    else if ( choice.kind === "shot" ) fx.atLocation(source).stretchTo(target).missed(!step.hit);
    else {
      // Coup : l'arme part de l'attaquant et s'oriente vers la cible, à cinq cases de large par case de token (taille des animations JB2A).
      const size = (source.document.width ?? 1) * 5 * scale;
      fx.atLocation(source).rotateTowards(target).anchor({ x: 0.4, y: 0.5 }).size(size, { gridUnits: true }).randomizeMirrorY()
        .missed(!step.hit);
    }
    if ( back && (choice.kind === "shot") ) {
      sequence.effect().file(back).atLocation(target).stretchTo(source).delay(step.delay + at + 100);
    }
    if ( step.impact && impactFile ) {
      const impact = sequence.effect().file(impactFile).atLocation(target).scaleToObject((choice.impact.scale ?? 1) * scale)
        .delay(step.delay + at);
      if ( step.critical ) impact.repeats(2, 180);
      if ( addSound(sequence, choice.impact.sound, { delay: step.delay + at, volume: step.critical ? 1 : 0.7 }) ) {
        sounds.push(choice.impact.sound);
      }
    }
  }
  sequence.play();
  log(`strike (${choice.family}): ${item.name} → ${live.map(t => `${t.token.name}${t.hit === false ? " (miss)" : t.critical ? " (crit)" : ""}`).join(", ")}`);
  return { played: file, family: choice.family, form: choice.form, back, sounds, targets: live.map(t => t.token.name) };
}

/* -------------------------------------------- */
/*  Voie DAS · Core                              */
/* -------------------------------------------- */

const AWAITING = new Set(["awaitingAttack", "awaitingReaction"]);

async function onResolution(resolution, event) {
  if ( !resolution?.plan?.attack || !resolution.attack || AWAITING.has(resolution.step) ) return;
  if ( !["attackRolled", "reactionResolved", "opened"].includes(event?.type) ) return;
  const key = `${resolution.id}:${resolution.attack.messageId}`;
  if ( played.has(key) ) return;
  played.add(key);
  const activity = await fromUuid(resolution.activity).catch(() => null);
  const item = activity?.item ?? null;
  if ( !item ) return;
  const message = game.messages.get(resolution.attack.messageId);
  const source = sourceTokenOf(item.actor, message?.speaker);
  const targets = (resolution.targets ?? []).map(t => ({
    token: fromUuidSync(t.token, { strict: false })?.object ?? null, hit: t.hit, critical: t.critical, reason: t.reason
  })).filter(t => t.token && (t.token.scene === canvas.scene));
  const attackMode = message?.rolls?.[0]?.options?.attackMode ?? message?.system?.mode ?? null;
  const result = playStrike({ item, activity, source, targets, attackMode });
  if ( result.skipped ) log(`strike skipped (${item.name}): ${result.skipped}`);
}

/* -------------------------------------------- */
/*  Voie dnd5e (sans DAS · Core)                 */
/* -------------------------------------------- */

function onAttackMessage(message) {
  if ( (message.type !== "attack") || !message.isAuthor || engineResolves() ) return;
  if ( played.has(message.id) ) return;
  played.add(message.id);
  const activity = message.getAssociatedActivity?.() ?? null;
  const item = activity?.item ?? message.getAssociatedItem?.() ?? null;
  if ( !item ) return;
  const roll = message.rolls?.[0];
  const noted = (message.system?.targets ?? []).map(t => ({ token: fromUuidSync(t.token ?? t.actor, { strict: false }), ac: t.ac }));
  const targets = judgeAgainstAc(roll, noted)
    .map(t => ({ ...t, token: t.token?.object ?? t.token?.getActiveTokens?.(false, false)?.[0] ?? null }))
    .filter(t => t.token && (t.token.scene === canvas.scene));
  const result = playStrike({ item, activity, source: sourceTokenOf(item.actor, message.speaker), targets,
    attackMode: roll?.options?.attackMode ?? message.system?.mode ?? null });
  if ( result.skipped ) log(`strike skipped (${item.name}): ${result.skipped}`);
}

/* -------------------------------------------- */
/*  Entrées                                      */
/* -------------------------------------------- */

/**
 * Pour vérifier en jeu (MJ, connecteur MCP), sans jet : `previewStrike({ item, activity, source, targets, miss, critical, attackMode })`.
 * `item` : uuid ; `source`, `targets` : tokens de la scène affichée, par nom ou id.
 */
export async function previewStrike({ item, activity=null, source, targets=[], miss=false, critical=false, attackMode=null }={}) {
  const find = ref => canvas.scene?.tokens.find(t => (t.id === ref) || (t.name === ref))?.object ?? null;
  // `item` : uuid, ou nom / identifiant d'un objet de l'acteur de `source`.
  const owned = find(source)?.actor?.items.find(i => (i.name === item) || (i.system?.identifier === item)) ?? null;
  const doc = owned ?? await fromUuid(item).catch(() => null);
  if ( !doc ) {
    const list = find(source)?.actor?.items.filter(i => i.system?.activities?.some(a => a.type === "attack")).map(i => i.name) ?? [];
    throw new Error(`item not found: ${item} (attacks of ${source}: ${list.join(", ")})`);
  }
  const act = activity ? doc.system?.activities?.get(activity)
    : (doc.system?.activities?.find?.(a => a.type === "attack") ?? null);
  return playStrike({ item: doc, activity: act, source: find(source), attackMode,
    targets: targets.map(find).filter(Boolean).map(token => ({ token, hit: !miss, critical: critical && !miss, reason: miss ? "miss" : "hit" })) },
  { force: true });
}

export function registerStrikes() {
  game.settings.register(MODULE_ID, "strikes", {
    name: "DARSHANIM.Settings.Strikes.Name", hint: "DARSHANIM.Settings.Strikes.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  Hooks.on(`${ENGINE}.resolution`, (resolution, event) => {
    onResolution(resolution, event).catch(err => console.error(`${MODULE_ID} | strike animation`, err));
  });
  Hooks.on("createChatMessage", message => {
    try { onAttackMessage(message); } catch(err) { console.error(`${MODULE_ID} | strike animation`, err); }
  });
}
