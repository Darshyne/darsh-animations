// Régénère, depuis l'installation locale, le catalogue des modules d'animation GRATUITS que ce module sait utiliser sans BLFX :
//  - docs/catalogue-jb2a.json : toutes les entrées « jb2a.* » de JB2A gratuit (`JB2A_DnD5e`, scripts/jb2a_sequencer.js,
//    `jb2aFreeDatabase`) — la version Patreon (`jb2a_patreon`) en ajoute d'autres sous le même préfixe, mais garde celles-ci ;
//    on ne vise que le gratuit, pour marcher partout ;
//  - docs/catalogue-psfx.json : toutes les entrées « psfx.* » de PSFX (`psfx`, scripts/psfx_sequencer.js, `registerPSFXDatabase`).
// Chaque entrée : { name, files } (plusieurs fichiers : Sequencer en tire un au hasard), et pour JB2A `template` (le gabarit de
// taille déclaré par la base : « ranged », « melee »… — une animation à étirer d'une source à une cible) quand il y en a un.
// Données Foundry : FOUNDRY_DATA, sinon F:/Foundry V14/Data (PC).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const DATA = process.env.FOUNDRY_DATA ?? "F:/Foundry V14/Data";
const ROOT = path.resolve(import.meta.dirname, "..");
const WORK = path.join(ROOT, "work");
const DOCS = path.join(ROOT, "docs");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(DOCS, { recursive: true });

/** Copie le script de base hors de Foundry (il n'importe rien) et l'exécute avec un préfixe vide. */
async function load(module, script, fn, exported) {
  const file = path.join(DATA, "modules", module, script);
  const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "modules", module, "module.json"), "utf8"));
  const copy = path.join(WORK, `${module}-database.mjs`);
  fs.copyFileSync(file, copy);
  const mod = await import(pathToFileURL(copy).href);
  await mod[fn]("@");
  return { database: mod[exported], version: manifest.version };
}

/** Parcourt une base Sequencer : les clés « _… » sont des métadonnées (gabarit, repères, horodatages). */
function walk(database, prefix, strip) {
  const out = [];
  const visit = (node, keys, template) => {
    const name = [prefix, ...keys].join(".");
    const clean = f => String(f).replace(strip, "");
    if ( typeof node === "string" ) return out.push({ name, files: [clean(node)], ...(template ? { template } : {}) });
    if ( Array.isArray(node) ) return out.push({ name, files: node.map(clean), ...(template ? { template } : {}) });
    if ( !node || (typeof node !== "object") ) return;
    const own = Array.isArray(node._template) ? null : (node._template ?? template);
    for ( const [k, v] of Object.entries(node) ) if ( !k.startsWith("_") ) visit(v, [...keys, k], own);
  };
  visit(database, [], null);
  return out;
}

const jb2a = await load("JB2A_DnD5e", "scripts/jb2a_sequencer.js", "jb2aFreeDatabase", "freeDatabase");
const psfx = await load("psfx", "scripts/psfx_sequencer.js", "registerPSFXDatabase", "psfxDatabase");
const catJb2a = walk(jb2a.database, "jb2a", /^@\/JB2A_DnD5e\//);
const catPsfx = walk(psfx.database, "psfx", /^@\//);

// Taille (px) et durée (ms) du premier fichier de chaque entrée, par ffprobe s'il est là — cache dans work/ (relancer avec
// --sans-mesure pour s'en passer). Sert à régler l'échelle d'une animation (un mur couché : son épaisseur en pixels) et à savoir
// si elle boucle ou combien de temps elle dure.
const PROBE = !process.argv.includes("--sans-mesure");
const cacheFile = path.join(WORK, "mesures-libres.json");
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
function probe(abs) {
  if ( cache[abs] !== undefined ) return cache[abs];
  let out = null;
  try {
    const json = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_entries",
      "stream=width,height:format=duration", abs], { encoding: "utf8" }));
    const video = (json.streams ?? []).find(s => s.width);
    const ms = Math.round(Number(json.format?.duration ?? 0) * 1000) || null;
    out = { ...(video ? { size: [video.width, video.height] } : {}), ...(ms ? { ms } : {}) };
  } catch { out = null; }
  cache[abs] = out;
  return out;
}
if ( PROBE ) {
  for ( const [cat, base] of [[catJb2a, "JB2A_DnD5e"], [catPsfx, "psfx"]] ) {
    for ( const entry of cat ) {
      const m = probe(path.join(DATA, "modules", base, entry.files[0]));
      if ( m ) Object.assign(entry, m);
    }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
}

const write = (file, module, version, entries) =>
  fs.writeFileSync(path.join(DOCS, file), JSON.stringify({ module, version, count: entries.length, entries }, null, 1) + "\n");
write("catalogue-jb2a.json", "JB2A_DnD5e", jb2a.version, catJb2a);
write("catalogue-psfx.json", "psfx", psfx.version, catPsfx);

const tally = cat => {
  const kinds = {};
  for ( const c of cat ) { const k = c.name.split(".")[1]; kinds[k] = (kinds[k] ?? 0) + 1; }
  return kinds;
};
console.log(`JB2A gratuit ${jb2a.version} : ${catJb2a.length} entrées`, Object.keys(tally(catJb2a)).length, "familles");
console.log(`PSFX ${psfx.version} : ${catPsfx.length} entrées`, tally(catPsfx));
