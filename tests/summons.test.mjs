import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDoorPart } from "../module/scripts/core/doors.mjs";
import { JB2A_SUMMON } from "../module/scripts/data/summons.mjs";
import { ANIMATIONS } from "../module/scripts/data/animations.mjs";

const read = name => {
  const file = path.resolve(import.meta.dirname, "../docs", name);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return (Array.isArray(data) ? data : data.entries).map(e => e.name ?? e);
};
const free = [...read("catalogue-jb2a.json"), ...read("catalogue-psfx.json")];
const has = name => free.includes(name) || free.some(n => n.startsWith(`${name}.`));

describe("apparition d'une invocation (issue dnd5e-combat#38)", () => {
  it.each(JB2A_SUMMON.map((p, i) => [`jb2a.summon[${i}]`, p]))("%s : forme, dans JB2A gratuit ou PSFX", (label, part) => {
    expect(checkDoorPart(part, label, "jb2a")).toEqual([]);
    expect(has(part.animation), part.animation).toBe(true);
    if ( part.sound ) expect(has(part.sound), part.sound).toBe(true);
  });
  it("les invocations que BLFX 3.5.4 n'anime pas ont une entrée « After Summon »", () => {
    for ( const id of ["summon-celestial", "summon-fiend", "summon-dragon", "conjure-elemental", "animate-objects", "create-undead"] ) {
      expect(ANIMATIONS[id]?.[0], id).toMatchObject({ trigger: "afterSummon", template: "summon" });
      expect(ANIMATIONS[id][0].params.HIDDEN_TARGET3 ?? true, id).toBe(true);
    }
  });
});
