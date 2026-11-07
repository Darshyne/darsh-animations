/**
 * SPEC §21 : les attaques d'arme (lot 1), les sorts ciblés et les soins (lot 2) joués par ce module (JB2A gratuit ou Premium + sons
 * PSFX), pour se passer d'Automated Animations. Recettes : data/strikes.mjs ; choix : core/strikes.mjs.
 *
 * - **Avec DAS · Core** (niveau Assisté ou Complet, hors Théâtre de l'esprit) : au hook public `dnd5e-combat.resolution`. Une attaque
 *   (arme ou sort) joue une fois son verdict connu **après les réactions** (Bouclier compris : pas d'impact sur la créature) ; un sort à
 *   sauvegarde, une fois toutes les sauvegardes jetées (réussite : impact léger, D8) ; un soin ou des dégâts sans jet, au jet de dégâts.
 *   Une seule fois par résolution. Le Core a déjà attendu les dés 3D.
 * - **Sans lui** : au message d'attaque de dnd5e (touché contre la CA notée), ou à la carte d'utilisation d'une activité de sauvegarde, de
 *   soin ou de dégâts (impact plein), chez son auteur. Jamais les deux voies pour une même action.
 * - On se tait quand BLFX joue l'objet (son Auto-Rec), ou quand Automated Animations le joue (lot 5 : seulement ses animations
 *   personnalisées). Réglage de monde `strikes`. Un joueur coupe les effets chez lui par le réglage de Sequencer.
 * - Sequencer masque un effet selon la vision du spectateur : dans le noir, il ne voit que ce que voient ses tokens (voulu).
 */
import { MODULE_ID, jb2aActive, log } from "./shared.mjs";
import { addSound, known } from "./sequencer.mjs";
import { blfxPlays } from "./blfxmap.mjs";
import { aaPlays, englishKeysOf } from "./aa.mjs";
import { CRITICAL_SCALE, SAVED_IMPACT, chooseAction, hitDelay, judgeAgainstAc, resolutionMoment, spellTimeline, strikeTimeline }
  from "../core/strikes.mjs";

const ENGINE = "dnd5e-combat";
const played = new Set();
/** Les utilisations (id du message d'utilisation) dont l'incantation a déjà été jouée, avant les dés. */
const casts = new Set();

const setting = key => { try { return game.settings.get(MODULE_ID, key); } catch { return true; } };

/** DAS · Core résout-il les actions (et donc nous annonce le verdict) ? */
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
    keys: englishKeysOf(item, activity), properties: [...(sys.properties ?? [])], attackMode, activityType: activity?.type ?? null,
    attackType: activity?.attack?.type?.value ?? null, classification: activity?.attack?.type?.classification ?? null, damageTypes
  };
}

/** Le premier nom que Sequencer connaît parmi des candidats. */
const firstKnown = names => (names ?? []).find(known) ?? null;

/** Le token de l'acteur qui agit, sur la scène affichée. */
function sourceTokenOf(actor, speaker=null) {
  const scene = canvas.scene;
  if ( !scene ) return null;
  if ( (speaker?.scene === scene.id) && speaker.token ) return scene.tokens.get(speaker.token)?.object ?? null;
  return actor?.getActiveTokens?.(false, false)?.find(t => t.scene === scene) ?? null;
}

/* -------------------------------------------- */
/*  Rendus                                       */
/* -------------------------------------------- */

/** Un coup, un tir ou un lancer d'arme (lot 1). */
function playWeapon(sequence, choice, source, live) {
  const file = firstKnown(choice.animation);
  if ( !file ) return { skipped: `no known animation for ${choice.family}`, tried: choice.animation };
  const back = firstKnown(choice.back);
  const sounds = [];
  if ( addSound(sequence, choice.swoosh) ) sounds.push(choice.swoosh);
  const impactFile = firstKnown(choice.impact?.animation);
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
  return { played: file, back, sounds };
}

/** Un sort ciblé ou un soin (lot 2) : incantation sur le lanceur, projectile ou effet sur la cible, impact du type de dégâts. */
function playSpell(sequence, choice, source, live, { skipCast=false }={}) {
  const file = firstKnown(choice.animation);
  const castFile = skipCast ? null : firstKnown(choice.cast);
  const impactFile = firstKnown(choice.impact?.animation);
  if ( !file && !castFile && !impactFile ) return { skipped: `no known animation for ${choice.family}`, tried: choice.animation };
  const sounds = [];
  let lead = 0;
  if ( castFile ) {
    sequence.effect().file(castFile).atLocation(source).scaleToObject(1.8).belowTokens();
    lead = 500;
  }
  if ( !skipCast && choice.castSound && addSound(sequence, choice.castSound) ) sounds.push(choice.castSound);
  const at = (choice.kind === "shot") ? hitDelay("shot") : 250;
  let first = true;
  for ( const step of spellTimeline(live) ) {
    const target = step.token;
    const scale = (step.critical ? CRITICAL_SCALE : 1) * (step.saved ? SAVED_IMPACT.scale : 1);
    const start = lead + step.delay;
    if ( file ) {
      const fx = sequence.effect().file(file).delay(start);
      if ( choice.kind === "shot" ) fx.atLocation(source).stretchTo(target).missed(!step.hit);
      else fx.atLocation(target).scaleToObject(1.5 * scale);
    }
    // Le son du sort à chaque projectile (Projectile magique), une fois sinon.
    if ( choice.sound && (first || (choice.kind === "shot")) && addSound(sequence, choice.sound, { delay: start,
      volume: step.saved ? SAVED_IMPACT.volume : null }) ) sounds.push(choice.sound);
    if ( step.impact && impactFile ) {
      const impact = sequence.effect().file(impactFile).atLocation(target).scaleToObject((choice.impact.scale ?? 1) * scale)
        .delay(start + at);
      if ( choice.impact.tint ) impact.tint(choice.impact.tint);
      if ( step.critical ) impact.repeats(2, 180);
      if ( addSound(sequence, choice.impact.sound, { delay: start + at,
        volume: step.saved ? SAVED_IMPACT.volume : (step.critical ? 1 : 0.7) }) ) sounds.push(choice.impact.sound);
    }
    first = false;
  }
  return { played: file ?? castFile ?? impactFile, cast: castFile, impact: impactFile, sounds };
}

/**
 * Joue une action : attaque d'arme, sort ciblé, soin. `targets` : `[{ token: Token, hit, critical, reason, save, times }]`. Rend
 * `{ played, family, … }` ou `{ skipped }`.
 * @param {{ item: Item, activity?: object, source: Token, targets: object[], attackMode?: string }} action
 */
/** Ce qui arrête un rendu avant même de choisir : `{ skipped }`, ou null. */
function gate({ item, activity, source }, force) {
  if ( !force && !setting("strikes") ) return { skipped: "strike animations turned off" };
  if ( !jb2aActive() ) return { skipped: "JB2A (free or Premium) and Sequencer needed" };
  if ( !source ) return { skipped: "acting token not on the viewed scene" };
  // Sort de zone : la zone est jouée ailleurs (BLFX, ou runtime/areas.mjs) ; pas d'impact par cible en plus.
  if ( activity?.target?.template?.type && (activity.type !== "attack") ) return { skipped: "area spell (played with its area)" };
  if ( !force && blfxPlays(item) ) return { skipped: "played by BLFX" };
  if ( !force && aaPlays(item, { activity }) ) return { skipped: "played by Automated Animations" };
  return null;
}

/**
 * L'incantation seule, sur le lanceur, dès le lancement d'un sort (avant les dés : décision utilisateur, 2026-11-07). Le reste (projectile,
 * effet, impact) suit au verdict, sans la rejouer. Rien pour une attaque d'arme.
 */
export function playCast({ item, activity=null, source }, { force=false }={}) {
  const stop = gate({ item, activity, source }, force);
  if ( stop ) return stop;
  const choice = chooseAction(strikeSummary(item, activity));
  if ( choice?.action !== "spell" ) return { skipped: "not a spell" };
  const castFile = firstKnown(choice.cast);
  if ( !castFile ) return { skipped: `no known cast for ${choice.family}` };
  const sequence = new Sequence({ moduleName: MODULE_ID });
  sequence.effect().file(castFile).atLocation(source).scaleToObject(1.8).belowTokens();
  const sounds = (choice.castSound && addSound(sequence, choice.castSound)) ? [choice.castSound] : [];
  sequence.play();
  log(`cast (${choice.family}): ${item.name}`);
  return { cast: castFile, sounds, family: choice.family };
}

/**
 * Joue une action : attaque d'arme, sort ciblé, soin. `targets` : `[{ token: Token, hit, critical, reason, save, times }]`. `skipCast` :
 * l'incantation est déjà jouée (playCast). Rend `{ played, family, … }` ou `{ skipped }`.
 */
export function playStrike({ item, activity=null, source, targets=[], attackMode=null }, { force=false, skipCast=false }={}) {
  const stop = gate({ item, activity, source }, force);
  if ( stop ) return stop;
  const live = targets.filter(t => t.token);
  if ( !live.length ) return { skipped: "no target on the viewed scene" };
  const choice = chooseAction(strikeSummary(item, activity, { attackMode }));
  if ( !choice ) return { skipped: "nothing to animate for this activity" };
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const result = (choice.action === "weapon") ? playWeapon(sequence, choice, source, live)
    : playSpell(sequence, choice, source, live, { skipCast });
  if ( result.skipped ) return result;
  sequence.play();
  log(`${choice.action} (${choice.family}): ${item.name} → ${live.map(t => `${t.token.name}${t.hit === false ? " (miss)"
    : t.critical ? " (crit)" : t.save?.success ? " (saved)" : ""}${(t.times > 1) ? ` ×${t.times}` : ""}`).join(", ")}`);
  return { ...result, family: choice.family, action: choice.action, kind: choice.kind, targets: live.map(t => t.token.name) };
}

/* -------------------------------------------- */
/*  Voie DAS · Core                              */
/* -------------------------------------------- */

async function onResolution(resolution, event) {
  const usage = resolution?.origin ?? resolution?.carrier;
  const moment = resolutionMoment(resolution, event);
  const opening = (event?.type === "opened") && usage && !casts.has(usage);
  if ( !moment && !opening ) return;
  if ( opening ) casts.add(usage);
  const activity = await fromUuid(resolution.activity).catch(() => null);
  const item = activity?.item ?? null;
  if ( !item ) return;
  const message = game.messages.get(resolution.attack?.messageId ?? resolution.carrier);
  const source = sourceTokenOf(item.actor, message?.speaker);
  // Incantation dès l'ouverture de la résolution (la carte d'utilisation), avant les dés.
  if ( opening && !moment ) {
    if ( playCast({ item, activity, source }).skipped ) casts.delete(usage);
    return;
  }
  if ( opening ) casts.delete(usage);   // ouverte avec son verdict (jet hors carte) : tout se joue d'un coup
  const key = `${resolution.id}:${resolution.attack?.messageId ?? moment}`;
  if ( played.has(key) ) return;
  played.add(key);
  const targets = (resolution.targets ?? []).filter(t => !t.unaffected && ((resolution.plan.darts > 0) ? (t.times ?? 0) > 0 : true))
    .map(t => ({ token: fromUuidSync(t.token, { strict: false })?.object ?? null, hit: t.hit, critical: t.critical, reason: t.reason,
      save: t.save, times: (resolution.plan.darts > 0) ? t.times : 1 }))
    .filter(t => t.token && (t.token.scene === canvas.scene));
  const attackMode = message?.rolls?.[0]?.options?.attackMode ?? message?.system?.mode ?? null;
  const result = playStrike({ item, activity, source, targets, attackMode }, { skipCast: casts.has(usage) });
  if ( result.skipped ) log(`animation skipped (${item.name}): ${result.skipped}`);
}

/* -------------------------------------------- */
/*  Voie dnd5e (sans DAS · Core)                 */
/* -------------------------------------------- */

/** Les cibles notées sur un message dnd5e (`system.targets`), sur la scène affichée. */
function notedTargets(message) {
  return (message.system?.targets ?? []).map(t => {
    const doc = fromUuidSync(t.token ?? t.actor, { strict: false });
    return { token: doc?.object ?? doc?.getActiveTokens?.(false, false)?.[0] ?? null, ac: t.ac };
  });
}

function onMessage(message) {
  if ( !message.isAuthor || engineResolves() || played.has(message.id) ) return;
  const activity = message.getAssociatedActivity?.() ?? null;
  if ( message.type === "attack" ) {
    played.add(message.id);
    const item = activity?.item ?? message.getAssociatedItem?.() ?? null;
    if ( !item ) return;
    const roll = message.rolls?.[0];
    const targets = judgeAgainstAc(roll, notedTargets(message)).filter(t => t.token && (t.token.scene === canvas.scene));
    const usage = message.system?.origin ?? message.getFlag?.("dnd5e", "originatingMessage") ?? null;
    const result = playStrike({ item, activity, source: sourceTokenOf(item.actor, message.speaker), targets,
      attackMode: roll?.options?.attackMode ?? message.system?.mode ?? null }, { skipCast: !!usage && casts.has(usage) });
    if ( result.skipped ) log(`animation skipped (${item.name}): ${result.skipped}`);
    return;
  }
  // Carte d'utilisation d'un sort à jet d'attaque : l'incantation tout de suite, avant le jet ; le projectile suivra au message d'attaque.
  if ( (message.type === "usage") && (activity?.type === "attack") ) {
    played.add(message.id);
    const item = activity.item;
    if ( !playCast({ item, activity, source: sourceTokenOf(item?.actor, message.speaker) }).skipped ) casts.add(message.id);
    return;
  }
  // Carte d'utilisation d'une activité sans jet d'attaque : sauvegarde (résultats inconnus ici), soin, dégâts.
  if ( (message.type !== "usage") || !["save", "heal", "damage"].includes(activity?.type) ) return;
  played.add(message.id);
  const item = activity.item;
  if ( item?.type === "consumable" ) return;   // potions et consommables : runtime/consumables.mjs
  const targets = notedTargets(message).filter(t => t.token && (t.token.scene === canvas.scene));
  const source = sourceTokenOf(item.actor, message.speaker);
  // Un soin sans cible désignée soigne le lanceur.
  if ( !targets.length && (activity.type === "heal") && source ) targets.push({ token: source });
  const result = playStrike({ item, activity, source, targets });
  if ( result.skipped ) log(`animation skipped (${item.name}): ${result.skipped}`);
}

/* -------------------------------------------- */
/*  Entrées                                      */
/* -------------------------------------------- */

/**
 * Pour vérifier en jeu (MJ, connecteur MCP), sans jet : `previewStrike({ item, activity, source, targets, miss, critical, saved, times,
 * attackMode })`. `item` : uuid, ou nom / identifiant d'un objet de l'acteur de `source` ; `activity` : id, ou type ("attack", "save",
 * "heal") ; `source`, `targets` : tokens de la scène affichée, par nom ou id.
 */
export async function previewStrike({ item, activity=null, source, targets=[], miss=false, critical=false, saved=false, times=1,
  attackMode=null }={}) {
  const find = ref => canvas.scene?.tokens.find(t => (t.id === ref) || (t.name === ref))?.object ?? null;
  const owned = find(source)?.actor?.items.find(i => (i.name === item) || (i.system?.identifier === item)) ?? null;
  const doc = owned ?? await fromUuid(item).catch(() => null);
  if ( !doc ) {
    const list = find(source)?.actor?.items.filter(i => [...(i.system?.activities ?? [])].length).map(i => i.name) ?? [];
    throw new Error(`item not found: ${item} (items with activities on ${source}: ${list.join(", ")})`);
  }
  const acts = doc.system?.activities;
  const act = (activity ? (acts?.get(activity) ?? acts?.find?.(a => a.type === activity)) : null)
    ?? acts?.find?.(a => ["attack", "save", "heal", "damage"].includes(a.type)) ?? null;
  return playStrike({ item: doc, activity: act, source: find(source), attackMode,
    targets: targets.map(find).filter(Boolean).map(token => ({ token, hit: (act?.type === "attack") ? !miss : null,
      critical: critical && !miss, reason: miss ? "miss" : "hit", save: (act?.type === "save") ? { success: saved } : null, times })) },
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
    try { onMessage(message); } catch(err) { console.error(`${MODULE_ID} | strike animation`, err); }
  });
}
