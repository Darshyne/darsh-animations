import { describe, expect, it } from "vitest";
import { areaPreset, blfxKnows } from "../module/scripts/core/areas.mjs";
import { BY_DAMAGE, BY_IDENTIFIER } from "../module/scripts/data/areas.mjs";

const tables = { byIdentifier: BY_IDENTIFIER, byDamage: BY_DAMAGE };
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
// Les préréglages de région de Token Magic FX 0.8.4 (fx/presets/defaultpresets.js, bibliothèque `tmfx-region`).
const TMFX_REGION = ["Watery Surface", "Protoplasm", "Watery Surface 2", "Smoky Area", "Shock", "Annihilating Rays", "Classic Rays",
  "Smoke Filaments", "Flames", "Thick Fog", "Glowing Outline", "Waves", "Waves 2", "Waves 3", "Zone : Fire", "Zone : Electricity",
  "Zone : Blizzard", "Bulging Out", "Blurred Texture", "Bloomed Texture", "Wild Magic", "Spider Web 1", "Spider Web 2"];

describe("effets de zone (Token Magic FX)", () => {
  it("un effet pour chaque type de dégâts dnd5e, et le soin", () => {
    for ( const type of [...DAMAGE_TYPES, "healing"] ) expect(BY_DAMAGE[type], type).toBeTruthy();
  });
  it("chaque préréglage existe dans la bibliothèque de régions de Token Magic FX ; teintes #rrggbb, opacité 0–1", () => {
    for ( const [key, e] of Object.entries({ ...BY_DAMAGE, ...BY_IDENTIFIER }) ) {
      expect(TMFX_REGION, key).toContain(e.preset);
      if ( e.tint !== null ) expect(e.tint, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(e.opacity, key).toBeGreaterThan(0);
      expect(e.opacity, key).toBeLessThanOrEqual(1);
    }
  });
  it("Mains brûlantes : le feu ; l'identifiant passe avant le dégât ; le premier type qui a un effet", () => {
    expect(areaPreset({ identifier: "burning-hands", damageTypes: ["fire"] }, tables)).toMatchObject({ key: "fire", preset: "Zone : Fire" });
    expect(areaPreset({ identifier: "cloudkill", damageTypes: ["poison"] }, tables).key).toBe("cloudkill");
    expect(areaPreset({ damageTypes: ["mystery", "cold"] }, tables).key).toBe("cold");
    expect(areaPreset({ identifier: "mass-cure-wounds", healing: true }, tables).key).toBe("healing");
    expect(areaPreset({ identifier: "darkness" }, tables)).toBeNull();
  });
});

describe("BLFX reconnaît-il l'item ?", () => {
  const map = { dnd5e: { spell: { "fireball": { template: {} }, "burning-hands": {} }, weapon: { longsword: { afterAttack: {} } } } };
  it("par l'identifiant s'il est dans sa table, sinon par le nom en slug ; une entrée vide ne compte pas", () => {
    expect(blfxKnows(map, { type: "spell", name: "Boule de feu", identifier: "fireball" })).toBe(true);
    expect(blfxKnows(map, { type: "spell", name: "Fireball", identifier: "x" })).toBe(true);
    expect(blfxKnows(map, { type: "spell", name: "Mains brûlantes", identifier: "burning-hands" })).toBe(false);
    expect(blfxKnows(map, { type: "spell", name: "Moonbeam", identifier: "moonbeam" })).toBe(false);
  });
  it("arme de base, identifiants blfx-, Auto-Rec personnalisée ; table illisible : non", () => {
    expect(blfxKnows(map, { type: "weapon", name: "Épée longue +1", baseItem: "longsword" })).toBe(true);
    expect(blfxKnows(null, { type: "spell", name: "x", identifier: "blfx-torch" })).toBe(true);
    expect(blfxKnows(map, { type: "spell", name: "Moonbeam", identifier: "moonbeam" }, { custom: ["moonbeam"] })).toBe(true);
    expect(blfxKnows(null, { type: "spell", name: "Fireball", identifier: "fireball" })).toBe(false);
  });
});
