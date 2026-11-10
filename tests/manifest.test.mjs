import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Foundry propose à l'installation tout module « requires » ou « recommends », cases cochées, et descend dans leurs
// propres « requires » qu'il marque « nécessaires » (BLFX → blfx-assets-pack01). Aucune source d'animation n'est
// obligatoire : le manifeste n'en déclare aucune (SPEC §24).
const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../module/module.json"), "utf8"));

describe("manifeste", () => {
  it("ne demande ni ne recommande aucun module", () => {
    expect(manifest.relationships?.requires ?? []).toEqual([]);
    expect(manifest.relationships?.recommends ?? []).toEqual([]);
  });

  it("garde le système dnd5e", () => {
    expect(manifest.relationships.systems.map(s => s.id)).toEqual(["dnd5e"]);
  });
});
