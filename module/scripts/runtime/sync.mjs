/**
 * La table versée dans l'Auto-Rec personnalisée de BLFX, chez le MJ actif.
 *
 * Point d'entrée public de BLFX (bossLootFx.js:19) : `Hooks.callAll("blfx.register.CustomAutoRec", ressources, module,
 * version)`. BLFX ne l'écoute que si son réglage de monde « BLFX Custom Auto-Rec Updates » (`blfxCustomAutoRecUpdates`,
 * défaut : non) est coché, et seulement pour une version plus récente que la dernière enregistrée
 * (`blfxCustomAutoRecVersion`) ; il REMPLACE alors toute l'Auto-Rec personnalisée (apps/CustomAutoRecApi.js,
 * `importFromJson`). D'où la fusion faite ici (core/blfx.mjs, `mergeInto`) : on lui rend la sienne, plus la nôtre.
 * Fin de l'import : son hook `boss-loot-assets-premium.customAutoRecChanged`.
 */

import { buildEntries, fingerprint, mergeInto, TEMPLATES } from "../core/blfx.mjs";
import { animations, sources } from "./registry.mjs";
import { BLFX, MODULE_ID, loc, log } from "./shared.mjs";

/** L'empreinte de ce qu'on verserait : la table (livrée et enregistrée, runtime/registry.mjs) et la version du module. */
export function currentSignature() {
  return `${game.modules.get(MODULE_ID)?.version}+${fingerprint({ animations: animations(), sources: sources() })}`;
}

/** Les items qui portent un identifiant de la table : ceux du monde, des acteurs du monde et des compendiums sources. */
export async function collectItems() {
  const wanted = new Set(Object.keys(animations()));
  const found = new Map();
  const take = item => {
    const identifier = item?.system?.identifier;
    if ( !wanted.has(identifier) ) return;
    const activities = (item.system.activities?.contents ?? []).map(a => ({ name: a.name, type: a.type }));
    found.set(`${identifier}|${item.name}|${activities.map(a => a.name).join(",")}`, { name: item.name, identifier, activities });
  };
  for ( const item of game.items ) take(item);
  for ( const actor of game.actors ) for ( const item of actor.items ) take(item);
  for ( const id of sources() ) {
    const pack = game.packs.get(id);
    if ( !pack ) continue;
    // Les documents complets : Babele traduit noms et activités au chargement, et c'est le nom traduit que BLFX lira.
    for ( const doc of await pack.getDocuments() ) {
      if ( doc.documentName === "Actor" ) for ( const item of doc.items ) take(item);
      else take(doc);
    }
  }
  return [...found.values()];
}

/** Les modèles de l'éditeur BLFX, lus dans son compendium de macros. */
export async function loadTemplates() {
  const pack = game.modules.get(BLFX)?.packs?.find(p => p.type === "Macro");
  const macros = pack ? await game.packs.get(pack.id)?.getDocuments() : [];
  const byName = new Map((macros ?? []).map(m => [m.name, m.command]));
  return Object.fromEntries(Object.entries(TEMPLATES).map(([key, t]) => [key, byName.get(t.macro)]).filter(([, c]) => c));
}

/**
 * Verse la table dans BLFX. Sans `force`, ne fait rien si elle n'a pas changé depuis la dernière fois.
 * @returns {Promise<object>}  Le compte rendu (aussi écrit dans la console).
 */
export async function sync({ force=false }={}) {
  if ( !game.user.isActiveGM ) return { skipped: "pas le MJ actif" };
  if ( !game.modules.get(BLFX)?.active ) return { skipped: "BLFX inactif" };
  const signature = currentSignature();
  if ( !force && (game.settings.get(MODULE_ID, "applied") === signature) ) return { skipped: "à jour", signature };
  if ( !game.settings.get(BLFX, "blfxCustomAutoRecUpdates") ) {
    ui.notifications.warn(loc("Sync.Interdit"), { permanent: true });
    return { skipped: "réglage BLFX « Custom Auto-Rec Updates » décoché" };
  }

  const items = await collectItems();
  const templates = await loadTemplates();
  const version = game.modules.get(MODULE_ID).version;
  const { entries, problems } = buildEntries({ items, table: animations(), templates, version });
  const existing = game.settings.get(BLFX, "blfxCustomAutoRecognition") ?? {};
  const { merged, added, removed, kept } = mergeInto(existing, entries, game.system.id);

  // BLFX exige une version plus récente que la dernière enregistrée : l'heure en dernier segment la rend toujours neuve.
  const stamp = `${version}.${Date.now()}`;
  const done = new Promise(resolve => {
    const id = Hooks.once(`${BLFX}.customAutoRecChanged`, resolve);
    setTimeout(() => { Hooks.off(`${BLFX}.customAutoRecChanged`, id); resolve(null); }, 10000);
  });
  Hooks.callAll("blfx.register.CustomAutoRec", { flags: { [BLFX]: { customAutoRecognition: true } }, customAutoRecognition: merged },
    MODULE_ID, stamp);
  const changed = await done;

  const report = { items: items.length, added, removed, kept, problems, imported: !!changed };
  if ( changed ) await game.settings.set(MODULE_ID, "applied", signature);
  log("synchronisation BLFX", report);
  if ( problems.length ) ui.notifications.warn(loc("Sync.Problemes", { n: problems.length }));
  if ( !changed ) ui.notifications.error(loc("Sync.Echec"));
  return report;
}
