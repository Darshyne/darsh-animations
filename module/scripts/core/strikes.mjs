/**
 * SPEC §21 : le choix d'une recette d'attaque d'arme (lot 1), sans Foundry. Le runtime résume l'objet et l'attaque, puis joue ce que ce
 * module décide ici : quelle forme (coup, tir, lancer, sur la cible), quels noms candidats (dans l'ordre), quel son, quel impact.
 */
import { COLOR_FALLBACKS, DAMAGE_COLORS, DART_GAP, ELEMENTS, GENERIC, HEAL, NATURAL, SAVED, SOUNDS, SPELLS, SPELL_CASTS,
  SPELL_PROJECTILES, SPELL_SOUNDS, STRIKE_IMPACTS, SWOOSH_BY_DAMAGE, TIMING, UNARMED, WEAPONS } from "../data/strikes.mjs";
import { IMPACTS } from "../data/jb2a.mjs";

const PHYSICAL = new Set(["bludgeoning", "piercing", "slashing"]);

/**
 * @typedef {object} StrikeSummary
 * @property {string} itemType          "weapon", "spell", "feat"…
 * @property {string} [weaponType]      `system.type.value` : "simpleM", "martialR", "natural", "improv"…
 * @property {string} [baseItem]        `system.type.baseItem`
 * @property {string[]} [keys]          clés anglaises normalisées (core/aa.mjs `normalize` : identifiant, nom d'origine Babele, nom
 *                                      traduit par la table de la langue, nom de l'objet)
 * @property {string[]} [properties]    propriétés de l'arme ("hvy", "ret", "two", "mgc", "thr"…)
 * @property {string} [attackMode]      mode d'attaque de dnd5e ("oneHanded", "twoHanded", "offhand", "thrown", "thrown-offhand", "ranged")
 * @property {string} [attackType]      `activity.attack.type.value` : "melee" ou "ranged"
 * @property {string} [classification]  `activity.attack.type.classification` : "weapon", "spell", "unarmed"
 * @property {string[]} [damageTypes]   types de dégâts de l'attaque (arme puis dégâts en plus)
 */

/** Les types de dégâts non physiques en plus (le premier donne la couleur d'une arme magique, D7). */
export function extraDamage(damageTypes=[]) {
  return damageTypes.find(t => !PHYSICAL.has(t)) ?? null;
}

/** Le type physique de l'attaque (impact), à défaut tranchant. */
export function physicalDamage(damageTypes=[]) {
  return damageTypes.find(t => PHYSICAL.has(t)) ?? "slashing";
}

/** Une attaque d'arme que le lot 1 joue ? (pas un sort, ni une attaque de sort d'un objet) */
export function isWeaponAttack(s) {
  if ( s.classification === "spell" ) return false;
  if ( s.classification === "unarmed" ) return true;
  return (s.itemType === "weapon") || (s.classification === "weapon");
}

/** La forme : "melee", "ranged", "thrown", ou null. */
export function strikeForm(s) {
  if ( !isWeaponAttack(s) ) return null;
  if ( s.attackMode?.startsWith("thrown") ) return "thrown";
  if ( (s.attackMode === "ranged") || (s.attackType === "ranged") ) return "ranged";
  return "melee";
}

const natural = s => (s.weaponType === "natural") || ((s.itemType !== "weapon") && (s.classification === "weapon"));

/** La recette de l'arme : `{ recipe, family, fire }` (family : ce qui l'a désignée, pour le journal et les tests). */
export function weaponRecipe(s) {
  const form = strikeForm(s);
  if ( !form ) return null;
  const keys = s.keys ?? [];
  const physical = physicalDamage(s.damageTypes);
  if ( (s.classification === "unarmed") || keys.some(k => /unarmedstrike|flurryofblows/.test(k)) ) {
    return { form, family: "unarmed", recipe: UNARMED };
  }
  const weapon = WEAPONS[s.baseItem] ?? keys.map(k => WEAPONS[k]).find(Boolean) ?? null;
  if ( weapon ) {
    const recipe = weapon[form] ?? ((form === "thrown") ? (weapon.ranged ?? GENERIC.thrown) : null)
      ?? ((form === "ranged") ? (weapon.thrown ?? GENERIC.ranged) : weapon.melee);
    if ( recipe ) return { form, family: s.baseItem || keys[0], recipe, fire: weapon.fire ?? null, heavy: !!weapon.heavy };
  }
  if ( natural(s) && (form === "melee") ) {
    const words = keys.join(" ");
    const found = NATURAL.find(([word]) => words.includes(word));
    if ( found ) return { form, family: `natural:${found[0]}`, recipe: found[1] };
    return { form, family: `natural:${physical}`, recipe: (physical === "slashing") ? GENERIC.natural : GENERIC[physical] };
  }
  if ( form === "ranged" ) return { form, family: "generic:ranged", recipe: GENERIC.ranged };
  if ( form === "thrown" ) return { form, family: "generic:thrown", recipe: GENERIC.thrown };
  return { form, family: `generic:${physical}`, recipe: GENERIC[physical] };
}

/** Les couleurs à essayer, dans l'ordre, pour une couleur voulue ; le blanc à la fin. */
export function colorChain(color) {
  const chain = [...(COLOR_FALLBACKS[color] ?? [color])];
  if ( !chain.includes("white") ) chain.push("white");
  return chain;
}

/**
 * Développe des noms candidats : `{color}` par chaque couleur de la chaîne, `{element}` par la famille du type de dégâts (sinon
 * "physical"), `{hands}` par "two_handed" (arme à deux mains, ou Lourde) ou "one_handed". Doublons retirés, ordre gardé.
 */
export function expand(names=[], { color="white", element="physical", hands="one_handed" }={}) {
  const out = [];
  for ( const name of names ) {
    const withVars = name.replaceAll("{element}", element).replaceAll("{hands}", hands);
    if ( withVars.includes("{color}") ) for ( const c of colorChain(color) ) out.push(withVars.replaceAll("{color}", c));
    else out.push(withVars);
  }
  return [...new Set(out)];
}

/**
 * Ce qu'il faut jouer pour une attaque d'arme : `{ form, family, kind, animation[], back[], swoosh, impact, color }`, ou null.
 * `animation` et `back` sont des candidats (le premier connu de Sequencer est joué).
 */
export function chooseStrike(s) {
  const found = weaponRecipe(s);
  if ( !found ) return null;
  const { form, family, recipe, fire, heavy } = found;
  const extra = extraDamage(s.damageTypes);
  const color = (extra && DAMAGE_COLORS[extra]) ? DAMAGE_COLORS[extra] : "white";
  const props = new Set(s.properties ?? []);
  const twoHanded = heavy || props.has("hvy") || props.has("two") || (s.attackMode === "twoHanded");
  const vars = { color, element: ELEMENTS[extra] ?? "physical", hands: twoHanded ? "two_handed" : "one_handed" };
  const names = [...((extra === "fire") && fire ? [fire] : []), ...recipe.animation];
  const returning = (form === "thrown") && props.has("ret") && recipe.back;
  const swooshKey = SWOOSH_BY_DAMAGE[extra] ?? recipe.sound ?? (twoHanded ? "heavy" : "light");
  return {
    form, family, kind: recipe.kind, color,
    animation: expand(names, vars),
    back: returning ? expand(recipe.back, vars) : [],
    swoosh: SOUNDS[swooshKey] ?? SOUNDS.light,
    impact: STRIKE_IMPACTS[physicalDamage(s.damageTypes)]
  };
}

/**
 * Le déroulé, cible par cible : `[{ token, hit, critical, shielded, delay }]`. `targets` : `{ token, hit, critical, reason }` (verdict du
 * Core, ou calculé contre la CA). Une cible au verdict inconnu (`hit` null) est jouée comme touchée sans impact. Bouclier (`reason`
 * "reaction") : le coup s'arrête sur le bouclier, pas d'impact sur la créature.
 */
export function strikeTimeline(targets=[]) {
  return targets.map((t, i) => ({
    token: t.token, hit: t.hit !== false, critical: !!t.critical && (t.hit === true),
    impact: t.hit === true, shielded: (t.hit === false) && (t.reason === "reaction"), delay: i * TIMING.between
  }));
}

/** L'instant de l'impact dans l'animation, selon la forme jouée. */
export function hitDelay(kind) {
  return { swing: TIMING.swingHit, shot: TIMING.shotHit, onTarget: TIMING.onTargetHit }[kind] ?? TIMING.swingHit;
}

/** Échelle d'un critique (D6, défaut retenu : plus grand, impact doublé). */
export const CRITICAL_SCALE = TIMING.criticalScale;

/** Touché, raté, critique contre la CA notée sur le message (dnd5e 6 : `system.targets[].ac`). */
export function judgeAgainstAc(roll, targets=[]) {
  return targets.map(t => {
    if ( roll?.isFumble ) return { ...t, hit: false, critical: false, reason: "fumble" };
    if ( roll?.isCritical ) return { ...t, hit: true, critical: true, reason: "critical" };
    if ( !Number.isFinite(t.ac) || !Number.isFinite(roll?.total) ) return { ...t, hit: null, critical: false, reason: null };
    const hit = roll.total >= t.ac;
    return { ...t, hit, critical: false, reason: hit ? "hit" : "miss" };
  });
}

/* -------------------------------------------- */
/*  Lot 2 : sorts ciblés et soins                */
/* -------------------------------------------- */

/** Les sorts d'exception, par clé normalisée (sans tirets : core/aa.mjs `normalize`). */
const SPELLS_BY_KEY = Object.fromEntries(Object.entries(SPELLS).map(([k, v]) => [k.replace(/[^a-z0-9]/g, ""), v]));

/**
 * La forme d'un sort ou d'une activité de soin / sauvegarde / dégâts : "shot", "onTarget", "heal", ou null (attaque d'arme : lot 1 ;
 * activité sans cible ni dégât : rien). `s.activityType` : "attack", "save", "heal", "damage", "utility"…
 */
export function spellForm(s) {
  if ( s.activityType === "heal" ) return "heal";
  if ( s.activityType === "attack" ) {
    if ( isWeaponAttack(s) ) return null;
    return (s.attackType === "melee") ? "onTarget" : "shot";
  }
  if ( ["save", "damage"].includes(s.activityType) ) return "onTarget";
  return null;
}

/**
 * Ce qu'il faut jouer pour un sort (ou une activité de soin, de sauvegarde, de dégâts d'un objet) : `{ family, kind, color, animation[],
 * cast[], castSound, sound, impact, saveScale }`, ou null.
 */
export function chooseSpell(s) {
  const form = spellForm(s);
  if ( !form ) return null;
  const keys = s.keys ?? [];
  const key = keys.find(k => SPELLS_BY_KEY[k]);
  const own = key ? SPELLS_BY_KEY[key] : null;
  const type = extraDamage(s.damageTypes) ?? (s.damageTypes ?? [])[0] ?? null;
  const kind = own?.kind ?? form;
  const color = own?.color ?? ((kind === "heal") ? HEAL.color : (DAMAGE_COLORS[type] ?? "white"));
  const vars = { color, element: ELEMENTS[type] ?? "physical" };
  let animation;
  if ( own ) animation = own.animation;
  else if ( kind === "heal" ) animation = HEAL.animation;
  else if ( kind === "shot" ) animation = SPELL_PROJECTILES[type] ?? SPELL_PROJECTILES.none;
  else animation = [];   // sur la cible, sans exception : l'impact du type de dégâts suffit
  const castKey = (kind === "heal") ? "heal" : (SPELL_CASTS[type] ? type : "none");
  // Incantation sur le lanceur pour tous les sorts : jouée dès le lancement, pendant les dés (décision utilisateur, 2026-11-07).
  const cast = own?.cast ?? SPELL_CASTS[castKey].animation;
  // Sans type de dégâts (Immobilisation de personne…) : un impact magique neutre sur la cible.
  const impactOf = IMPACTS[type] ?? { animation: "jb2a.impact.011.blue", scale: 0.9, sound: SPELL_SOUNDS.magical };
  const impact = ((own?.impact === false) || (kind === "heal") || !impactOf) ? null
    : { animation: [impactOf.animation], scale: impactOf.scale ?? 1.2, tint: impactOf.tint ?? null, sound: impactOf.sound ?? SPELL_SOUNDS.magical };
  return {
    form, family: key ? `spell:${key}` : `${kind}:${type ?? "none"}`, kind, color,
    animation: expand(animation, vars), cast: expand(cast, vars),
    castSound: own?.castSound ?? SPELL_CASTS[castKey].sound,
    sound: own?.sound ?? ((kind === "heal") ? HEAL.sound : (kind === "shot") ? SPELL_SOUNDS.projectile : null),
    impact
  };
}

/** Attaque d'arme (lot 1) ou sort (lot 2) : `{ ...choix, action: "weapon" | "spell" }`, ou null. */
export function chooseAction(s) {
  if ( (s.activityType === "attack") || !s.activityType ) {
    const weapon = chooseStrike(s);
    if ( weapon ) return { ...weapon, action: "weapon" };
  }
  const spell = chooseSpell(s);
  return spell ? { ...spell, action: "spell" } : null;
}

/**
 * Le déroulé d'un sort, cible par cible et projectile par projectile : `[{ token, hit, critical, impact, saved, delay }]`. `targets` :
 * `{ token, hit, critical, reason, save, times }` — `hit` null sans jet d'attaque ; `save` : `{ success }` ou null ; `times` : nombre de
 * projectiles (Projectile magique : réparti par DAS · Core).
 */
export function spellTimeline(targets=[]) {
  const out = [];
  let delay = 0;
  for ( const t of targets ) {
    const times = Math.max(1, Number.isInteger(t.times) ? t.times : 1);
    for ( let i = 0; i < times; i++ ) {
      const hit = t.hit !== false;
      out.push({ token: t.token, hit, critical: !!t.critical && (t.hit === true), impact: hit, saved: t.save?.success === true,
        shielded: (t.hit === false) && (t.reason === "reaction"), delay });
      delay += (times > 1) ? DART_GAP : TIMING.between;
    }
  }
  return out;
}

/** Réglages d'un impact sur une sauvegarde réussie (D8). */
export const SAVED_IMPACT = SAVED;

/* DAS · Core : quand jouer une résolution (hook `dnd5e-combat.resolution`). */
const AWAITING = new Set(["awaitingAttack", "awaitingReaction"]);

/** Le moment de jouer une résolution, ou null : "attack" (verdict connu), "effect" (sauvegardes jetées, dégâts ou soin lancés). */
export function resolutionMoment(resolution, event) {
  if ( !resolution?.plan || ["undone"].includes(resolution.step) ) return null;
  if ( resolution.plan.attack ) {
    if ( !resolution.attack || AWAITING.has(resolution.step) ) return null;
    return ["attackRolled", "reactionResolved", "opened"].includes(event?.type) ? "attack" : null;
  }
  const affected = (resolution.targets ?? []).filter(t => !t.unaffected);
  if ( !affected.length ) return null;
  if ( resolution.plan.save ) return affected.every(t => t.save) ? "effect" : null;
  if ( (resolution.plan.darts > 0) && !resolution.allocated ) return null;
  return ["damageRolled", "applied"].includes(event?.type) || (resolution.step === "done") ? "effect" : null;
}
