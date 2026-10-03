// Inventaire : capacités Ravenloft + créatures CoS Reloaded, et l'animation que BLFX (3.5.2) ou notre table leur donne.
// Reproduit BlfxMacroExecutor.getAutoRecognitionAnimation / getBaseItem (apps/BlfxMacroExecutor.js). Lit les dépôts frères
// (données anglaises extraites de Ravenloft, traductions FR, sources CoS, sorts du PHB). Écrit prive/docs/inventaire.md et
// prive/docs/table.md (non publiés). Compte aussi les tables que d'autres modules enregistrent en jeu (hook
// `darsh-animations.register`) quand leur dépôt est à côté : EXTRA_TABLES, fichiers purs qui exportent ANIMATIONS (et WITHOUT).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.resolve(import.meta.dirname, "..");
const ROOT = path.resolve(HERE, "..");
const RHW = `${ROOT}/Foundry dnd5 module trad Ravenloft`;
const COS = `${ROOT}/Foundry dnd5 creatures Curse of Strahd/packs-src`;
const PHB = `${ROOT}/Foundry dnd5 module trad player manuel du joueur/work/phb-en/spells`;
const DOCS = path.join(HERE, "prive/docs");
const OUT = path.join(DOCS, "inventaire.md");
if ( !fs.existsSync(path.join(DOCS, "blfx-autorec.json")) ) {
  console.error("prive/docs/blfx-autorec.json absent : lancer d'abord npm run catalogue (BLFX installé)");
  process.exit(1);
}
const MAP = JSON.parse(fs.readFileSync(path.join(DOCS, "blfx-autorec.json"), "utf8"));
const own = await import(pathToFileURL(path.join(HERE, "module/scripts/data/animations.mjs")).href);
const EXTRA_TABLES = [`${ROOT}/Foundry dnd5 creatures Curse of Strahd/module/scripts/data/animations.mjs`];
const ANIMATIONS = { ...own.ANIMATIONS };
const WITHOUT = { ...own.WITHOUT };
for ( const file of EXTRA_TABLES.filter(f => fs.existsSync(f)) ) {
  const extra = await import(pathToFileURL(file).href);
  Object.assign(ANIMATIONS, extra.ANIMATIONS ?? {});
  Object.assign(WITHOUT, extra.WITHOUT ?? {});
}

const slugify = s => (s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).join("-");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : (d.name.endsWith(".json") && !d.name.startsWith("_") ? [path.join(dir, d.name)] : []));
const read = f => JSON.parse(fs.readFileSync(f, "utf8"));

// Sorts du PHB et sorts de Xanathar du module CoS : id → identifiant (pour les activités « lancer un sort »).
const phbSpells = {};
for ( const f of [...walk(PHB), ...walk(`${COS}/sorts`)] ) { const d = read(f); if ( d._id && d.system?.identifier ) phbSpells[d._id] = d.system.identifier; }

// Traductions Babele de Ravenloft (noms FR).
const fr = pack => { try { return read(`${RHW}/module/compendium/fr/dnd-ravenloft-horrors-within.${pack}.json`).entries; } catch { return {}; } };
const FR = { options: fr("options"), items: fr("items"), bastions: fr("bastions"), actors: fr("actors") };

function blfx(item, frName) {
  const identifier = item.system?.identifier || slugify(frName);   // dnd5e : identifiant tiré du nom (traduit) s'il manque
  const type = identifier.startsWith("blfx-") ? "custom" : item.type;
  const valid = (MAP[type] ?? {})[identifier] ? identifier : null;
  const base = item.system?.type?.baseItem || valid || slugify(frName);
  const triggers = (MAP[type] ?? {})[base] ?? null;
  return { identifier, base, triggers };
}

function activitiesOf(item) {
  return Object.values(item.system?.activities ?? {}).map(a => ({
    type: a.type,
    activation: a.activation?.type ?? "",
    template: a.target?.template?.type || null,
    spell: a.type === "cast" ? (phbSpells[(a.spell?.uuid ?? "").split(".").pop()] ?? a.spell?.uuid ?? null) : null
  }));
}

// Une suggestion : un mot du nom anglais qui est une clé BLFX du même type, ou d'un type voisin.
function hint(item, enName) {
  const words = slugify(enName).split("-");
  const pools = [["weapon", MAP.weapon], ["feat", MAP.feat], ["spell", MAP.spell]];
  for ( const [t, pool] of pools ) for ( const w of [slugify(enName), ...words] ) if ( pool[w] ) return `${t}.${w}`;
  return null;
}

const rows = [];
function add(source, owner, item, enName, frName) {
  const acts = activitiesOf(item);
  if ( !acts.length ) return;                                         // passif : rien à animer
  const b = blfx(item, frName);
  const castSpells = acts.filter(a => a.spell).map(a => a.spell);
  const castCovered = castSpells.length && castSpells.every(s => MAP.spell[s] || ANIMATIONS[s]);
  const ours = !!ANIMATIONS[item.system?.identifier] || !!WITHOUT[item.system?.identifier];
  rows.push({ source, owner, en: enName, fr: frName, type: item.type, identifier: b.identifier, key: b.base,
    covered: ours || !!b.triggers || !!castCovered, ours, via: ours ? "darsh-animations" : b.triggers ? `${item.type}.${b.base}` : (castCovered ? `sort ${castSpells.join(", ")}` : null),
    activities: acts.map(a => `${a.type}${a.template ? `(${a.template})` : ""}${a.spell ? `→${a.spell}` : ""}`).join(" "),
    hint: (b.triggers || castCovered) ? null : hint(item, enName) });
}

// Ravenloft : options, items, bastions (items isolés), acteurs (items embarqués).
for ( const pack of ["options", "items", "bastions"] ) {
  for ( const f of walk(`${RHW}/work/rhw-en/${pack}`) ) {
    const d = read(f);
    if ( d.type === undefined || d.items ) continue;
    add(`ravenloft.${pack}`, "", d, d.name, FR[pack][d.name]?.name ?? FR[pack][d._id]?.name ?? d.name);
  }
}
for ( const f of walk(`${RHW}/work/rhw-en/actors`) ) {
  const d = read(f);
  if ( !Array.isArray(d.items) ) continue;
  const tr = FR.actors[d.name] ?? {};
  for ( const i of d.items ) add("ravenloft.actors", tr.name ?? d.name, i, i.name, tr.items?.[i._id]?.name ?? tr.items?.[i.name]?.name ?? i.name);
}
// CoS Reloaded : déjà en français ; pas de nom anglais (le nom sert d'indice faute de mieux).
for ( const f of walk(`${COS}/creatures`) ) {
  const d = read(f);
  for ( const i of d.items ?? [] ) add("cos.creatures", d.name, i, i.system?.identifier ?? i.name, i.name);
}
for ( const f of walk(`${COS}/sorts`) ) { const d = read(f); add("cos.sorts", "", d, d.system?.identifier ?? d.name, d.name); }

// --- Rapport ---
const skip = x => /multiattack|attaques-multiples|legendary|legendaires|reactions-multiples/.test(x.identifier) || /Multiattack|Attaques multiples/.test(x.en + x.fr);
const kind = x => {
  const a = x.activities;
  if ( /attack/.test(a) ) return x.type === "weapon" ? "attaque d'arme" : "attaque";
  if ( /\(/.test(a) ) return "zone";
  if ( /summon/.test(a) ) return "invocation";
  if ( /transform/.test(a) ) return "transformation";
  if ( /heal/.test(a) ) return "soin";
  if ( /save|damage/.test(a) ) return "sur la cible";
  if ( /cast/.test(a) ) return "lance un sort";
  return "utilitaire";
};
const SOURCES = [
  ["ravenloft.options", "Ravenloft — options de personnage (dons sombres, sous-classes, espèces, historiques, sort)"],
  ["ravenloft.items", "Ravenloft — objets"],
  ["ravenloft.bastions", "Ravenloft — bastions"],
  ["ravenloft.actors", "Ravenloft — bestiaire (69 créatures)"],
  ["cos.creatures", "Curse of Strahd: Reloaded — créatures"],
  ["cos.sorts", "Curse of Strahd: Reloaded — sorts de Xanathar"]
];
const lines = ["# Animations BLFX manquantes — Ravenloft et Curse of Strahd: Reloaded", "",
  `Relevé par « npm run inventaire » sur BLFX Animation Editor 3.5.2 (reconnaissance automatique : ${Object.keys(MAP.spell).length} sorts, ` +
  `${Object.keys(MAP.weapon).length} armes, ${Object.keys(MAP.feat).length} capacités de monstre). Une capacité est « couverte » si BLFX lui trouve ` +
  "une animation par son identifiant ou son arme de base, si elle lance un sort qu'il connaît, ou si notre table (module/scripts/data/animations.mjs) en a une. Les capacités passives (sans activité) et les « Attaques multiples » sont écartées.", "",
  `**${rows.filter(r => r.covered).length} couvertes sur ${rows.length}**, dont ${rows.filter(r => r.ours).length} par notre table (doublons compris : une même capacité sur plusieurs créatures compte plusieurs fois).`, ""];
for ( const [src, title] of SOURCES ) {
  const mine = rows.filter(r => r.source === src && !skip(r));
  const missing = mine.filter(r => !r.covered);
  lines.push(`## ${title}`, "", `${mine.length - missing.length} couvertes, **${missing.length} manquantes**.`, "");
  if ( !missing.length ) continue;
  lines.push("| Créature | Capacité | Anglais | Type | Geste | Indice BLFX |", "|---|---|---|---|---|---|");
  for ( const r of missing ) lines.push(`| ${r.owner || "—"} | ${r.fr} | ${r.en === r.fr ? "" : r.en} | ${r.type} | ${kind(r)} | ${r.hint ?? ""} |`);
  lines.push("");
}
const spells = new Set();
for ( const r of rows ) for ( const a of r.activities.split(" ") ) { const m = a.match(/→(.+)/); if ( m && !MAP.spell[m[1]] ) spells.add(m[1].replace(/^Compendium\..*Item\./, "")); }
lines.push("## Sorts lancés par ces capacités, inconnus de BLFX", "", "BLFX reconnaît surtout les sorts jusqu'au niveau 4 ; ceux-ci profiteraient aussi aux fiches des joueurs.", "", [...spells].sort().join(", "), "");
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`prive/docs/inventaire.md : ${rows.filter(r => r.covered).length} couvertes sur ${rows.length}, dont ${rows.filter(r => r.ours).length} par notre table`);

// --- La table, lisible : prive/docs/table.md ---
const names = new Map();
for ( const r of rows ) {
  const n = names.get(r.identifier) ?? { fr: r.fr, owners: new Set() };
  if ( r.owner ) n.owners.add(r.owner);
  names.set(r.identifier, n);
}
const short = name => String(name).replace(/^blfx\./, "");
function describe(a) {
  if ( a.alias ) return `reprend l'animation BLFX « ${a.alias} »${a.aliasTrigger ? ` (${a.aliasTrigger})` : ""}`;
  const p = a.params ?? {};
  const parts = [];
  if ( a.template === "target" ) {
    if ( p.ENABLED1 ) parts.push(`sur lui : ${short(p.ANIMATION1)}${p.SCALE1 ? ` ×${p.SCALE1}` : ""}`);
    if ( p.ENABLED2 ) parts.push(`rayon : ${short(p.ANIMATION2)}`);
    if ( p.ENABLED3 ) parts.push(`sur chaque cible : ${short(p.ANIMATION3)}`);
  } else {
    if ( p.ENABLED1 ) parts.push(`sur lui : ${short(p.ANIMATION1)}`);
    if ( p.ENABLED2 ) parts.push(`rayon : ${short(p.ANIMATION2)}`);
    if ( p.ENABLED3 ) parts.push(`zone (${a.template}) : ${short(p.ANIMATION3)}`);
  }
  const sounds = [1, 2, 3].filter(n => p[`SOUND_ENABLED${n}`]).map(n => short(p[`SOUND${n}`]));
  if ( sounds.length ) parts.push(`son : ${sounds.join(", ")}`);
  return parts.join(" ; ");
}
const MOMENT = { afterAttack: "à l'attaque", afterThrown: "au lancer", afterDamage: "aux dégâts", afterItemUse: "à l'utilisation",
  afterActiveEffects: "à la pose de l'effet", afterSummon: "à l'invocation", createTemplate: "à la pose de la zone" };
const table = ["# La table d'animations, lisible", "", "Généré par « npm run inventaire » depuis module/scripts/data/animations.mjs et les tables enregistrées par d'autres modules.", "",
  "| Capacité | Qui | Quand | Animation | Note |", "|---|---|---|---|---|"];
for ( const [id, list] of Object.entries(ANIMATIONS) ) {
  const n = names.get(id);
  for ( const a of list ) table.push(`| ${n?.fr ?? id} | ${[...(n?.owners ?? [])].join(", ") || "—"} | ${MOMENT[a.trigger]}${a.activity ? ` (${a.activity})` : ""} | ${describe(a)} | ${a.note ?? ""} |`);
}
table.push("", "## Sans animation, volontairement", "", "| Capacité | Pourquoi |", "|---|---|");
for ( const [id, why] of Object.entries(WITHOUT) ) table.push(`| ${names.get(id)?.fr ?? id} | ${why} |`);
fs.writeFileSync(path.join(DOCS, "table.md"), table.join("\n") + "\n");
console.log(`prive/docs/table.md : ${Object.values(ANIMATIONS).flat().length} animations, ${Object.keys(WITHOUT).length} sans`);
