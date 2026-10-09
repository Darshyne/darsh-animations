/**
 * Ce que BLFX (« boss-loot-assets-premium » 3.5.2) attend de son Auto-Rec personnalisée, en fonctions pures.
 *
 * Lecture faite dans ses sources :
 *  - recherche : `BlfxMacroExecutor.getCustomAutoRecognitionAnimation` (apps/BlfxMacroExecutor.js) lit
 *    `customAR[systemId][slugify(item.name)][slugify(activity.name)][attackMode].animationData.command` ;
 *    `attackMode` est le déclencheur (`afterAttack`, `afterItemUse`…), ou `afterThrown` pour une attaque lancée ;
 *  - `slugify` : helperFunctions.js:825 — minuscules, tout ce qui n'est pas [a-z0-9 espace] est RETIRÉ (« é » compris) ;
 *  - entrée enregistrée par l'éditeur : `saveCustomAutoRecognitionAnimation` — { animationName, itemName, activityName,
 *    triggerName, note, animationData: { command, eventType, macroType } } ;
 *  - libellés des déclencheurs : `TRIGGER_MAP` (constants.js:94).
 *
 * Aucune référence à `game`, `canvas`, `Hooks`, `CONFIG`, `foundry` ici.
 */

/** Le marqueur de nos entrées, dans leur `note` : ce qui le porte est à nous, le reste au MJ. */
export const TAG = "darsh-animations";

/** Les déclencheurs BLFX et le libellé que son éditeur leur donne. */
export const TRIGGERS = Object.freeze({
  afterItemUse: "After Activity Use (Default)",
  afterAttack: "After Attack Roll",
  afterThrown: "After Attack Roll",
  afterDamage: "After Damage Roll",
  afterActiveEffects: "After Active Effects",
  afterSummon: "After Summon",
  createTemplate: "After Template Create"
});

/** Les modèles de l'éditeur BLFX (compendium « blfx-macros ») et le type d'animation qu'il affiche. */
export const TEMPLATES = Object.freeze({
  melee: { macro: "blfx | Attack Melee", macroType: "Attack Melee" },
  ranged: { macro: "blfx | Attack Ranged", macroType: "Attack Ranged" },
  target: { macro: "blfx | On Target or Token", macroType: "On Target or Token" },
  effect: { macro: "blfx | On Target or Token (AE)", macroType: "On Target or Token (AE)" },
  circle: { macro: "blfx | Template Circle", macroType: "Template Circle" },
  cone: { macro: "blfx | Template Cone", macroType: "Template Cone" },
  line: { macro: "blfx | Template Line", macroType: "Template Line" },
  square: { macro: "blfx | Template Square", macroType: "Template Square" },
  summon: { macro: "blfx | Summon", macroType: "Summon" },
  teleportSelf: { macro: "blfx | Teleport Source Token", macroType: "Teleport Source Token" },
  teleportTarget: { macro: "blfx | Teleport Target Token(s)", macroType: "Teleport Target Token(s)" }
});

/** Le `slugify` de BLFX, à l'identique. */
export function slugify(input) {
  if ( !input ) return "";
  return String(input).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).join("-");
}

/** Une valeur JavaScript écrite en littéral dans une macro. */
function literal(value) {
  if ( typeof value === "string" ) return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if ( (typeof value === "number") && Number.isFinite(value) ) return String(value);
  if ( typeof value === "boolean" ) return String(value);
  throw new Error(`unsupported value: ${JSON.stringify(value)}`);
}

/**
 * Le modèle avec nos valeurs : chaque `const NOM = …;` de son en-tête reçoit celle de `params`.
 * Un paramètre que le modèle ne déclare pas est une erreur (jamais de réglage ignoré en silence).
 * @param {string} command                Le texte du modèle BLFX.
 * @param {Record<string, string|number|boolean>} params
 * @returns {string}
 */
export function applyParams(command, params={}) {
  let out = command;
  for ( const [key, value] of Object.entries(params) ) {
    const pattern = new RegExp(`^(const ${key} = )(.*?);([^\\n]*)$`, "m");
    if ( !pattern.test(out) ) throw new Error(`the template does not declare ${key}`);
    out = out.replace(pattern, (_, head, _old, tail) => `${head}${literal(value)};${tail}`);
  }
  return out;
}

/** Le chemin de la table d'Auto-Rec de BLFX (scripts/animationMap.js, `export const ANIMATION_MAP`). */
export const ANIMATION_MAP_PATH = "modules/boss-loot-assets-premium/scripts/animationMap.js";

/**
 * Une macro qui rejoue une animation que BLFX a déjà dans sa propre Auto-Rec, pour un item qu'il ne reconnaît pas par son nom
 * (une « Lame décapitante » jouée comme son « longsword »). Elle appelle la macro de BLFX comme lui le fait
 * (`executeAutomaticRecognition` : `macro({ sourceToken, targetTokens, templateDocument, item, roll, activity, effect, data,
 * ...defaultParams })`) ; les noms de la portée sont ceux que BLFX passe à une macro d'Auto-Rec personnalisée.
 * @param {string} alias      « type.clé » dans ANIMATION_MAP.dnd5e (weapon.claw, feat.deathly-touch, spell.command…).
 * @param {string} trigger    Le déclencheur de BLFX à rejouer (afterAttack…).
 */
export function aliasCommand(alias, trigger) {
  const [type, key, ...rest] = String(alias).split(".");
  if ( !type || !key || rest.length ) throw new Error(`alias "${alias}": expected "type.key"`);
  const path = JSON.stringify([type, key, trigger]);
  return `// ${TAG}: BLFX animation "${alias}" (${trigger})
const { ANIMATION_MAP } = await import(foundry.utils.getRoute(${JSON.stringify(ANIMATION_MAP_PATH)}));
const [type, key, trigger] = ${path};
const anim = ANIMATION_MAP?.dnd5e?.[type]?.[key]?.[trigger];
if ( !(anim?.macro instanceof Function) ) return console.warn("${TAG} | BLFX animation not found:", ${JSON.stringify(`${alias}.${trigger}`)});
await anim.macro({ sourceToken, targetTokens, templateDocument, item, roll, activity, effect, data, ...(anim.defaultParams ?? {}) });`;
}

/**
 * Les entrées d'Auto-Rec de nos animations pour les items trouvés dans le monde et les compendiums.
 * @param {object} args
 * @param {{name: string, identifier: string, activities: {name: string, type: string}[]}[]} args.items
 * @param {Record<string, object[]>} args.table      Identifiant dnd5e → animations (data/animations.mjs).
 * @param {Record<string, string>} args.templates    Clé de TEMPLATES → texte du modèle BLFX.
 * @param {string} args.version
 * @returns {{ entries: Record<string, Record<string, Record<string, object>>>, problems: string[] }}
 */
export function buildEntries({ items, table, templates, version }) {
  const entries = {};
  const problems = [];
  for ( const item of items ) {
    const animations = table[item.identifier];
    if ( !animations ) continue;
    const itemSlug = slugify(item.name);
    if ( !itemSlug ) { problems.push(`${item.identifier}: empty name`); continue; }
    for ( const animation of animations ) {
      const activities = item.activities.filter(a => !animation.activity || (a.type === animation.activity));
      if ( !activities.length ) { problems.push(`${item.name} (${item.identifier}): no "${animation.activity}" activity`); continue; }
      let command;
      try {
        if ( animation.alias ) command = aliasCommand(animation.alias, animation.aliasTrigger ?? animation.trigger);
        else {
          const template = templates[animation.template];
          if ( !template ) throw new Error(`BLFX template "${animation.template}" not found`);
          command = applyParams(template, animation.params);
        }
      } catch(err) { problems.push(`${item.name}: ${err.message}`); continue; }
      for ( const activity of activities ) {
        const activitySlug = slugify(activity.name);
        ((entries[itemSlug] ??= {})[activitySlug] ??= {})[animation.trigger] = {
          animationName: `${item.name} — ${activity.name}`,
          itemName: item.name,
          activityName: activity.name,
          triggerName: TRIGGERS[animation.trigger],
          note: `${TAG} ${version} · ${item.identifier}`,
          animationData: { command, eventType: TRIGGERS[animation.trigger], macroType: TEMPLATES[animation.template]?.macroType ?? "" }
        };
      }
    }
  }
  return { entries, problems };
}

/** L'entrée est-elle à nous ? */
export const isOurs = entry => typeof entry?.note === "string" && entry.note.startsWith(TAG);

/**
 * Notre Auto-Rec versée dans celle du MJ, sans rien lui retirer : nos anciennes entrées sont remplacées par les
 * nouvelles, une entrée du MJ au même endroit l'emporte (rapportée dans `kept`).
 * @param {object} existing    Le réglage `blfxCustomAutoRecognition` actuel.
 * @param {object} ours        `entries` de buildEntries.
 * @param {string} [system]
 * @returns {{ merged: object, added: number, removed: number, kept: string[] }}
 */
export function mergeInto(existing, ours, system="dnd5e") {
  const merged = structuredClone(existing ?? {});
  let removed = 0;
  for ( const items of Object.values(merged) ) {
    for ( const [itemSlug, activities] of Object.entries(items ?? {}) ) {
      for ( const [activitySlug, triggers] of Object.entries(activities ?? {}) ) {
        for ( const [trigger, entry] of Object.entries(triggers ?? {}) ) {
          if ( isOurs(entry) ) { delete triggers[trigger]; removed++; }
        }
        if ( !Object.keys(triggers ?? {}).length ) delete activities[activitySlug];
      }
      if ( !Object.keys(activities ?? {}).length ) delete items[itemSlug];
    }
  }
  const kept = [];
  let added = 0;
  const target = (merged[system] ??= {});
  for ( const [itemSlug, activities] of Object.entries(ours) ) {
    for ( const [activitySlug, triggers] of Object.entries(activities) ) {
      for ( const [trigger, entry] of Object.entries(triggers) ) {
        const slot = ((target[itemSlug] ??= {})[activitySlug] ??= {});
        if ( slot[trigger] ) { kept.push(`${itemSlug}.${activitySlug}.${trigger}`); continue; }
        slot[trigger] = entry;
        added++;
      }
    }
  }
  return { merged, added, removed, kept };
}

/** Une empreinte courte et stable d'une valeur JSON (pour savoir si la table a changé depuis la dernière synchronisation). */
export function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for ( let i = 0; i < text.length; i++ ) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
