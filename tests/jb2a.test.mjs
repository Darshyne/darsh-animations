import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as JB2A from "../module/scripts/data/jb2a.mjs";
import { COLORS as CONSUMABLE_COLORS, KINDS, SIGNATURES as BLFX_SIGNATURES } from "../module/scripts/data/consumables.mjs";
import { TRAPS as BLFX_TRAPS } from "../module/scripts/data/traps.mjs";
import { WALLS as BLFX_WALLS } from "../module/scripts/data/walls.mjs";
import { checkTrapPart } from "../module/scripts/core/traps.mjs";

// Les catalogues de JB2A gratuit et de PSFX (modules gratuits) sont publiés dans docs/ (`npm run catalogue:libre`).
const read = file => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../docs", file), "utf8")).entries;
const jb2a = read("catalogue-jb2a.json");
const psfx = read("catalogue-psfx.json");
const leaves = new Set([...jb2a, ...psfx].map(e => e.name));
// Un nom vaut s'il est une entrée, ou un groupe d'entrées (Sequencer en tire une, ou celle de la distance).
const exists = name => leaves.has(name) || [...leaves].some(l => l.startsWith(`${name}.`));

/** Tous les noms Sequencer cités par la table (avec `{color}` remplacé par chaque variante). */
function names(node, out=[]) {
  if ( typeof node === "string" ) {
    if ( /^(jb2a|psfx)\./.test(node) ) {
      if ( node.includes("{color}") ) for ( const c of Object.values(JB2A.COLORS) ) out.push(node.replaceAll("{color}", c.variant));
      else out.push(node);
    }
  }
  else if ( node && (typeof node === "object") ) for ( const v of Object.values(node) ) names(v, out);
  return out;
}

describe("rendu JB2A + PSFX", () => {
  it("chaque animation et chaque son existent dans JB2A gratuit ou PSFX", () => {
    const all = [...new Set(names(JB2A))];
    expect(all.length).toBeGreaterThan(80);
    expect(all.filter(n => !exists(n))).toEqual([]);
  });
  it("les entrées JB2A cassées ne sont pas utilisées (« 500x100 » du mur de feu pointe sur l'anneau)", () => {
    expect(names(JB2A).filter(n => /^jb2a\.wall_of_fire\.500x100/.test(n))).toEqual([]);
  });
  it("chaque couleur des consommables a sa variante, chaque sorte sa recette, chaque signature son pendant", () => {
    expect(Object.keys(JB2A.COLORS).sort()).toEqual(Object.keys(CONSUMABLE_COLORS).sort());
    expect(Object.keys(JB2A.CONSUMABLES).sort()).toEqual(Object.keys(KINDS).sort());
    expect(Object.keys(JB2A.SIGNATURES).sort()).toEqual(Object.keys(BLFX_SIGNATURES).sort());
  });
  it("les pièges : les mêmes que BLFX, des parties bien formées", () => {
    expect(Object.keys(JB2A.TRAPS).sort()).toEqual(Object.keys(BLFX_TRAPS).sort());
    for ( const [key, parts] of [...Object.entries(JB2A.TRAPS), ...Object.entries(JB2A.TRAPS_BY_DAMAGE)] ) {
      parts.forEach((part, i) => expect(checkTrapPart(part, `${key}[${i}]`, "jb2a")).toEqual([]));
    }
  });
  it("les murs : au moins ceux de BLFX ; un mur couché a sa hauteur d'image", () => {
    for ( const key of Object.keys(BLFX_WALLS) ) expect(JB2A.WALLS[key], key).toBeTruthy();
    for ( const [key, wall] of Object.entries(JB2A.WALLS) ) {
      if ( wall.animations ) expect(wall.native > 0 && wall.thickness > 0, key).toBe(true);
    }
  });
  it("un impact par type de dégâts dnd5e ; une zone par type, plus le soin", () => {
    const types = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant",
      "slashing", "thunder"];
    expect(Object.keys(JB2A.IMPACTS).sort()).toEqual(types);
    expect(Object.keys(JB2A.AREAS_BY_DAMAGE).sort()).toEqual([...types, "healing"].sort());
    for ( const area of [...Object.values(JB2A.AREAS_BY_DAMAGE), ...Object.values(JB2A.AREAS_BY_IDENTIFIER), JB2A.BURNING] ) {
      expect(area.circle || area.cone || area.line).toBeTruthy();
    }
  });
});
