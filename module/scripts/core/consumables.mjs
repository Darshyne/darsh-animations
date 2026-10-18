/**
 * Choisir l'effet d'un consommable (data/consumables.mjs) : pur, testable hors du jeu.
 */

export const BACKENDS = Object.freeze(["auto", "blfx", "jb2a", "tokenmagic", "native", "none"]);

/** L'ordre des rendus (décisions utilisateur, 2026-10-13 puis 2026-10-18) : BLFX > JB2A + PSFX > Token Magic FX > autonome. */
export const ORDER = Object.freeze(["blfx", "jb2a", "tokenmagic", "native"]);

/** Boissons parmi la nourriture : l'eau et les pintes (bière, vin, miel…). */
const DRINKS = /(^|-)(water|pint|wine|beer|ale|mead|tea|milk)(-|$)/;

/**
 * Un item résumé : `{ type, subtype, identifier, activities: [{ type, damageTypes, healingTypes }] }` (type d'item dnd5e,
 * `system.type.value`, `system.identifier`, et de chaque activité son type, les types de dégâts et de soin).
 * Rend `{ kind, color, mood, damage, signature }`, ou null : pas un consommable qu'on anime.
 * @param {object} item
 * @param {{ kinds: object, byIdentifier: object }} data   data/consumables.mjs KINDS, BY_IDENTIFIER
 */
export function classify(item, { kinds, byIdentifier }) {
  if ( item?.type !== "consumable" ) return null;
  const known = byIdentifier[item.identifier] ?? {};
  const kind = known.kind ?? genericKind(item);
  if ( !kind || !kinds[kind] ) return null;
  return { kind, color: known.color ?? kinds[kind].color, mood: known.mood ?? kinds[kind].mood, damage: known.damage ?? null,
    signature: known.signature ?? null };
}

/** La sorte d'un consommable sans entrée propre, d'après son sous-type et ses activités. */
function genericKind({ subtype, identifier="", activities=[] }) {
  switch ( subtype ) {
    case "scroll": return "scroll";
    case "poison": return "poison";
    case "food": return DRINKS.test(identifier) ? "drink" : "food";
    case "potion": {
      if ( activities.some(a => (a.type === "heal") && (a.healingTypes ?? []).length) ) return "heal";
      // Une potion qui ne fait que du poison (Poison basique, Potion de poison) empoisonne celui qui la boit.
      const damage = activities.flatMap(a => a.damageTypes ?? []);
      if ( damage.length && damage.every(t => t === "poison") ) return "poison";
      return "potion";
    }
    default: return null;   // munitions, babioles (lanternes, cordes, torches…), baguettes : d'autres s'en occupent
  }
}

/**
 * Le rendu à utiliser. En « auto », le premier disponible de l'ordre ; un rendu demandé mais absent retombe sur le suivant de
 * l'ordre ; le rendu autonome est toujours là. « none » : rien.
 * @param {string} setting            "auto" | "blfx" | "jb2a" | "tokenmagic" | "native" | "none"
 * @param {{ blfx?: boolean, jb2a?: boolean, tokenmagic?: boolean }} available
 */
export function pickBackend(setting, available={}) {
  if ( setting === "none" ) return null;
  const from = Math.max(0, ORDER.indexOf(setting));
  return ORDER.slice(from).find(b => (b === "native") || available[b]) ?? "native";
}

/** Remplace `{color}` et `{damage}` dans un nom d'animation (BLFX, ou JB2A avec la variante de couleur). */
export function fill(name, { color, damage }={}) {
  return String(name).replaceAll("{color}", color ?? "").replaceAll("{damage}", damage ?? "");
}

/**
 * Une pulsation Token Magic FX : `cosOscillation` non synchronisée part de `val1`, atteint `val2` à mi-boucle et y revient
 * (fx/Anime.js, `Anime.oscillation`). `syncShift` doit être donné : absent, la valeur devient NaN. Les types sans `loopDuration`
 * (`move`) ne finissent jamais leurs boucles, donc jamais `autoDestroy`.
 */
const PULSE = Object.freeze({ active: true, loopDuration: 1400, animType: "cosOscillation", syncShift: 0, val1: 0 });

/**
 * Les filtres Token Magic FX d'une recette (data/consumables.mjs TOKENMAGIC_RECIPES) pour une couleur (nombre 0xRRGGBB).
 * Chaque filtre porte `filterId` (pour le retrouver) et `autoDestroy` : Token Magic le retire lui-même après ses boucles
 * (fx/Anime.js, `autoDisableCheck`), chez le client qui l'a posé.
 */
export function tokenMagicFilters(recipe, color, filterId, signature=null) {
  const filters = [];
  const glow = recipe?.glow;
  if ( glow ) filters.push({
    filterType: "glow", filterId, autoDestroy: true, outerStrength: 0, innerStrength: 0, color, quality: 0.5, padding: 10,
    animated: { outerStrength: { ...PULSE, val2: glow.strength ?? 5, loops: glow.loops ?? 2 } }
  });
  if ( recipe?.bloom ) filters.push({
    filterType: "xbloom", filterId, autoDestroy: true, threshold: 0.35, bloomScale: 0, brightness: 1, blur: 0.1, padding: 10,
    quality: 15, blendMode: 0,
    animated: { bloomScale: { ...PULSE, val2: 1.5, loops: glow?.loops ?? 1 } }
  });
  if ( recipe?.wave ) filters.push({
    filterType: "shockwave", filterId, autoDestroy: true, time: 0, amplitude: 6, wavelength: 70, radius: 300, brightness: 1.3,
    speed: 25, padding: 0,
    // Une seule onde, de 0 à 2 sur la boucle (demi-oscillation : monotone).
    animated: { time: { active: true, loopDuration: 1200, animType: "halfCosOscillation", syncShift: 0, val1: 0, val2: 2, loops: 1 } }
  });
  // Signature (data/consumables.mjs SIGNATURES) : un filtre de plus, sur la même durée que la lueur.
  const loops = glow?.loops ?? 1;
  if ( signature?.fade !== undefined ) filters.push({
    filterType: "adjustment", filterId, autoDestroy: true, alpha: 1,
    animated: { alpha: { ...PULSE, val1: 1, val2: signature.fade, loops } }
  });
  if ( signature?.blur !== undefined ) filters.push({
    filterType: "blur", filterId, autoDestroy: true, blur: 0, quality: 4, padding: 10,
    animated: { blur: { ...PULSE, val2: signature.blur, loops } }
  });
  if ( signature?.scale !== undefined ) filters.push({
    filterType: "transform", filterId, autoDestroy: true, scaleX: 1, scaleY: 1,
    animated: {
      scaleX: { ...PULSE, val1: 1, val2: signature.scale, loops },
      scaleY: { ...PULSE, val1: 1, val2: signature.scale, loops }
    }
  });
  return filters;
}

/** Durée de l'animation la plus longue d'une liste de filtres, en ms (boucles × durée de boucle). */
export function filtersDuration(filters) {
  return Math.max(0, ...filters.flatMap(f => Object.values(f.animated ?? {}).map(a => (a.loopDuration ?? 0) * (a.loops ?? 1))));
}
