import { describe, it, expect } from "vitest";
import { smiteAnimation, smiteBackend } from "../module/scripts/core/smites.mjs";
import { resolveLabel } from "../module/scripts/core/aa.mjs";

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

describe("qui joue le châtiment : BLFX, sinon Automated Animations (issue #5)", () => {
  it("BLFX quand il a une animation de dégâts pour le sort, même si AA en a une aussi : jamais les deux", () => {
    expect(smiteBackend({ blfx: true, aa: true })).toBe("blfx");
    expect(smiteBackend({ blfx: true, aa: false })).toBe("blfx");
  });
  it("AA quand BLFX n'a rien (absent, Auto-Rec coupée ou pas d'animation après les dégâts)", () => {
    expect(smiteBackend({ blfx: false, aa: true })).toBe("aa");
  });
  it("personne quand aucun des deux n'a d'animation", () => {
    expect(smiteBackend({ blfx: false, aa: false })).toBeNull();
    expect(smiteBackend()).toBeNull();
  });
  it("le libellé anglais donné à AA pour un châtiment traduit (son API publique saute la traduction)", () => {
    // AA n'a pas d'entrée de châtiment par défaut : celle que le MJ ajoute.
    const settings = { ontoken: [{ label: "Divine Smite", menu: "ontoken" }] };
    expect(resolveLabel(settings, { keys: ["divinesmite"], nativeNames: ["Châtiment divin"], itemName: "Châtiment divin" })?.label)
      .toBe("Divine Smite");
    // AA le trouve seul (nom anglais, ou entrée du MJ dans sa langue) : rien à ajouter.
    expect(resolveLabel(settings, { keys: ["divinesmite"], nativeNames: ["Divine Smite"], itemName: "Divine Smite" })).toBeNull();
  });
});
