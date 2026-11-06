// Catalogue du JB2A PREMIUM (`jb2a_patreon`, contenu payant) — écrit dans prive/docs/, JAMAIS dans docs/ (dépôt public).
// Même format que docs/catalogue-jb2a.json (tools/catalogue-libre.mjs) : { name, files, template?, size?, ms? }, plus
// `free: true` quand la même entrée existe dans le JB2A gratuit (`JB2A_DnD5e`). Écrit aussi prive/docs/jb2a-premium-apports.md :
// ce que le Premium ajoute (familles absentes du gratuit, couleurs et variantes en plus dans les familles communes).
// Ce script ne contient aucune donnée du Premium : il lit l'installation locale.
// Données Foundry : FOUNDRY_DATA, sinon F:/Foundry V14/Data (PC). --sans-mesure : pas de ffprobe (11 855 fichiers, long).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const DATA = process.env.FOUNDRY_DATA ?? "F:/Foundry V14/Data";
const ROOT = path.resolve(import.meta.dirname, "..");
const WORK = path.join(ROOT, "work");
const OUT = path.join(ROOT, "prive", "docs");
if ( !fs.existsSync(path.join(ROOT, "prive")) ) throw new Error("prive/ absent : cloner Darshyne/darsh-animations-notes d'abord");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

async function load(module, script, fn, exported) {
  const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "modules", module, "module.json"), "utf8"));
  const copy = path.join(WORK, `${module}-database.mjs`);
  fs.copyFileSync(path.join(DATA, "modules", module, script), copy);
  const mod = await import(pathToFileURL(copy).href);
  await mod[fn]("@");
  return { database: mod[exported], version: manifest.version };
}

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

const premium = await load("jb2a_patreon", "scripts/jb2a_sequencer.js", "jb2aPatreonDatabase", "patreonDatabase");
const free = await load("JB2A_DnD5e", "scripts/jb2a_sequencer.js", "jb2aFreeDatabase", "freeDatabase");
const cat = walk(premium.database, "jb2a", /^@\/jb2a_patreon\//);
const freeNames = new Set(walk(free.database, "jb2a", /^@\/JB2A_DnD5e\//).map(e => e.name));
for ( const e of cat ) if ( freeNames.has(e.name) ) e.free = true;

const PROBE = !process.argv.includes("--sans-mesure");
const cacheFile = path.join(WORK, "mesures-premium.json");
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
  let n = 0;
  for ( const entry of cat ) {
    const m = probe(path.join(DATA, "modules", "jb2a_patreon", entry.files[0]));
    if ( m ) Object.assign(entry, m);
    if ( (++n % 500) === 0 ) { fs.writeFileSync(cacheFile, JSON.stringify(cache)); console.log(`mesuré ${n}/${cat.length}`); }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
}

fs.writeFileSync(path.join(OUT, "catalogue-jb2a-premium.json"), JSON.stringify({
  module: "jb2a_patreon", version: premium.version, freeVersion: free.version, count: cat.length,
  free: cat.filter(e => e.free).length, entries: cat
}, null, 1) + "\n");

// --- Apports du Premium ------------------------------------------------------------------------------------------------
// Couleur = dernier segment du nom quand il est une couleur connue de JB2A (sinon l'entrée n'a pas de couleur à ce niveau).
const COLORS = new Set(["blue", "bluegreen", "blueyellow", "dark_blue", "darkblue", "dark_green", "darkgreen", "dark_purple",
  "darkpurple", "dark_red", "darkred", "green", "greenorange", "grey", "lightblue", "light_blue", "lightgreen", "light_green",
  "orange", "pink", "purple", "purplepink", "rainbow", "red", "white", "yellow", "yellowblue", "dark_black", "black",
  "dark_greenpurple", "greenyellow", "orangepink", "pinkpurple", "redyellow", "dark_purplered", "tealyellow", "teal", "yellowwhite",
  "blueorange", "bluepink", "blue02", "orangeyellow", "rainbow01", "rainbow02", "goldenorange", "orange_02", "dark_pink",
  "darkorange", "dark_orange", "greenteal", "bluepurple", "brown", "darkbrown", "light_brown", "sepia", "lightorange", "lightpurple",
  "lightyellow", "mint", "silver", "gold", "magenta", "cyan", "violet", "pinkblue", "purpleblue", "purplered", "whiteblue"]);
const family = e => e.name.split(".")[1];
// Les projectiles finissent par une distance (« .30ft ») : retirée avant de chercher la couleur.
const parts = e => { const p = e.name.split("."); return /^\d+ft$/.test(p.at(-1)) ? p.slice(0, -1) : p; };
const colorOf = e => { const p = parts(e); return COLORS.has(p.at(-1)) ? p.at(-1) : null; };
const stem = e => { const p = parts(e); return COLORS.has(p.at(-1)) ? p.slice(0, -1).join(".") : p.join("."); };
const fam = new Map();
for ( const e of cat ) {
  const f = family(e);
  if ( !fam.has(f) ) fam.set(f, { total: 0, free: 0, colors: new Set(), freeColors: new Set(), folders: new Set() });
  const s = fam.get(f);
  s.total++; if ( e.free ) s.free++;
  const c = colorOf(e);
  if ( c ) { s.colors.add(c); if ( e.free ) s.freeColors.add(c); }
  s.folders.add(e.files[0].split("/").slice(1, 3).join("/"));
}
// Variantes (chemin sans la couleur) propres au Premium dans une famille commune.
const stems = new Map();
for ( const e of cat ) {
  const s = stem(e);
  if ( !stems.has(s) ) stems.set(s, { free: false, colors: new Set() });
  const v = stems.get(s);
  if ( e.free ) v.free = true;
  if ( colorOf(e) ) v.colors.add(colorOf(e));
}
const onlyPremium = [...fam].filter(([, s]) => s.free === 0).sort(([a], [b]) => a.localeCompare(b));
const shared = [...fam].filter(([, s]) => s.free > 0).sort(([a], [b]) => a.localeCompare(b));
const lines = [];
lines.push(`# JB2A Premium ${premium.version} : ce qu'il ajoute au gratuit ${free.version}`, "",
  `Généré par \`node tools/catalogue-premium.mjs\` (${new Date().toISOString().slice(0, 10)}). Contenu payant : ce fichier et`,
  "`catalogue-jb2a-premium.json` restent dans `prive/`.", "",
  `- Entrées : **${cat.length}** dans le Premium, dont **${cat.filter(e => e.free).length}** aussi dans le gratuit `
  + `(${freeNames.size} entrées gratuites ; ${[...freeNames].filter(n => !cat.some(e => e.name === n)).length} absentes du Premium).`,
  `- Familles (\`jb2a.<famille>\`) : **${fam.size}**, dont **${onlyPremium.length}** absentes du gratuit.`, "",
  "## Familles absentes du gratuit", "", "| Famille | Entrées | Couleurs | Dossiers |", "|---|---:|---|---|");
for ( const [f, s] of onlyPremium ) lines.push(`| \`${f}\` | ${s.total} | ${[...s.colors].sort().join(", ") || "—"} | ${[...s.folders].slice(0, 3).join(", ")} |`);
lines.push("", "## Familles communes : entrées et couleurs en plus", "",
  "| Famille | Gratuit | Premium | Couleurs du gratuit | Couleurs en plus | Variantes propres au Premium (exemples) |",
  "|---|---:|---:|---|---|---|");
for ( const [f, s] of shared ) {
  const extra = [...s.colors].filter(c => !s.freeColors.has(c)).sort();
  const variants = [...stems].filter(([k, v]) => k.split(".")[1] === f && !v.free).map(([k]) => k.split(".").slice(2).join("."));
  lines.push(`| \`${f}\` | ${s.free} | ${s.total} | ${[...s.freeColors].sort().join(", ") || "—"} | ${extra.join(", ") || "—"} | `
    + `${variants.length ? `${variants.length} : ${variants.slice(0, 6).join(", ")}${variants.length > 6 ? "…" : ""}` : "—"} |`);
}
fs.writeFileSync(path.join(OUT, "jb2a-premium-apports.md"), lines.join("\n") + "\n");
console.log(`JB2A Premium ${premium.version} : ${cat.length} entrées (${cat.filter(e => e.free).length} aussi gratuites), `
  + `${fam.size} familles dont ${onlyPremium.length} propres au Premium`);
