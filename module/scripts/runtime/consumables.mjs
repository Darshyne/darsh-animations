/**
 * Les effets des potions et des consommables (SPEC §13–§14, table data/consumables.mjs). Exception assumée à « BLFX déclenche,
 * pas nous », comme les pièges et les murs : BLFX ne reconnaît aucune potion, et l'effet doit exister sans lui. Une seule entrée
 * pour les trois rendus (runtime/renderer.mjs) : la **carte d'utilisation** (message `usage` de dnd5e), chez le MJ actif — elle
 * existe même quand la potion a été détruite en étant bue (`ChatMessage5e#getAssociatedItem` la relit dans `system.deltas.deleted`,
 * documents/chat-message.mjs:725-740), et le MJ peut poser des filtres sur n'importe quel token.
 */

import { MODULE_ID, log } from "./shared.mjs";
import { classify, filtersDuration, fill, tokenMagicFilters } from "../core/consumables.mjs";
import { BLFX_BUILTIN, BLFX_RECIPES, BY_IDENTIFIER, COLORS, IMPACT, KINDS, MOODS, SIGNATURES, TOKENMAGIC_RECIPES }
  from "../data/consumables.mjs";
import { animations } from "./registry.mjs";
import { renderer } from "./renderer.mjs";
import { playNative } from "./native.mjs";

const isExecutor = () => game.users.activeGM?.isSelf === true;

/** Le résumé d'un item que `classify` lit. */
function summary(item) {
  const activities = [...(item?.system?.activities ?? [])];
  return {
    type: item?.type, subtype: item?.system?.type?.value, identifier: item?.system?.identifier ?? "",
    activities: activities.map(a => ({
      type: a.type,
      damageTypes: (a.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]),
      healingTypes: a.healing ? [...(a.healing.types ?? [])] : []
    }))
  };
}

/** Le token de ce locuteur, ou de cet acteur, sur la scène affichée. */
function tokenOnScene(message, actor) {
  const scene = canvas.scene;
  if ( !scene ) return null;
  const speaker = message?.speaker ?? {};
  if ( (speaker.scene === scene.id) && speaker.token ) return scene.tokens.get(speaker.token)?.object ?? null;
  return actor?.getActiveTokens?.(false, false)?.find(t => t.scene === scene) ?? null;
}

/** Les cibles de la carte, sur la scène affichée. */
function targetsOf(message) {
  return (message?.system?.targets ?? [])
    .map(t => fromUuidSync(t.token, { strict: false })?.object)
    .filter(t => t && (t.scene === canvas.scene));
}

/**
 * Ce qu'il faut jouer pour une utilisation : `{ kind, color, mood, damage, signature, user, targets }`, ou `{ skipped }`.
 * `targets` : les créatures touchées (la cible d'une flasque ; qui boit, ou à qui l'on administre, une potion).
 * @param {{ item: Item, activity?: object, user: Token|null, targets: Token[] }} use
 */
export function planConsumable({ item, activity=null, user=null, targets=[] }, backend) {
  const what = classify(summary(item), { kinds: KINDS, byIdentifier: BY_IDENTIFIER });
  if ( !what ) return { skipped: "not an animated consumable" };
  const identifier = item.system?.identifier;
  // BLFX joue déjà ces consommables-là, ou l'Auto-Rec personnalisée (notre table) le fait : pas deux fois.
  if ( (backend === "blfx") && (BLFX_BUILTIN.includes(identifier) || animations()[identifier]) ) {
    return { skipped: "played by BLFX" };
  }
  if ( !user ) return { skipped: "no token on the viewed scene" };
  // Sur soi : une activité « soi », ou sans cible désignée. Une flasque lancée a besoin d'une cible.
  const self = (activity?.target?.affects?.type === "self") || !targets.length;
  const on = (what.kind === "thrown") ? targets : (self ? [user] : targets);
  if ( !on.length ) return { skipped: "no target on the viewed scene" };
  return { ...what, user, targets: on };
}

/** Les tokens où joue une recette : l'utilisateur, ou les créatures touchées. */
const placesOf = (plan, at) => ((at === "user") ? [plan.user] : plan.targets);

/* -------------------------------------------- */
/*  Rendu BLFX (Sequencer)                       */
/* -------------------------------------------- */

const known = name => !!globalThis.Sequencer?.Database?.entryExists?.(name);

/** Ajoute une animation du pack à la séquence, sur ce token. */
function addEffect(sequence, name, place, { scale=1.5, delay=0, duration=0, below=false }={}) {
  const effect = sequence.effect().file(name).atLocation(place).scaleToObject(scale);
  if ( delay ) effect.delay(delay);
  if ( duration ) effect.duration(duration).fadeOut(500);
  if ( below ) effect.belowTokens();
}

/** Joue la recette BLFX d'un plan, et sa signature. Rend la liste de ce qui a été lancé. */
function playBlfx(plan) {
  const sequence = new Sequence({ moduleName: MODULE_ID });
  const played = [];
  for ( const part of BLFX_RECIPES[plan.kind] ?? [] ) {
    for ( const place of placesOf(plan, part.at) ) {
      if ( part.throw && known(part.throw) && (place !== plan.user) ) {
        sequence.effect().file(part.throw).atLocation(plan.user).stretchTo(place).waitUntilFinished(-300);
        played.push(part.throw);
      }
      if ( part.splash && known(part.splash) ) {
        addEffect(sequence, part.splash, place, { scale: 1.4 });
        played.push(part.splash);
        const impact = plan.damage ? fill(IMPACT, plan) : null;
        if ( impact && known(impact) ) { addEffect(sequence, impact, place, { scale: 1.3, delay: 200 }); played.push(impact); }
      }
      const animation = part.animation ? fill(part.animation, plan) : null;
      if ( animation && known(animation) ) { addEffect(sequence, animation, place, part); played.push(animation); }
    }
    if ( part.sound && known(part.sound) ) {
      const sound = sequence.sound().file(part.sound);
      if ( part.delay && !part.throw ) sound.delay(part.delay);
      played.push(part.sound);
    }
  }
  const signature = SIGNATURES[plan.signature]?.blfx;
  if ( signature && known(signature.animation) ) {
    for ( const place of plan.targets ) addEffect(sequence, signature.animation, place, { delay: 700, ...signature });
    played.push(signature.animation);
  }
  if ( played.length ) sequence.play();
  return played;
}

/* -------------------------------------------- */
/*  Rendu Token Magic FX                         */
/* -------------------------------------------- */

/**
 * Token Magic retire un filtre `autoDestroy` à la fin de ses boucles, mais seulement dans la boucle d'animation du client qui l'a
 * posé (fx/Anime.js, `autoDisableCheck`) : fenêtre du MJ en arrière-plan ou token hors de sa vue, elle ne tourne pas et le filtre
 * resterait. On le retire nous-mêmes à la fin prévue de son animation, plus cette marge.
 */
const SAFETY_MARGIN_MS = 1500;

/** Pose des filtres Token Magic sur ces tokens, et prévoit leur retrait. Rend la liste des filtres posés. */
export async function placeTokenMagic(tokens, recipe, color, tag, signature=null) {
  const played = [];
  for ( const token of tokens ) {
    const filterId = `${MODULE_ID}.${tag}.${foundry.utils.randomID(8)}`;
    const filters = tokenMagicFilters(recipe, color, filterId, signature);
    if ( !filters.length ) continue;
    await TokenMagic.addFilters(token, filters);
    played.push(...filters.map(f => `${f.filterType}:${token.name}`));
    setTimeout(() => {
      if ( token.document?.getFlag("tokenmagic", "filters")?.some(f => f.tmFilters?.tmFilterId === filterId) ) {
        TokenMagic.deleteFilters(token, filterId).catch(() => {});
      }
    }, filtersDuration(filters) + SAFETY_MARGIN_MS);
  }
  return played;
}

/** Pose les filtres de la recette Token Magic FX d'un plan, signature comprise. */
function playTokenMagic(plan) {
  const recipe = TOKENMAGIC_RECIPES[plan.kind];
  if ( !recipe ) return [];
  // La signature va sur les créatures touchées ; si la recette joue sur l'utilisateur, ce sont les mêmes.
  const signature = SIGNATURES[plan.signature]?.tokenmagic ?? null;
  return placeTokenMagic(placesOf(plan, recipe.at), recipe, COLORS[plan.color], plan.kind, signature);
}

/* -------------------------------------------- */
/*  Entrées                                      */
/* -------------------------------------------- */

/** Joue un plan avec ce rendu. Rend `{ backend, kind, color, mood, played }`. */
export async function playConsumable(plan, backend) {
  let played = [];
  if ( backend === "blfx" ) played = playBlfx(plan);
  else if ( backend === "tokenmagic" ) played = await playTokenMagic(plan);
  else if ( backend === "native" ) {
    const tokens = placesOf(plan, TOKENMAGIC_RECIPES[plan.kind]?.at ?? "targets");
    const drawn = playNative(tokens, COLORS[MOODS[plan.mood]]);
    played = tokens.slice(0, drawn).map(t => `ring:${MOODS[plan.mood]}:${t.name}`);
  }
  return { backend, kind: plan.kind, color: plan.color, mood: plan.mood, signature: plan.signature, played };
}

/** À la carte d'utilisation d'un consommable, chez le MJ actif. */
async function onUsage(message) {
  if ( (message.type !== "usage") || !isExecutor() ) return;
  const backend = renderer();
  if ( !backend ) return;
  const item = message.getAssociatedItem?.();
  if ( item?.type !== "consumable" ) return;
  const activity = message.getAssociatedActivity?.() ?? null;
  const plan = planConsumable({ item, activity, user: tokenOnScene(message, item.actor), targets: targetsOf(message) }, backend);
  if ( plan.skipped ) return;
  const result = await playConsumable(plan, backend);
  log(`${item.name}: ${result.kind} (${result.color}, ${result.mood}) by ${backend}, ${result.played.length} part(s)`);
}

export function registerConsumables() {
  Hooks.on("createChatMessage", message => {
    onUsage(message).catch(err => console.error(`${MODULE_ID} | consumable effect`, err));
  });
}

/**
 * Pour vérifier en jeu (MJ, ou connecteur MCP) : joue l'effet d'un consommable sans l'utiliser. `item` : uuid (compendium
 * accepté) ; `source`, `targets` : tokens de la scène affichée, par nom ou id ; `backend` : "blfx", "tokenmagic", "native" (défaut :
 * le réglage), avec le même ordre de repli.
 */
export async function previewConsumable({ item, source, targets=[], backend=null }={}) {
  const doc = await fromUuid(item);
  if ( !doc ) throw new Error(`item not found: ${item}`);
  const find = ref => canvas.scene?.tokens.find(t => (t.id === ref) || (t.name === ref))?.object ?? null;
  const chosen = renderer(backend ?? undefined);
  if ( !chosen ) return { skipped: "renderer set to none" };
  const activity = [...(doc.system?.activities ?? [])][0] ?? null;
  const plan = planConsumable({ item: doc, activity, user: find(source), targets: targets.map(find).filter(Boolean) }, chosen);
  if ( plan.skipped ) return plan;
  return playConsumable(plan, chosen);
}
