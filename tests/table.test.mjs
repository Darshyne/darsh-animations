import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATES, TRIGGERS } from "../module/scripts/core/blfx.mjs";
import { ACTIVITY_TYPES, checkAnimation } from "../module/scripts/core/registry.mjs";
import { ANIMATIONS } from "../module/scripts/data/animations.mjs";

// Le catalogue et l'index de l'Auto-Rec de BLFX (module premium) ne sont pas publiés : `npm run catalogue` les écrit sous
// prive/docs/ (ignoré par git). Sans eux, les tests qui les lisent sont sautés ; la forme de la table reste vérifiée.
const docs = path.resolve(import.meta.dirname, "../prive/docs");
const readDoc = name => {
  const file = path.join(docs, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
};
const catalogueList = readDoc("catalogue-blfx.json");
const autorec = readDoc("blfx-autorec.json");
const names = (catalogueList ?? []).map(c => c.name);
// Un nom de groupe vaut aussi : pour un rayon, Sequencer choisit la longueur (`…05ft`, `…30ft`) selon la distance.
const catalogue = { has: name => names.includes(name) || names.some(n => n.startsWith(`${name}.`)) };
if ( !catalogueList || !autorec ) {
  console.warn("table.test : prive/docs/catalogue-blfx.json ou blfx-autorec.json absent (npm run catalogue, BLFX installé) — "
    + "alias et noms d'animation non vérifiés");
}

const all = Object.entries(ANIMATIONS).flatMap(([identifier, list]) => list.map((a, i) => [`${identifier}[${i}]`, a]));

describe("table des animations", () => {
  it("n'est pas vide", () => expect(all.length).toBeGreaterThan(0));

  it.each(all)("%s : déclencheur, activité, alias XOR modèle", (id, a) => {
    expect(Object.keys(TRIGGERS)).toContain(a.trigger);
    if ( a.activity ) expect(ACTIVITY_TYPES).toContain(a.activity);
    expect(!!a.alias !== !!a.template).toBe(true);
    expect(checkAnimation(a, id)).toEqual([]);
  });

  it.skipIf(!autorec).each(all.filter(([, a]) => a.alias))("%s : l'alias existe dans l'Auto-Rec de BLFX (prive/docs)", (_, a) => {
    const [type, key] = a.alias.split(".");
    expect(autorec[type]?.[key], a.alias).toBeDefined();
    expect(autorec[type][key]).toContain(a.aliasTrigger ?? a.trigger);
  });

  it.skipIf(!catalogueList).each(all.filter(([, a]) => a.template))("%s : modèle connu, animations et sons au catalogue (prive/docs)", (_, a) => {
    expect(Object.keys(TEMPLATES)).toContain(a.template);
    for ( const [key, value] of Object.entries(a.params ?? {}) ) {
      expect(key).toMatch(/^[A-Z_]+\d$/);
      if ( /^(ANIMATION|SOUND)\d$/.test(key) ) expect(catalogue.has(value), `${key} = ${value}`).toBe(true);
    }
  });
});
