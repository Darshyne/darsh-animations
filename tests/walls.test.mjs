import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lineEnds, wallShape, ringSegments, animationFor } from "../module/scripts/core/walls.mjs";
import { WALLS } from "../module/scripts/data/walls.mjs";

// Le catalogue du pack BLFX (premium) n'est pas publié : vérifié seulement là où `npm run catalogue` l'a écrit.
const file = path.resolve(import.meta.dirname, "../prive/docs/catalogue-blfx.json");
const names = fs.existsSync(file) ? new Set(JSON.parse(fs.readFileSync(file, "utf8")).map(c => c.name)) : null;

describe("murs posés par points", () => {
  it("les segments d'un mur en lignes", () => {
    const [[a, b]] = wallShape([{ type: "line", x: 0, y: 0, rotation: 90, length: 280, width: 28 }]).segments;
    expect(a).toEqual({ x: 0, y: 0 });
    expect(Math.round(b.x)).toBe(0);
    expect(b.y).toBe(280);
  });
  it("un anneau : forme « ring », cercle, ou ellipse ronde", () => {
    expect(wallShape([{ type: "ring", x: 5, y: 5, radius: 280, innerWidth: 14, outerWidth: 14 }])).toEqual({ ring: { x: 5, y: 5, radius: 280 } });
    expect(wallShape([{ type: "circle", x: 5, y: 5, radius: 280 }])).toEqual({ ring: { x: 5, y: 5, radius: 280 } });
    expect(wallShape([{ type: "ellipse", x: 5, y: 5, radiusX: 280, radiusY: 280 }])).toEqual({ ring: { x: 5, y: 5, radius: 280 } });
    expect(ringSegments({ x: 0, y: 0, radius: 100 }, 4)).toHaveLength(4);
  });
  it("l'animation de la longueur la plus proche", () => {
    const a = WALLS["wall-of-fire"].animations;
    expect(animationFor(a, 30)).toBe(a[30]);
    expect(animationFor(a, 45)).toBe(a[30]);
    expect(animationFor(a, 5)).toBe(a[10]);
    expect(lineEnds({ x: 1, y: 2, rotation: 0, length: 3 })[1]).toEqual({ x: 4, y: 2 });
  });
  it.skipIf(!names)("chaque animation de mur existe dans le pack BLFX (prive/docs)", () => {
    for ( const entry of Object.values(WALLS) ) for ( const name of Object.values(entry.animations) ) expect(names.has(name), name).toBe(true);
  });
});
