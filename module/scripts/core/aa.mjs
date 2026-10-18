/**
 * Automated Animations (AA, `autoanimations` 7.1.8) dans toutes les langues — ce qui se décide sans Foundry (SPEC §17).
 *
 * AA reconnaît un objet par son **nom** (dist/autoanimations.js:15614-15706, `handleItem`) : il essaie dans l'ordre les noms
 * `overrideNames` (le nom de l'activité, puis ce que les modules ajoutent au hook `aa.getRequiredData`), le nom de l'objet, puis
 * `extraNames`. Pour chaque nom, `rinseName` (espaces retirés, minuscules) ; d'abord une entrée « correspondance exacte » dont le
 * libellé est égal au nom, sinon la première entrée — libellés les plus longs d'abord — dont le libellé rincé est **contenu** dans
 * le nom rincé, sauf si l'un de ses termes exclus l'est aussi. Un monde en français ne trouve donc rien : « Boule de feu » ne
 * contient pas « fireball ».
 *
 * Le module « Automated Animation for Babele » ajoute le nom anglais (`flags.babele.originalName`, sinon l'identifiant mis en
 * forme) à `overrideNames`. Limites corrigées ici : l'identifiant mis en forme perd les apostrophes (« hunters-mark » ne contient
 * pas « hunter'smark »), le nom traduit d'une activité passe avant, l'arme de base (`baseItem`) est ignorée, et une zone échoue
 * quand le nom anglais tombe sur une entrée de corps à corps, à distance ou sur un token (AA recherche alors parmi les zones avec
 * le nom **traduit**, 15691-15696). Ici, on retrouve nous-mêmes l'entrée d'AA par des clés sans langue ni ponctuation, et on lui
 * donne son **libellé exact**, en tête : AA retombe forcément sur cette entrée.
 */

/** Une clé de comparaison : sans accents, minuscules, lettres et chiffres seulement (« Hunter's Mark » → « huntersmark »). */
export function normalize(text) {
  return String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Le `rinseName` d'AA (15512). */
export const rinse = text => String(text ?? "").replace(/\s+/g, "").toLowerCase();

/** Les menus de l'Auto-Rec d'AA, dans l'ordre où il les fusionne (15519, `sortAndFilterMenus`). */
export const MENUS = Object.freeze(["melee", "range", "ontoken", "templatefx", "aura", "preset"]);

/** Les menus où une zone posée peut trouver son entrée sans que AA la recherche une seconde fois (15691). */
export const AREA_MENUS = Object.freeze(["templatefx", "aura", "preset"]);

/**
 * Les entrées de ces menus, triées comme AA les trie : libellé le plus long d'abord (sans espaces), tri stable.
 * @param {Record<string, object[]>} settings   `{ melee: [...], range: [...], ... }` (réglages `aaAutorec-<menu>`)
 * @param {string[]} [menus]
 */
export function sortedEntries(settings, menus=MENUS) {
  const all = menus.flatMap(menu => (settings?.[menu] ?? []).filter(e => e?.label).map(e => ({ ...e, menu: e.menu ?? menu })));
  return all.sort((a, b) => b.label.replace(/\s+/g, "").length - a.label.replace(/\s+/g, "").length);
}

/** La recherche d'AA pour un nom (15528, `allMenuSearch`), sur des entrées déjà triées. Rend l'entrée, ou null. */
export function aaSearch(entries, name) {
  if ( !name ) return null;
  const rinsed = rinse(name);
  const exact = entries.find(e => e.advanced?.exactMatch && (e.label === name));
  if ( exact ) return exact;
  return entries.find(e => !e.advanced?.exactMatch && rinsed.includes(rinse(e.label))
    && !(e.advanced?.excludedTerms ?? []).some(t => t && rinsed.includes(rinse(t)))) ?? null;
}

/**
 * Ce qu'AA trouvera de lui-même avec ces noms (activité, objet…), zone comprise : une entrée de corps à corps, à distance ou sur
 * token trouvée pour une zone le fait rechercher parmi les zones avec le nom de l'objet seul. Rend l'entrée, ou null.
 * @param {Record<string, object[]>} settings
 * @param {{ names: string[], itemName: string, isTemplate?: boolean }} use
 */
export function aaNative(settings, { names=[], itemName="", isTemplate=false }) {
  const entries = sortedEntries(settings);
  let found = null;
  for ( const name of names ) if ( (found = aaSearch(entries, name)) ) break;
  if ( found && isTemplate && ["melee", "range", "ontoken"].includes(found.menu) ) {
    found = aaSearch(sortedEntries(settings, ["templatefx"]), itemName);
  }
  return found;
}

/**
 * Notre recherche, sur des clés normalisées : d'abord une entrée « exacte » dont le libellé normalisé est la clé, sinon la première
 * (libellés les plus longs d'abord) dont le libellé normalisé est contenu dans la clé, termes exclus respectés.
 */
export function keySearch(entries, key) {
  if ( !key ) return null;
  const exact = entries.find(e => e.advanced?.exactMatch && (normalize(e.label) === key));
  if ( exact ) return exact;
  return entries.find(e => {
    if ( e.advanced?.exactMatch ) return false;
    const label = normalize(e.label);
    return label && key.includes(label) && !(e.advanced?.excludedTerms ?? []).some(t => normalize(t) && key.includes(normalize(t)));
  }) ?? null;
}

/**
 * Les clés anglaises d'un objet, dans l'ordre où on les essaie (normalisées, sans doublon, sans celles qu'AA a déjà : le nom
 * affiché lui-même).
 *  1. le nom anglais de l'activité (traduit : retrouvé dans la table de la langue), comme AA qui essaie l'activité d'abord ;
 *  2. `flags.babele.originalName` (Babele le pose sur tout document traduit) ;
 *  3. le nom anglais de l'objet dans la table de la langue (`module/names/<langue>.json`) ;
 *  4. l'identifiant dnd5e (tiré du nom anglais pour le SRD et les livres officiels) ;
 *  5. l'arme, l'armure ou l'outil de base (`system.type.baseItem` : « longsword »).
 * @param {{ name?: string, activityName?: string, babeleName?: string, identifier?: string, baseItem?: string }} item
 * @param {Record<string, string>} [names]   nom normalisé dans la langue du monde → nom anglais
 */
export function englishKeys({ name="", activityName="", babeleName="", identifier="", baseItem="" }={}, names={}) {
  const own = new Set([normalize(name), normalize(activityName)]);
  const keys = [];
  const push = text => {
    const key = normalize(text);
    if ( key && !own.has(key) && !keys.includes(key) ) keys.push(key);
  };
  if ( activityName ) push(names[normalize(activityName)]);
  push(babeleName);
  push(names[normalize(name)]);
  if ( identifier && (identifier !== "new-item") ) push(identifier);
  push(baseItem);
  return keys;
}

/**
 * Le libellé d'entrée à donner à AA, ou null s'il n'y a rien à faire.
 * - Si AA trouve déjà une entrée avec ses propres noms (une entrée en français du MJ, un nom identique), on le laisse faire.
 * - Sinon, la première clé anglaise qui trouve une entrée ; pour une zone, parmi les seules entrées de zone (AA échouerait sur les
 *   autres, voir plus haut).
 * @param {Record<string, object[]>} settings   les menus de l'Auto-Rec d'AA
 * @param {{ keys: string[], nativeNames: string[], itemName: string, isTemplate?: boolean }} use
 * @returns {{ label: string, menu: string, key: string } | null}
 */
export function resolveLabel(settings, { keys=[], nativeNames=[], itemName="", isTemplate=false }) {
  if ( aaNative(settings, { names: nativeNames, itemName, isTemplate }) ) return null;
  const entries = sortedEntries(settings, isTemplate ? AREA_MENUS : MENUS);
  for ( const key of keys ) {
    const entry = keySearch(entries, key);
    if ( entry ) return { label: entry.label, menu: entry.menu, key };
  }
  return null;
}

/**
 * AA jouera-t-il quelque chose pour cette utilisation ? Ses drapeaux d'abord (activité, puis objet : `killAnim` ou `isEnabled:
 * false` l'éteignent, `isCustomized` l'allume), puis son Auto-Rec — avec ses propres noms, ou, si la reconnaissance multilingue est
 * allumée, avec nos clés anglaises.
 * @param {{ itemFlags?: object, activityFlags?: object, autorecDisabled?: boolean, settings: object,
 *   keys?: string[], nativeNames?: string[], itemName?: string, isTemplate?: boolean, translate?: boolean }} use
 */
export function aaWillPlay({ itemFlags=null, activityFlags=null, autorecDisabled=false, settings={}, keys=[], nativeNames=[],
  itemName="", isTemplate=false, translate=true }) {
  for ( const flags of [activityFlags, itemFlags] ) {
    if ( !flags ) continue;
    if ( flags.killAnim || (flags.isEnabled === false) ) return false;
  }
  if ( activityFlags?.isCustomized || itemFlags?.isCustomized ) return true;
  if ( autorecDisabled ) return false;
  if ( aaNative(settings, { names: nativeNames, itemName, isTemplate }) ) return true;
  return !!(translate && resolveLabel(settings, { keys, nativeNames: [], itemName, isTemplate }));
}
