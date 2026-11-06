// Relevé des CHOIX d'animations d'Automated Animations (MIT) — données, pas code : rien de ce qui est relevé n'est repris
// dans module/ (consigne utilisateur 2026-11-06 : « ne pas reprendre son code mais ses recettes, dans le choix des animations »).
// Lit l'installation locale d'AA (dist/autoanimations.js), exécute hors Foundry ses seules parties de données :
//  - sa base JB2A classée par usage (section → type → animation → variante → couleur), Premium puis gratuit, migrations comprises ;
//  - ses entrées Auto-Rec par défaut (libellé, menu, vidéo principale / secondaire / explosion / source / cible, bascule contact).
// Écrit dans prive/docs/ (la base Premium cite des fichiers payants) : aa-classement-jb2a.json, aa-autorec-defauts.json.
// Données Foundry : FOUNDRY_DATA, sinon F:/Foundry V14/Data.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATA = process.env.FOUNDRY_DATA ?? "F:/Foundry V14/Data";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "prive", "docs");
const WORK = path.join(ROOT, "work");
fs.mkdirSync(WORK, { recursive: true });
const AA = path.join(DATA, "modules", "autoanimations");
const version = JSON.parse(fs.readFileSync(path.join(AA, "module.json"), "utf8")).version;
const lines = fs.readFileSync(path.join(AA, "dist", "autoanimations.js"), "utf8").split("\n");
const find = re => { const i = lines.findIndex(l => re.test(l)); if ( i < 0 ) throw new Error(`introuvable : ${re}`); return i; };

// Bloc 1 : bases JB2A + dbMerge (du début à la fin de `const dbMerge = {…};`).
const dbEnd = find(/^function debug\$1\(/);
// Bloc 2 : gabarits d'entrées par défaut (de `function sound(` à la fin de `function loadDefault`).
const defStart = find(/^function sound\(\{ enable = false/);
const defEnd = find(/^function defaultData\(\)/);
// Bloc 3 : sortDatabase / removeFreeMarker (tri gratuit / Premium appelé par les migrations).
const sortStart = find(/^async function sortDatabase\(/);
const freeMark = find(/^async function removeFreeMarker\(/);
const sortEnd = freeMark + 1 + lines.slice(freeMark + 1).findIndex(l => /^(const|let|var|function|async function|class) /.test(l));
const stub = `
const isNewer = (a, b) => { const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for ( let i = 0; i < Math.max(pa.length, pb.length); i++ ) { if ( (pa[i] ?? 0) !== (pb[i] ?? 0) ) return (pa[i] ?? 0) > (pb[i] ?? 0); } return false; };
const merge = (t, s) => { for ( const [k, v] of Object.entries(s) ) { if ( v && typeof v === "object" && !Array.isArray(v) && t[k] && typeof t[k] === "object" ) merge(t[k], v); else t[k] = v; } return t; };
globalThis.foundry = { utils: { isNewerVersion: isNewer, mergeObject: merge } };
const localize = s => s;
const Hashing = { uuidv4: () => "x" };
let aaDatabase$1;
`;
const src = stub + lines.slice(0, dbEnd).join("\n") + "\n" + lines.slice(sortStart, sortEnd).join("\n") + "\n" + lines.slice(defStart, defEnd).join("\n") + `
export async function build(free, patreon) {
  await initializeJB2APatreonDB("@P"); aaDatabase$1 = JB2APATREONDB; await dbMerge.handle("", patreon);
  const P = JSON.parse(JSON.stringify(JB2APATREONDB));
  await initializeJB2AFreeDB("@F"); aaDatabase$1 = JB2AFREEDB; await dbMerge.handle(free, "");
  const F = JSON.parse(JSON.stringify(JB2AFREEDB));
  const D = {}; for ( const t of ["melee", "range", "ontoken", "templatefx", "aura", "preset", "aefx"] ) D[t] = loadDefault(t);
  return { P, F, D };
}`;
const copy = path.join(WORK, "aa-donnees.mjs");
fs.writeFileSync(copy, src);
const ver = id => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "modules", id, "module.json"), "utf8")).version; } catch { return ""; } };
const { P, F, D } = await (await import(pathToFileURL(copy).href)).build(ver("JB2A_DnD5e"), ver("jb2a_patreon"));

// Classement : section.type.animation → { variantes → couleurs }, et marque des chemins gratuits.
const index = (db) => {
  const out = {};
  for ( const [section, types] of Object.entries(db) ) {
    if ( section.startsWith("_") ) continue;
    for ( const [type, anims] of Object.entries(types) ) {
      if ( type.startsWith("_") ) continue;
      for ( const [anim, variants] of Object.entries(anims) ) {
        if ( anim.startsWith("_") ) continue;
        const v = {};
        for ( const [variant, colors] of Object.entries(variants) ) {
          if ( variant.startsWith("_") ) continue;
          v[variant] = Object.keys(colors).filter(c => !c.startsWith("_"));
        }
        out[`${section}.${type}.${anim}`] = v;
      }
    }
  }
  return out;
};
const iP = index(P), iF = index(F);
// Nom JB2A (base Sequencer « jb2a.* » du Premium) qui porte le même fichier : on écrira nos recettes avec ces noms-là, pas ceux d'AA.
const premiumCat = JSON.parse(fs.readFileSync(path.join(OUT, "catalogue-jb2a-premium.json"), "utf8")).entries;
const byFile = new Map();
for ( const e of premiumCat ) for ( const f of e.files ) if ( !byFile.has(f) ) byFile.set(f, e.name);
const filesOf = node => (typeof node === "string" ? [node] : Array.isArray(node) ? node.flatMap(filesOf)
  : (node && typeof node === "object") ? Object.entries(node).filter(([k]) => !k.startsWith("_")).flatMap(([, x]) => filesOf(x)) : []);
const jb2aOf = node => {
  const names = [...new Set(filesOf(node).map(f => byFile.get(f.replace(/^@P\//, ""))).filter(Boolean)
    .map(n => n.replace(/\.(05|15|30|60|90)ft$/, "")))];
  return names.length === 1 ? names[0] : names.length ? names : null;
};
const classement = {};
for ( const [k, v] of Object.entries(iP) ) {
  const [section, type, animation] = k.split(".");
  const free = iF[k];
  classement[k] = { section, type, animation, variants: Object.fromEntries(Object.entries(v).map(([vr, cs]) =>
    [vr, Object.fromEntries(cs.map(c => [free?.[vr]?.includes(c) ? c : `${c}*`, jb2aOf(P[section][type][animation][vr][c])]))])),
    free: !!free };
}
fs.writeFileSync(path.join(OUT, "aa-classement-jb2a.json"), JSON.stringify({
  source: `autoanimations ${version} (MIT), bases JB2APATREONDB / JB2AFREEDB`,
  note: "section.type.animation → variante → couleur (suivie de * = Premium seulement) → nom(s) jb2a.* du même fichier (distances 05ft…90ft retirées) ; free = l'animation existe dans le gratuit",
  count: Object.keys(classement).length, entries: classement
}, null, 1) + "\n");

// Entrées par défaut : seulement les choix (vidéo, options utiles), pas la mécanique.
const pick = s => (s && s.video && (s.enable !== false) ? { ...s.video, ...(s.options?.size ? { size: s.options.size } : {}) } : null);
const defaults = [];
for ( const [menu, entries] of Object.entries(D) ) for ( const e of entries ) {
  const clean = o => Object.fromEntries(Object.entries(o).filter(([, x]) => x != null));
  defaults.push(clean({
    label: e.label, menu,
    primary: pick(e.primary) ? clean({ dbSection: e.primary.video.dbSection, menuType: e.primary.video.menuType,
      animation: e.primary.video.animation, variant: e.primary.video.variant, color: e.primary.video.color,
      repeat: e.primary.options?.repeat > 1 ? e.primary.options.repeat : null, persistent: e.primary.options?.persistent || null,
      isWait: e.primary.options?.isWait || null }) : null,
    secondary: e.secondary?.enable ? pick(e.secondary) : null,
    explosion: e.explosion?.enable ? pick(e.explosion) : null,
    source: e.source?.enable ? pick(e.source) : null,
    target: e.target?.enable ? pick(e.target) : null,
    meleeSwitch: (menu === "melee" && e.meleeSwitch?.video?.animation) ? `${e.meleeSwitch.video.dbSection}.${e.meleeSwitch.video.menuType}.${e.meleeSwitch.video.animation}` : null,
    presetType: e.presetType ?? null,
    data: menu === "preset" ? e.data : null,
    sound: [e.primary?.sound, e.secondary?.sound, e.target?.sound].some(s => s?.enable) ? "oui" : null
  }));
}
fs.writeFileSync(path.join(OUT, "aa-autorec-defauts.json"), JSON.stringify({
  source: `autoanimations ${version} (MIT), loadDefault()`, count: defaults.length, entries: defaults
}, null, 1) + "\n");
console.log(`AA ${version} : ${Object.keys(classement).length} animations classées (${Object.values(classement).filter(c => c.free).length} gratuites), ${defaults.length} entrées par défaut`);
