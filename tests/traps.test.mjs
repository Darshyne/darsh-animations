import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkTrapPart, trapKeys, trapParts } from "../module/scripts/core/traps.mjs";
import { BY_DAMAGE, TRAPS } from "../module/scripts/data/traps.mjs";

const file = path.resolve(import.meta.dirname, "../prive/docs/catalogue-blfx.json");
const names = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).map(c => c.name) : null;
const inCatalogue = name => names.includes(name) || names.some(n => n.startsWith(`${name}.`));

const all = [...Object.entries(TRAPS), ...Object.entries(BY_DAMAGE)]
  .flatMap(([key, parts]) => parts.map((p, i) => [`${key}[${i}]`, p]));

describe("table des pièges", () => {
  it("couvre les pièges du DMG 2024", () => {
    for ( const id of ["dmgPoisonedDarts", "dmgFireCastingSt", "dmgFireballFungu", "dmgCollapsingRoo", "dmgFallingNetTra",
      "dmgHiddenPitTrap", "dmgPoisonedNeedl", "dmgQuicksandPit0", "dmgRollingStoneT", "dmgSpikedPitTrap"] ) {
      expect(TRAPS[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it.each(all)("%s : forme", (label, part) => expect(checkTrapPart(part, label)).toEqual([]));
  it.skipIf(!names).each(all)("%s : animation et son au catalogue (prive/docs)", (_, part) => {
    expect(inCatalogue(part.animation), part.animation).toBe(true);
    if ( part.sound ) expect(inCatalogue(part.sound), part.sound).toBe(true);
  });
});

describe("choix des animations d'un piège", () => {
  it("clés : l'id, puis l'id de la source de compendium", () => {
    expect(trapKeys({ id: "abc", sourceId: "Compendium.dnd-dungeon-masters-guide.actors.Actor.dmgPoisonedDarts" }))
      .toEqual(["abc", "dmgPoisonedDarts"]);
    expect(trapKeys({ id: "dmgPoisonedDarts" })).toEqual(["dmgPoisonedDarts"]);
    expect(trapKeys({})).toEqual([]);
  });
  it("un piège du DMG importé sous un autre id garde ses animations", () => {
    expect(trapParts({ id: "x1", sourceId: "Compendium.dnd-dungeon-masters-guide.actors.Actor.dmgFallingNetTra" }, TRAPS, BY_DAMAGE))
      .toBe(TRAPS.dmgFallingNetTra);
  });
  it("sans entrée : l'impact du premier type de dégâts connu ; sans dégâts : rien", () => {
    expect(trapParts({ id: "maison", damageTypes: ["fire"] }, TRAPS, BY_DAMAGE)).toBe(BY_DAMAGE.fire);
    expect(trapParts({ id: "maison", damageTypes: ["weird", "cold"] }, TRAPS, BY_DAMAGE)).toBe(BY_DAMAGE.cold);
    expect(trapParts({ id: "maison" }, TRAPS, BY_DAMAGE)).toEqual([]);
  });
  it("refuse une partie mal formée", () => {
    expect(checkTrapPart({ at: "sky", animation: "x", delay: -1 }, "p")).toHaveLength(3);
  });
});
