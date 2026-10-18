// Régénère module/names/fr.json : pour chaque nom français du SRD (objets, sorts, capacités, activités) le nom anglais d'origine,
// tiré des traductions Babele du module « dnd5e_fr-FR » (MIT, https://github.com/adgranger/foundryvtt-dnd5e-lang-fr-fr). Sert à
// Automated Animations, qui reconnaît les objets par leur nom anglais (runtime/aa.mjs) : un objet sans `flags.babele.originalName`
// ni identifiant anglais (créé à la main dans un monde en français) est retrouvé par son nom.
// Clé : le nom normalisé (core/aa.mjs, `normalize` : sans accents, minuscules, lettres et chiffres seulement).
// Données Foundry : FOUNDRY_DATA, sinon F:/Foundry V14/Data (PC).
import fs from "node:fs";
import path from "node:path";
import { normalize } from "../module/scripts/core/aa.mjs";

const DATA = process.env.FOUNDRY_DATA ?? "F:/Foundry V14/Data";
const ROOT = path.resolve(import.meta.dirname, "..");
const dir = path.join(DATA, "modules/dnd5e_fr-FR/compendium_fr");
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "modules/dnd5e_fr-FR/module.json"), "utf8"));

// Les paquets du SRD 2024 d'abord (les noms 2014 ne remplacent jamais un nom 2024).
const PACKS = ["spells24", "equipment24", "feats24", "origins24", "classes24", "monsterfeatures24", "actors24",
  "spells", "items", "classfeatures", "monsterfeatures", "monsters", "classes", "subclasses", "races", "backgrounds"];

const names = {};
const clashes = [];
function add(fr, en) {
  if ( (typeof fr !== "string") || (typeof en !== "string") ) return;
  const key = normalize(fr);
  if ( !key || (key === normalize(en)) ) return;   // nom identique dans les deux langues : AA le trouve déjà
  if ( names[key] && (names[key] !== en) ) { clashes.push(`${fr}: ${names[key]} / ${en}`); return; }
  names[key] = en;
}
function walk(entries) {
  for ( const [en, entry] of Object.entries(entries ?? {}) ) {
    if ( !entry || (typeof entry !== "object") ) continue;
    add(entry.name, en);
    for ( const [activity, data] of Object.entries(entry.activities ?? {}) ) add(data?.name, activity);
    walk(entry.items);
  }
}
for ( const pack of PACKS ) {
  const file = path.join(dir, `dnd5e.${pack}.json`);
  if ( fs.existsSync(file) ) walk(JSON.parse(fs.readFileSync(file, "utf8")).entries);
}

const sorted = Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)));
const out = { lang: "fr", source: `dnd5e_fr-FR ${manifest.version} (MIT)`, count: Object.keys(sorted).length, names: sorted };
fs.writeFileSync(path.join(ROOT, "module/names/fr.json"), JSON.stringify(out, null, 0) + "\n");
console.log(`module/names/fr.json : ${out.count} noms, ${clashes.length} doublons écartés (le premier gardé)`);
