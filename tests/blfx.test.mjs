import { describe, expect, it } from "vitest";
import { aliasCommand, applyParams, buildEntries, fingerprint, isOurs, mergeInto, slugify, TAG } from "../module/scripts/core/blfx.mjs";

// Un en-tête de modèle à la manière de ceux de BLFX (pas une copie : le leur est sous licence).
const TEMPLATE = [
  "const ANIMATION1 = 'blfx.a'; // commentaire",
  "const SCALE1 = 1;",
  "const ENABLED1 = false;",
  "const ANIMATION1_BIS = 'x';",
  "await new Sequence().play();"
].join("\n");

describe("slugify (celui de BLFX)", () => {
  it("retire les accents au lieu de les translittérer", () => {
    expect(slugify("Lame décapitante")).toBe("lame-dcapitante");
    expect(slugify("Rayon d'affaiblissement")).toBe("rayon-daffaiblissement");
    expect(slugify("  Coup   nécrotique ")).toBe("coup-ncrotique");
    expect(slugify(undefined)).toBe("");
  });
});

describe("applyParams", () => {
  it("remplace la valeur et garde le commentaire", () => {
    const out = applyParams(TEMPLATE, { ANIMATION1: "blfx.b", SCALE1: 2.5, ENABLED1: true });
    expect(out).toContain("const ANIMATION1 = 'blfx.b'; // commentaire");
    expect(out).toContain("const SCALE1 = 2.5;");
    expect(out).toContain("const ENABLED1 = true;");
    expect(out).toContain("const ANIMATION1_BIS = 'x';");
  });
  it("refuse un paramètre que le modèle ne déclare pas", () => {
    expect(() => applyParams(TEMPLATE, { SOUND9: "x" })).toThrow(/SOUND9/);
  });
  it("échappe les apostrophes", () => {
    expect(applyParams(TEMPLATE, { ANIMATION1: "l'a" })).toContain("const ANIMATION1 = 'l\\'a';");
  });
});

describe("aliasCommand", () => {
  it("appelle la macro de BLFX pour le type, la clé et le déclencheur", () => {
    const c = aliasCommand("weapon.claw", "afterAttack");
    expect(c).toContain('["weapon","claw","afterAttack"]');
    expect(c).toContain("animationMap.js");
    expect(() => new Function(`return (async () => { ${c} })`)).not.toThrow();
  });
  it("refuse un alias mal formé", () => {
    expect(() => aliasCommand("claw", "afterAttack")).toThrow();
  });
});

describe("buildEntries", () => {
  const table = {
    "exemple-griffes": [{ trigger: "afterAttack", activity: "attack", alias: "weapon.claw" }],
    "exemple-cri": [{ trigger: "afterItemUse", template: "target", params: { ANIMATION1: "blfx.c" } }],
    "exemple-rien": [{ trigger: "afterItemUse", activity: "summon", alias: "spell.command" }]
  };
  const items = [
    { name: "Griffes", identifier: "exemple-griffes", activities: [{ name: "Attaque", type: "attack" }, { name: "Jet", type: "save" }] },
    { name: "Cri hurlant", identifier: "exemple-cri", activities: [{ name: "Sauvegarde", type: "save" }] },
    { name: "Rien", identifier: "exemple-rien", activities: [{ name: "Attaque", type: "attack" }] },
    { name: "Autre", identifier: "autre", activities: [{ name: "Attaque", type: "attack" }] }
  ];
  const { entries, problems } = buildEntries({ items, table, templates: { target: TEMPLATE }, version: "0.1.0" });

  it("range sous le nom de l'item et de l'activité, comme BLFX les cherche", () => {
    const e = entries.griffes.attaque.afterAttack;
    expect(e.animationData.eventType).toBe("After Attack Roll");
    expect(e.note.startsWith(TAG)).toBe(true);
    expect(entries.griffes.jet).toBeUndefined();
    expect(entries["cri-hurlant"].sauvegarde.afterItemUse.animationData.command).toContain("const ANIMATION1 = 'blfx.c';");
    expect(entries["cri-hurlant"].sauvegarde.afterItemUse.animationData.macroType).toBe("On Target or Token");
  });
  it("signale une animation sans activité du bon type, et ignore les identifiants hors table", () => {
    expect(problems).toEqual([expect.stringContaining("summon")]);
    expect(entries.autre).toBeUndefined();
  });
});

describe("mergeInto", () => {
  const ours = { griffes: { attaque: { afterAttack: { note: `${TAG} 0.2.0`, animationData: { command: "neuf" } } } } };
  it("garde les entrées du MJ, remplace les nôtres", () => {
    const existing = {
      dnd5e: {
        epee: { attaque: { afterAttack: { note: "à moi", animationData: { command: "mj" } } } },
        ancienne: { attaque: { afterAttack: { note: `${TAG} 0.1.0`, animationData: { command: "vieux" } } } }
      }
    };
    const { merged, added, removed, kept } = mergeInto(existing, ours);
    expect(merged.dnd5e.epee.attaque.afterAttack.animationData.command).toBe("mj");
    expect(merged.dnd5e.ancienne).toBeUndefined();
    expect(merged.dnd5e.griffes.attaque.afterAttack.animationData.command).toBe("neuf");
    expect({ added, removed, kept }).toEqual({ added: 1, removed: 1, kept: [] });
    expect(existing.dnd5e.ancienne).toBeDefined();
  });
  it("laisse gagner le MJ au même endroit", () => {
    const existing = { dnd5e: { griffes: { attaque: { afterAttack: { note: "", animationData: { command: "mj" } } } } } };
    const { merged, kept } = mergeInto(existing, ours);
    expect(merged.dnd5e.griffes.attaque.afterAttack.animationData.command).toBe("mj");
    expect(kept).toEqual(["griffes.attaque.afterAttack"]);
  });
  it("part d'un réglage vide", () => {
    expect(mergeInto(undefined, ours).added).toBe(1);
  });
});

describe("divers", () => {
  it("isOurs et fingerprint", () => {
    expect(isOurs({ note: `${TAG} x` })).toBe(true);
    expect(isOurs({ note: "autre" })).toBe(false);
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});
