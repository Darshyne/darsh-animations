import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// core/ et data/ restent des fonctions et des données pures : rien de Foundry (testables ici, hors du jeu).
const scripts = path.resolve(import.meta.dirname, "../module/scripts");
const pure = ["core", "data"].flatMap(dir => fs.readdirSync(path.join(scripts, dir)).map(f => path.join(scripts, dir, f)));
const code = file => fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
  // Les macros générées (texte entre accents graves) parlent à Foundry : c'est voulu, elles s'exécutent dans le jeu.
  .replace(/`[\s\S]*?`/g, "``");

describe("couches", () => {
  it.each(pure.map(f => [path.relative(scripts, f), f]))("%s n'utilise ni game, ni canvas, ni Hooks, ni CONFIG, ni foundry", (_, file) => {
    expect(code(file)).not.toMatch(/\b(game|canvas|Hooks|CONFIG|foundry|ui)\./);
  });
});
