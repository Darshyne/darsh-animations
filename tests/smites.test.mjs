import { describe, it, expect } from "vitest";
import { smiteAnimation } from "../module/scripts/core/smites.mjs";

describe("châtiments ajoutés par DAS · Core (SPEC §18)", () => {
  const macro = () => null;
  const map = { dnd5e: { spell: {
    "divine-smite": { afterDamage: { macro }, afterItemUse: { macro } },
    "searing-smite": { afterDamage: { macro, defaultParams: { a: 1 } } },
    "hex": { afterItemUse: { macro } }
  } } };
  it("l'animation « après les dégâts » du sort, par son identifiant", () => {
    expect(smiteAnimation(map, { type: "spell", name: "Châtiment divin", identifier: "divine-smite" })?.macro).toBe(macro);
    expect(smiteAnimation(map, { type: "spell", identifier: "searing-smite" })?.defaultParams).toEqual({ a: 1 });
  });
  it("sans identifiant connu : le nom en slug, comme BLFX", () => {
    expect(smiteAnimation(map, { type: "spell", name: "Divine Smite", identifier: "" })?.macro).toBe(macro);
  });
  it("rien sans animation après les dégâts, sans table ou pour un autre type", () => {
    expect(smiteAnimation(map, { type: "spell", identifier: "hex" })).toBeNull();
    expect(smiteAnimation(null, { type: "spell", identifier: "divine-smite" })).toBeNull();
    expect(smiteAnimation(map, { type: "feat", identifier: "divine-smite" })).toBeNull();
  });
});
