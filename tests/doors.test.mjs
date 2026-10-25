import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDoorPart, doorMoment } from "../module/scripts/core/doors.mjs";
import { BLFX_DOORS, DOOR_MOMENTS, JB2A_DOORS } from "../module/scripts/data/doors.mjs";

const read = (dir, name) => {
  const file = path.resolve(import.meta.dirname, dir, name);
  if ( !fs.existsSync(file) ) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return (Array.isArray(data) ? data : data.entries).map(e => e.name ?? e);
};
const blfx = read("../prive/docs", "catalogue-blfx.json");
const free = [...(read("../docs", "catalogue-jb2a.json") ?? []), ...(read("../docs", "catalogue-psfx.json") ?? [])];
const has = (names, name) => names.includes(name) || names.some(n => n.startsWith(`${name}.`));

const parts = (table, library) => Object.entries(table).flatMap(([m, ps]) => ps.map((p, i) => [`${library}.${m}[${i}]`, p, library]));
const all = [...parts(BLFX_DOORS, "blfx"), ...parts(JB2A_DOORS, "jb2a")];

describe("serrures de porte", () => {
  it("chaque rendu couvre les trois moments", () => {
    expect(Object.keys(BLFX_DOORS).sort()).toEqual([...DOOR_MOMENTS].sort());
    expect(Object.keys(JB2A_DOORS).sort()).toEqual([...DOOR_MOMENTS].sort());
  });
  it.each(all)("%s : forme", (label, part, library) => expect(checkDoorPart(part, label, library)).toEqual([]));
  it.skipIf(!blfx).each(parts(BLFX_DOORS, "blfx"))("%s : au catalogue BLFX (prive/docs)", (_, part) => {
    expect(has(blfx, part.animation), part.animation).toBe(true);
    if ( part.sound ) expect(has(blfx, part.sound), part.sound).toBe(true);
  });
  it.each(parts(JB2A_DOORS, "jb2a"))("%s : dans JB2A gratuit ou PSFX", (_, part) => {
    expect(has(free, part.animation), part.animation).toBe(true);
    if ( part.sound ) expect(has(free, part.sound), part.sound).toBe(true);
  });
  it("lit les hooks du moteur : bruit de forçage, déverrouillage, porte forcée", () => {
    expect(doorMoment("noise", { cause: "forceDoor" })).toBe("force");
    expect(doorMoment("noise", { cause: "footsteps" })).toBeNull();
    expect(doorMoment("doorUnlocked", { method: "pick" })).toBe("unlock");
    expect(doorMoment("doorUnlocked", { method: "key" })).toBe("unlock");
    expect(doorMoment("doorUnlocked", { method: "force" })).toBe("burst");
    expect(doorMoment("doorUnlocked", { method: "magic" })).toBeNull();
  });
});
