// Régénère depuis l'installation locale de BLFX, sous prive/docs/ (non publié : index d'un module premium) :
//  - prive/docs/catalogue-blfx.json : toutes les animations et tous les sons enregistrés dans Sequencer sous « blfx.* »
//    (blfx-assets-pack01, scripts/resources.js, `createDatabase`) — la référence où l'on choisit, vérifiée par `npm test` ;
//  - prive/docs/blfx-autorec.json : ce que l'Auto-Rec de BLFX reconnaît déjà, par type d'item, avec ses déclencheurs
//    (boss-loot-assets-premium, scripts/animationMap.js) — les alias possibles.
// Données Foundry : FOUNDRY_DATA, sinon F:/Foundry V14/Data (PC).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATA = process.env.FOUNDRY_DATA ?? "F:/Foundry V14/Data";
const ROOT = path.resolve(import.meta.dirname, "..");
const WORK = path.join(ROOT, "work");
const DOCS = path.join(ROOT, "prive/docs");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(DOCS, { recursive: true });

// 1. Catalogue : resources.js importe sa constante MODULE_NAME ; on la pose en dur dans une copie.
const resources = fs.readFileSync(path.join(DATA, "modules/blfx-assets-pack01/scripts/resources.js"), "utf8")
  .replace(/^import \{ MODULE_NAME \} from '\.\/constants\.js';/m, "const MODULE_NAME = 'blfx-assets-pack01';");
const copy = path.join(WORK, "blfx-resources.mjs");
fs.writeFileSync(copy, resources);
const { database, createDatabase } = await import(pathToFileURL(copy).href);
await createDatabase("modules");
const catalogue = [];
const walk = (node, keys) => {
  const name = ["blfx", ...keys].join(".");
  if ( typeof node === "string" ) return catalogue.push({ name, file: node.replace("modules/blfx-assets-pack01/", "") });
  if ( Array.isArray(node) ) return catalogue.push({ name, file: node.map(f => String(f).replace("modules/blfx-assets-pack01/", "")).join(" | ") });
  for ( const [k, v] of Object.entries(node ?? {}) ) if ( !k.startsWith("_") ) walk(v, [...keys, k]);
};
walk(database, []);
fs.writeFileSync(path.join(DOCS, "catalogue-blfx.json"), JSON.stringify(catalogue, null, 1) + "\n");

// 2. Auto-Rec de BLFX : lu par l'indentation de animationMap.js (le fichier importe des macros qui supposent Foundry).
const lines = fs.readFileSync(path.join(DATA, "modules/boss-loot-assets-premium/scripts/animationMap.js"), "utf8").split("\n");
const map = {};
let type = null, key = null, inDnd = false;
for ( const line of lines ) {
  let m;
  if ( (m = line.match(/^  (\w+): \{/)) ) { inDnd = m[1] === "dnd5e"; type = null; continue; }
  if ( !inDnd ) continue;
  if ( (m = line.match(/^    (\w+): \{/)) ) { type = m[1]; map[type] ??= {}; key = null; continue; }
  if ( type && (m = line.match(/^      '?([\w-]+)'?: \{/)) ) { key = m[1]; map[type][key] ??= []; continue; }
  if ( type && key && (m = line.match(/^        (\w+): \{/)) ) map[type][key].push(m[1]);
}
fs.writeFileSync(path.join(DOCS, "blfx-autorec.json"), JSON.stringify(map, null, 1) + "\n");

const kinds = {};
for ( const c of catalogue ) { const k = c.name.split(".")[1]; kinds[k] = (kinds[k] ?? 0) + 1; }
console.log(`catalogue : ${catalogue.length} entrées`, kinds);
console.log("Auto-Rec BLFX :", Object.fromEntries(Object.entries(map).map(([t, keys]) => [t, Object.keys(keys).length])));
