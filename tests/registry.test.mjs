import { describe, expect, it } from "vitest";
import { checkRegistration, combine } from "../module/scripts/core/registry.mjs";

// Exemple synthétique d'un module tiers qui enregistre ses animations (hook `darsh-animations.register`).
const REGISTRATION = {
  animations: {
    "exemple-griffe": [{ trigger: "afterAttack", activity: "attack", alias: "weapon.claw" }],
    "exemple-souffle": [{ trigger: "createTemplate", template: "cone", params: { ENABLED1: false, ANIMATION3: "blfx.x" } }],
    "eyebite": [{ trigger: "afterItemUse", alias: "spell.command" }]
  },
  without: { "exemple-pas": "déplacement" },
  sources: ["module-exemple.creatures"]
};

describe("tables enregistrées par d'autres modules", () => {
  it("une table bien formée passe entière", () => {
    const { table, errors } = checkRegistration(REGISTRATION);
    expect(errors).toEqual([]);
    expect(table).toEqual({ ...REGISTRATION, strikes: {} });
  });

  it("le champ strikes (lot 4) : « joue comme » et recettes gardés, une recette fausse refuse la table strikes", () => {
    const good = { "cos-morsure": "bite", "cos-sabre": { like: "scimitar" },
      "cos-rayon": { kind: "shot", animation: ["jb2a.guiding_bolt.01.blueyellow"], sound: "psfx.ranged-magic.generic.beam.001" } };
    expect(checkRegistration({ animations: {}, strikes: good })).toEqual({ table: { animations: {}, without: {}, sources: [], strikes: good }, errors: [] });
    const bad = checkRegistration({ animations: {}, strikes: { x: { kind: "swing", animation: ["foo"] } } });
    expect(bad.table.strikes).toEqual({});
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it("une animation fausse est écartée, le reste gardé", () => {
    const { table, errors } = checkRegistration({ animations: {
      ok: [{ trigger: "afterAttack", alias: "weapon.claw" }],
      bad: [{ trigger: "afterNothing", alias: "weapon.claw", template: "cone" }],
      notList: { trigger: "afterAttack" }
    }, sources: ["pas un pack"] });
    expect(Object.keys(table.animations)).toEqual(["ok"]);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("fusion : livrée, puis chaque table dans l'ordre ; une entrée enregistrée remplace celle de même identifiant", () => {
    const base = { animations: { eyebite: [{ trigger: "afterItemUse", alias: "spell.x" }], other: [] }, without: { a: "x" }, sources: ["p.q"] };
    const out = combine(base, [checkRegistration(REGISTRATION).table]);
    expect(Object.keys(out.animations)).toEqual(["eyebite", "other", "exemple-griffe", "exemple-souffle"]);
    expect(out.animations.eyebite[0].alias).toBe("spell.command");
    expect(out.without).toEqual({ a: "x", "exemple-pas": "déplacement" });
    expect(out.sources).toEqual(["p.q", "module-exemple.creatures"]);
    expect(base.animations.eyebite[0].alias).toBe("spell.x");
  });
});
