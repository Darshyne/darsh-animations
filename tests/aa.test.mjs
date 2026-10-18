import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aaNative, aaSearch, aaWillPlay, englishKeys, keySearch, normalize, resolveLabel, sortedEntries }
  from "../module/scripts/core/aa.mjs";

const here = import.meta.dirname;
const defaults = JSON.parse(fs.readFileSync(path.join(here, "fixtures/aa-defaults.json"), "utf8"));
/** Les menus d'AA tels que ses réglages les gardent : `{ melee: [{ label, menu }], … }`. */
const menus = Object.fromEntries(Object.entries(defaults).filter(([k]) => !k.startsWith("_"))
  .map(([menu, labels]) => [menu, labels.map(label => ({ label, menu }))]));
const fr = JSON.parse(fs.readFileSync(path.join(here, "../module/names/fr.json"), "utf8")).names;

describe("clés", () => {
  it("normalise : sans accents, ponctuation ni espaces", () => {
    expect(normalize("Hunter's Mark")).toBe("huntersmark");
    expect(normalize("Flèche acide de Melf")).toBe("flecheacidedemelf");
    expect(normalize("hunters-mark")).toBe("huntersmark");
  });
  it("l'ordre : activité, Babele, table de la langue, identifiant, arme de base — jamais le nom affiché", () => {
    expect(englishKeys({ name: "Boule de feu", babeleName: "Fireball", identifier: "fireball" }, fr)).toEqual(["fireball"]);
    expect(englishKeys({ name: "Épée longue", identifier: "epee-longue", baseItem: "longsword" }, fr)).toEqual(["longsword"]);
    expect(englishKeys({ name: "Souffle", activityName: "Souffle de feu", identifier: "souffle" }, { souffledefeu: "Fire Breath" }))
      .toEqual(["firebreath"]);
    expect(englishKeys({ name: "Truc", identifier: "new-item" })).toEqual([]);
  });
});

describe("la recherche d'AA reproduite", () => {
  const entries = sortedEntries(menus);
  it("les libellés les plus longs d'abord : « Light Crossbow » donne l'arbalète, pas l'arc", () => {
    expect(aaSearch(entries, "Light Crossbow").label).toBe("Crossbow");
    expect(aaSearch(entries, "Longbow").label).toBe("Bow");
    expect(aaSearch(entries, "Boule de feu")).toBeNull();
  });
  it("correspondance exacte et termes exclus", () => {
    const custom = sortedEntries({ melee: [{ label: "Dagger", menu: "melee", advanced: { exactMatch: true } },
      { label: "Sword", menu: "melee", advanced: { excludedTerms: ["Shortsword"] } }] });
    expect(aaSearch(custom, "Dagger").label).toBe("Dagger");
    expect(aaSearch(custom, "Silver Dagger")).toBeNull();
    expect(aaSearch(custom, "Shortsword")).toBeNull();
    expect(keySearch(custom, "shortsword")).toBeNull();
    expect(keySearch(custom, "dagger").label).toBe("Dagger");
  });
  it("une zone qui tombe sur une entrée à distance est recherchée parmi les zones avec le nom traduit (et échoue)", () => {
    expect(aaNative(menus, { names: ["Fire Bolt"], itemName: "Fire Bolt", isTemplate: true })).toBeNull();
    expect(aaNative(menus, { names: ["Call Lightning"], itemName: "Call Lightning", isTemplate: true }).menu).toBe("templatefx");
  });
});

describe("le libellé donné à AA", () => {
  it("un sort traduit par Babele", () => {
    expect(resolveLabel(menus, { keys: ["fireball"], nativeNames: ["Boule de feu"], itemName: "Boule de feu" }))
      .toEqual({ label: "Fireball", menu: "preset", key: "fireball" });
  });
  it("les apostrophes ne gênent plus (« hunters-mark » contre « Hunter's Mark »)", () => {
    const custom = { ontoken: [{ label: "Hunter's Mark", menu: "ontoken" }] };
    expect(resolveLabel(custom, { keys: ["huntersmark"], nativeNames: ["Marque du chasseur"], itemName: "Marque du chasseur" }).label)
      .toBe("Hunter's Mark");
  });
  it("une entrée du MJ dans la langue du monde l'emporte : rien à ajouter", () => {
    const custom = { ...menus, preset: [...menus.preset, { label: "Boule de feu", menu: "preset" }] };
    expect(resolveLabel(custom, { keys: ["fireball"], nativeNames: ["Boule de feu"], itemName: "Boule de feu" })).toBeNull();
  });
  it("une zone ne prend qu'une entrée de zone", () => {
    expect(resolveLabel(menus, { keys: ["calllightning"], nativeNames: ["Appel de la foudre"], itemName: "Appel de la foudre",
      isTemplate: true }).label).toBe("Call Lightning");
    expect(resolveLabel(menus, { keys: ["firebolt"], nativeNames: ["Trait de feu"], itemName: "Trait de feu", isTemplate: true }))
      .toBeNull();
  });
  it("les drapeaux d'AA sur l'objet ou l'activité passent avant", () => {
    const base = { settings: menus, keys: ["fireball"], nativeNames: ["Boule de feu"], itemName: "Boule de feu" };
    expect(aaWillPlay(base)).toBe(true);
    expect(aaWillPlay({ ...base, translate: false })).toBe(false);
    expect(aaWillPlay({ ...base, itemFlags: { killAnim: true } })).toBe(false);
    expect(aaWillPlay({ ...base, activityFlags: { isEnabled: false } })).toBe(false);
    expect(aaWillPlay({ ...base, keys: [], itemFlags: { isCustomized: true } })).toBe(true);
    expect(aaWillPlay({ ...base, autorecDisabled: true })).toBe(false);
  });
});

describe("table française (module/names/fr.json, tirée de dnd5e_fr-FR)", () => {
  it("des noms bien formés", () => {
    expect(Object.keys(fr).length).toBeGreaterThan(2000);
    for ( const [key, english] of Object.entries(fr) ) {
      expect(key).toBe(normalize(key));
      expect(typeof english).toBe("string");
    }
    expect(fr[normalize("Boule de feu")]).toBe("Fireball");
    expect(fr[normalize("Flèche acide de Melf")]).toBe("Melf's Acid Arrow");
  });
  it("chaque entrée par défaut d'AA est retrouvée depuis le nom français du SRD", () => {
    const missing = [];
    for ( const [menu, labels] of Object.entries(menus) ) {
      for ( const { label } of labels ) {
        const french = Object.entries(fr).filter(([, en]) => normalize(en).includes(normalize(label))).map(([k]) => k);
        for ( const name of french ) {
          const isTemplate = ["templatefx", "aura"].includes(menu);
          const ok = aaWillPlay({ settings: menus, keys: englishKeys({ name }, fr), nativeNames: [name], itemName: name, isTemplate });
          if ( !ok ) missing.push(`${name} (${label})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
