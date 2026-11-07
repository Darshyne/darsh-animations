import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONDITIONS } from "../module/scripts/data/conditions.mjs";
import { conditionDiff, conditionName, wantedConditions } from "../module/scripts/core/conditions.mjs";

const root = path.resolve(import.meta.dirname, "..");
const free = JSON.parse(fs.readFileSync(path.join(root, "docs/catalogue-jb2a.json"), "utf8")).entries;
const loops = new Map(free.map(e => [e.name, e.ms ?? null]));

describe("états : table", () => {
  it("chaque état a une boucle du JB2A gratuit", () => {
    expect(Object.entries(CONDITIONS).filter(([, c]) => !c.animation.some(n => loops.has(n))).map(([k]) => k)).toEqual([]);
  });
  it("ni Prone, ni Unconscious, ni Dead, ni Invisible, ni Concentrating (déjà montrés par le cœur, dnd5e ou DAS · Core)", () => {
    for ( const status of ["prone", "unconscious", "dead", "invisible", "concentrating"] ) expect(CONDITIONS[status]).toBeUndefined();
  });
});

describe("états : choix", () => {
  it("les états animés, dans l'ordre de la table ; les statuts inconnus ignorés", () => {
    expect(wantedConditions(["poisoned", "prone", "frightened"]).map(w => w.status)).toEqual(["frightened", "poisoned"]);
  });
  it("avec BLFX : ses états lui sont laissés, sauf réglage ; Maudit reste à nous", () => {
    expect(wantedConditions(["frightened", "cursed"], { blfx: true }).map(w => w.status)).toEqual(["cursed"]);
    expect(wantedConditions(["frightened", "cursed"], { blfx: true, withBlfx: true }).map(w => w.status)).toEqual(["frightened", "cursed"]);
  });
  it("ce qu'il faut poser et arrêter", () => {
    expect(conditionDiff([{ status: "charmed" }, { status: "stunned" }], ["stunned", "poisoned"])).toEqual({ add: ["charmed"], remove: ["poisoned"] });
    expect(conditionName("charmed")).toBe("darsh-condition-charmed");
  });
});
