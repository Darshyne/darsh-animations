/**
 * Les sources d'animation et leur ordre (SPEC §23) : quelle source joue chaque domaine, selon ce qui est installé et l'ordre que le MJ
 * a réglé dans la fenêtre « Sources d'animation ». Pur : la détection des modules est faite par runtime/sources.mjs.
 *
 * - **Ordre** : une liste de sources, la première disponible qui sait faire le domaine joue. « Automated Animations » ne joue que ses
 *   animations **personnalisées**, objet par objet : placé avant une source, il passe devant elle ; placé après, elle le fait taire.
 * - **BLFX joue de lui-même** ce que son Auto-Rec reconnaît (attaques, sorts, zones, invocations, quelques états) : rien ne l'arrête
 *   objet par objet. Une source de DAS placée **avant** BLFX joue alors **aussi** ces objets (les deux se voient) ; placée après, elle se
 *   tait devant lui.
 * - **Domaine coupé** : rien de DAS · Animations n'y joue (BLFX et AA continuent ce qu'ils font d'eux-mêmes).
 */

/** Les sources, dans l'ordre par défaut. */
// BLFX d'abord : une animation personnalisée d'AA se tait devant lui (ancien réglage `aaYieldToBlfx`, allumé par défaut), mais passe
// devant le rendu propre de ce module (SPEC §21.5, D2).
export const SOURCES = Object.freeze(["blfx", "aa", "jb2a", "tokenmagic", "native"]);

/** Les domaines de la fenêtre, et les sources qui savent les jouer (dans l'ordre par défaut). */
export const DOMAINS = Object.freeze({
  strikes: ["aa", "blfx", "jb2a"],
  conditions: ["blfx", "jb2a"],
  consumables: ["aa", "blfx", "jb2a", "tokenmagic", "native"],
  traps: ["blfx", "jb2a", "tokenmagic", "native"],
  walls: ["aa", "blfx", "jb2a"],
  areas: ["aa", "blfx", "jb2a", "tokenmagic"],
  doors: ["blfx", "jb2a"],
  summons: ["blfx", "jb2a"]
});

/** Les domaines où BLFX joue de lui-même (son Auto-Rec), sans que ce module le lui demande. */
export const BLFX_OWN = Object.freeze(["strikes", "conditions", "areas", "summons"]);

/** Les domaines où une animation personnalisée d'Automated Animations compte. */
export const AA_DOMAINS = Object.freeze(Object.keys(DOMAINS).filter(d => DOMAINS[d].includes("aa")));

/** Les ordres de l'ancien réglage « renderer » (« à partir de… »). */
const LEGACY_CHAIN = Object.freeze(["blfx", "jb2a", "tokenmagic", "native"]);

/** La valeur par défaut : ordre par défaut, tout allumé. */
export function defaultSources() {
  return { order: [...SOURCES], off: [], domains: Object.fromEntries(Object.keys(DOMAINS).map(d => [d, true])) };
}

/**
 * Une valeur lue complétée : ordre sans doublon ni inconnu, sources manquantes ajoutées à leur place par défaut, domaines manquants
 * allumés. Accepte null (rend le défaut).
 */
export function normalizeSources(value) {
  const base = defaultSources();
  if ( !value || (typeof value !== "object") ) return base;
  const order = [...new Set((Array.isArray(value.order) ? value.order : []).filter(s => SOURCES.includes(s)))];
  for ( const s of SOURCES ) {
    if ( order.includes(s) ) continue;
    // Une source oubliée reprend sa place par défaut : après la source qui la précède dans l'ordre par défaut.
    const before = SOURCES.slice(0, SOURCES.indexOf(s)).reverse().find(p => order.includes(p));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, s);
  }
  const off = [...new Set((Array.isArray(value.off) ? value.off : []).filter(s => SOURCES.includes(s)))];
  const domains = { ...base.domains };
  for ( const d of Object.keys(DOMAINS) ) if ( value.domains?.[d] === false ) domains[d] = false;
  return { order, off, domains };
}

/**
 * La valeur tirée des anciens réglages (avant la fenêtre) : `renderer` (« auto » ou « à partir de… », « none »), `strikes`,
 * `conditions`, `aaYieldToBlfx`, `conditionsWithBlfx`.
 */
export function migrateSources({ renderer="auto", strikes=true, conditions=true, aaYieldToBlfx=true, conditionsWithBlfx=false }={}) {
  const value = defaultSources();
  // « À partir de JB2A » : les sources avant lui sont coupées ; « aucun » : les domaines qu'il réglait sont coupés.
  if ( renderer === "none" ) {
    for ( const d of ["consumables", "traps", "walls", "areas", "doors", "summons"] ) value.domains[d] = false;
  } else if ( LEGACY_CHAIN.includes(renderer) ) {
    value.off = LEGACY_CHAIN.slice(0, LEGACY_CHAIN.indexOf(renderer));
  }
  if ( strikes === false ) value.domains.strikes = false;
  if ( conditions === false ) value.domains.conditions = false;
  // L'ancien « AA personnalisé laisse la place à BLFX » éteint : AA passe avant BLFX.
  if ( aaYieldToBlfx === false ) value.order = ["aa", "blfx", ...SOURCES.filter(s => !["aa", "blfx"].includes(s))];
  // L'ancien « états aussi devant BLFX » n'est pas repris : passer JB2A avant BLFX ferait aussi doubler les attaques que BLFX joue.
  return value;
}

/** `a` vient-il avant `b` dans l'ordre ? */
export function ranksBefore(value, a, b) {
  const order = normalizeSources(value).order;
  return order.indexOf(a) < order.indexOf(b);
}

/**
 * Les sources utilisables pour un domaine, dans l'ordre réglé : allumées, présentes (`available`) et qui savent le faire. Vide quand
 * le domaine est coupé. « native » est toujours présent.
 * @param {string} domain
 * @param {object} value                 le réglage `sources`
 * @param {Record<string, boolean>} available
 */
export function sourceChain(domain, value, available={}) {
  const v = normalizeSources(value);
  if ( !DOMAINS[domain] || (v.domains[domain] === false) ) return [];
  return v.order.filter(s => DOMAINS[domain].includes(s) && !v.off.includes(s) && ((s === "native") || available[s]));
}

/**
 * La source qui joue un domaine **pour ce que ce module joue lui-même** : la première de la chaîne, sans Automated Animations (qui ne
 * joue que ses animations personnalisées, objet par objet). null : rien.
 */
export function pickSource(domain, value, available={}) {
  return sourceChain(domain, value, available).find(s => s !== "aa") ?? null;
}

/**
 * La source `own` de ce module se tait-elle devant BLFX, pour un objet que l'Auto-Rec de BLFX reconnaît ? Oui dans les domaines où BLFX
 * joue de lui-même, quand BLFX est placé avant elle — même coupé dans la fenêtre : couper BLFX ne règle que ce que ce module lui
 * demande (consommables, pièges, murs, portes, châtiments), pas son Auto-Rec.
 */
export function yieldsToBlfx(domain, value, own) {
  return BLFX_OWN.includes(domain) && ranksBefore(value, "blfx", own);
}

/**
 * Le tableau de la fenêtre : par domaine, la source qui jouera ce que ce module joue, et les remarques. `notes` : "blfxAlso" (une
 * source de DAS passe avant BLFX là où il joue de lui-même : les deux se voient), "aaFirst" (AA personnalisé passe devant), "off",
 * "nothing" (aucune source utilisable).
 */
export function sourceTable(value, available={}) {
  const v = normalizeSources(value);
  return Object.keys(DOMAINS).map(domain => {
    const capable = DOMAINS[domain];
    if ( v.domains[domain] === false ) return { domain, on: false, source: null, capable, notes: ["off"] };
    const chain = sourceChain(domain, v, available);
    const source = chain.find(s => s !== "aa") ?? null;
    const notes = [];
    if ( !source ) notes.push("nothing");
    if ( available.blfx && source && (source !== "blfx") && !yieldsToBlfx(domain, v, source) && BLFX_OWN.includes(domain) ) notes.push("blfxAlso");
    if ( chain.includes("aa") && source && ranksBefore(v, "aa", source) ) notes.push("aaFirst");
    return { domain, on: true, source, capable, notes };
  });
}

/** Déplace une source d'un cran (`delta` −1 vers le haut, +1 vers le bas). Rend une nouvelle valeur. */
export function moveSource(value, source, delta) {
  const v = normalizeSources(value);
  const i = v.order.indexOf(source);
  const j = i + delta;
  if ( (i < 0) || (j < 0) || (j >= v.order.length) ) return v;
  const order = [...v.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...v, order };
}

/** Place une source avant une autre (glisser-déposer). Rend une nouvelle valeur. */
export function placeSource(value, source, before) {
  const v = normalizeSources(value);
  if ( (source === before) || !v.order.includes(source) ) return v;
  const order = v.order.filter(s => s !== source);
  const at = before ? order.indexOf(before) : -1;
  order.splice(at < 0 ? order.length : at, 0, source);
  return { ...v, order };
}

/**
 * Les remarques de la détection (pures, à partir de l'état des modules) : `modules` par id → `{ installed, active }`, plus les
 * réglages lus de BLFX. Rend une liste de `{ level: "warn"|"info", key, data? }` (clés de langue `DARSHANIM.Sources.Notes.<key>`).
 */
export function detectionNotes({ modules={}, sequencer=false, blfxCustomUpdates=true, blfxAutoRec=true }={}) {
  const on = id => !!modules[id]?.active;
  const installedOff = id => !!modules[id]?.installed && !modules[id]?.active;
  const notes = [];
  const needSequencer = ["boss-loot-assets-premium", "JB2A_DnD5e", "jb2a_patreon", "psfx"].filter(on);
  if ( needSequencer.length && !sequencer ) notes.push({ level: "warn", key: "NoSequencer" });
  if ( on("JB2A_DnD5e") && on("jb2a_patreon") ) notes.push({ level: "info", key: "BothJb2a" });
  if ( (on("JB2A_DnD5e") || on("jb2a_patreon")) && !on("psfx") ) notes.push({ level: "info", key: "NoPsfx" });
  if ( on("boss-loot-assets-premium") && !blfxCustomUpdates ) notes.push({ level: "warn", key: "BlfxUpdates" });
  if ( on("boss-loot-assets-premium") && !blfxAutoRec ) notes.push({ level: "info", key: "BlfxAutoRecOff" });
  if ( !["boss-loot-assets-premium", "JB2A_DnD5e", "jb2a_patreon", "tokenmagic"].some(on) ) notes.push({ level: "info", key: "OnlyNative" });
  for ( const id of ["boss-loot-assets-premium", "JB2A_DnD5e", "jb2a_patreon", "psfx", "tokenmagic", "sequencer"] ) {
    if ( installedOff(id) ) notes.push({ level: "info", key: "InstalledOff", data: { id } });
  }
  return notes;
}
