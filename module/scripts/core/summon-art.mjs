/**
 * Les choix de l'image animée d'une invocation (data/summon-art.mjs, SPEC §26), en fonctions pures : quelle entrée pour ce sort,
 * l'image du token est-elle encore celle du compendium (sinon le MJ l'a choisie : on n'y touche pas), quelles variantes la base de
 * Sequencer offre, laquelle poser, et la mise à jour du token qui la pose.
 */

import { SUMMON_ART, SUMMON_ART_ALIASES } from "../data/summon-art.mjs";

/** L'entrée de la table pour cet identifiant dnd5e (PHB ou SRD), avec sa clé, ou null. */
export function artEntry(identifier, table=SUMMON_ART, aliases=SUMMON_ART_ALIASES) {
  const key = aliases[identifier] ?? identifier;
  const entry = key ? table[key] : null;
  return entry ? { key, ...entry } : null;
}

/** Une UUID de compendium (« Compendium.<paquet>.<collection>.Actor.<id> ») ? */
export const isCompendiumUuid = uuid => typeof uuid === "string" && uuid.startsWith("Compendium.");

/**
 * L'image du token posé est-elle celle que le compendium d'origine donne ? Sinon le MJ (ou un autre module) l'a choisie.
 * `sourceSrc` : `prototypeToken.texture.src` de l'acteur du compendium. Vide (acteurs du SRD de dnd5e), Foundry pose l'image de
 * l'acteur ou le token par défaut : ces trois valeurs comptent alors comme « d'origine ».
 */
export function isOriginalArt({ tokenSrc, sourceSrc, sourceImg=null, defaultToken=null }) {
  const src = tokenSrc ?? "";
  if ( sourceSrc ) return src === sourceSrc;
  return [ "", sourceImg ?? "", defaultToken ?? "" ].includes(src);
}

/**
 * Les variantes offertes par la base de Sequencer sous `entry.family`. `flat` : liste `{ path, file }` (Sequencer
 * `Database.flattenedEntriesAdvanced`). Une variante par fichier vidéo (JB2A gratuit range parfois le même fichier sous deux noms :
 * le plus long, le plus précis, est gardé), le premier fichier d'une entrée qui en a plusieurs. Rend `[{ name, file, group, label }]`
 * trié, `group` = le segment qui suit la famille si l'entrée groupe (l'arme), sinon null.
 */
export function variantsOf(entry, flat) {
  if ( !entry?.family ) return [];
  const prefix = `${entry.family}.`;
  const byName = new Map();
  for ( const { path, file } of flat ?? [] ) {
    if ( (typeof path !== "string") || !path.startsWith(prefix) || (typeof file !== "string") ) continue;
    if ( !/\.(webm|mp4|webp|png|gif)$/i.test(file) ) continue;
    // Une entrée à plusieurs fichiers (« file: [a, b] ») revient plusieurs fois sous le même chemin : le premier fichier vaut.
    if ( !byName.has(path) ) byName.set(path, file);
  }
  const byFile = new Map();
  for ( const [name, file] of byName ) {
    const kept = byFile.get(file);
    if ( !kept || (name.length > kept.length) ) byFile.set(file, name);
  }
  return [...byFile].map(([file, name]) => {
    const rest = name.slice(prefix.length).split(".");
    const group = entry.group ? rest[0] : null;
    const label = (entry.group ? rest.slice(1) : rest).join(" ") || rest.join(" ");
    return { name, file, group, label };
  }).sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label));
}

/** La variante à poser d'office : la dernière choisie si elle existe encore, sinon celle de la table, sinon la première. */
export function chooseVariant(variants, { last=null, fallback=null }={}) {
  if ( !variants?.length ) return null;
  return variants.find(v => v.name === last) ?? variants.find(v => v.name === fallback) ?? variants[0];
}

/**
 * La mise à jour du token qui pose cette variante : la texture (teinte remise à blanc — la Sphère de feu du compendium est teintée
 * orange —, échelle de l'entrée), l'anneau dynamique coupé (il découpe l'image en rond), et de quoi revenir en arrière dans
 * `flags.darsh-animations.summonArt` (`from` n'est écrit qu'à la première pose).
 */
export function artUpdate(entry, variant, token, { moduleId="darsh-animations" }={}) {
  const scale = entry.scale ?? 1;
  const previous = token?.flags?.[moduleId]?.summonArt?.from;
  const from = previous ?? {
    src: token?.texture?.src ?? null, tint: token?.texture?.tint ?? null,
    scaleX: token?.texture?.scaleX ?? 1, scaleY: token?.texture?.scaleY ?? 1, ring: !!token?.ring?.enabled
  };
  return {
    "texture.src": variant.file, "texture.tint": "#ffffff", "texture.scaleX": scale, "texture.scaleY": scale,
    "texture.fit": "contain", "ring.enabled": false,
    [`flags.${moduleId}.summonArt`]: { key: entry.key, name: variant.name, from }
  };
}

/** La mise à jour qui rend au token l'image qu'il avait avant (null si rien n'a été posé). */
export function restoreUpdate(token, { moduleId="darsh-animations" }={}) {
  const from = token?.flags?.[moduleId]?.summonArt?.from;
  if ( !from ) return null;
  return {
    "texture.src": from.src, "texture.tint": from.tint, "texture.scaleX": from.scaleX, "texture.scaleY": from.scaleY,
    // Le drapeau est vidé, pas supprimé : « -=clé » est ignoré par certaines mises à jour en V14 (foundry-core-notes).
    "ring.enabled": from.ring, [`flags.${moduleId}.summonArt`]: null
  };
}
