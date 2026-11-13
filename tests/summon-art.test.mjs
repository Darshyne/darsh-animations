import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUMMON_ART, SUMMON_ART_ALIASES } from "../module/scripts/data/summon-art.mjs";
import { artEntry, artUpdate, chooseVariant, isCompendiumUuid, isOriginalArt, restoreUpdate, variantsOf } from "../module/scripts/core/summon-art.mjs";

// Catalogue de JB2A GRATUIT (publié, docs/) : chaque nom de la table y est, et les variantes se lisent comme Sequencer les donne.
const free = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../docs/catalogue-jb2a.json"), "utf8")).entries;
const names = new Set(free.map(e => e.name));
// Ce que Sequencer met dans `Database.flattenedEntriesAdvanced` : un chemin, un fichier (avec le dossier du module devant) ; une
// entrée à plusieurs fichiers revient sous le même chemin (`flatten_object` puis `split(".file")[0]`, sequencer 4.3.0).
const flat = free.flatMap(e => e.files.map(file => ({ path: e.name, file: `modules/JB2A_DnD5e/${file}` })));

describe("image animée des invocations (SPEC §26)", () => {
  it.each(Object.entries(SUMMON_ART))("%s : variante par défaut et famille dans JB2A gratuit", (key, entry) => {
    expect(names.has(entry.default), entry.default).toBe(true);
    expect(entry.default.startsWith(`${entry.family}.`)).toBe(true);
    expect(entry.scale).toBeGreaterThan(0);
    expect(entry.scale).toBeLessThanOrEqual(3);
  });

  it("les identifiants du SRD mènent aux entrées du Manuel des joueurs", () => {
    for ( const [srd, phb] of Object.entries(SUMMON_ART_ALIASES) ) {
      expect(SUMMON_ART[phb], phb).toBeTruthy();
      expect(artEntry(srd)).toMatchObject({ key: phb, family: SUMMON_ART[phb].family });
    }
    expect(artEntry("arcane-eye")).toBeNull();
    expect(artEntry(undefined)).toBeNull();
  });

  it("chaque sort a plus d'une variante dans JB2A gratuit, la variante par défaut comprise", () => {
    for ( const key of Object.keys(SUMMON_ART) ) {
      const variants = variantsOf(artEntry(key), flat);
      expect(variants.length, key).toBeGreaterThan(1);
      expect(variants.map(v => v.name), key).toContain(SUMMON_ART[key].default);
      expect(new Set(variants.map(v => v.file)).size, `${key} : un fichier, une variante`).toBe(variants.length);
    }
  });

  it("Arme spirituelle : groupée par arme, la masse est là", () => {
    const variants = variantsOf(artEntry("spiritual-weapon"), flat);
    const groups = new Set(variants.map(v => v.group));
    expect(groups.has("mace")).toBe(true);
    expect(groups.has("longsword")).toBe(true);
    expect(variants.find(v => v.name === "jb2a.spiritual_weapon.mace.spectral.blue")).toMatchObject({ group: "mace", label: "spectral.blue".replace(".", " ") });
  });

  it("Sphère de feu : le même fichier rangé sous deux noms ne compte qu'une fois, le nom le plus précis gardé", () => {
    const variants = variantsOf(artEntry("flaming-sphere"), flat);
    const orange = variants.filter(v => v.file.endsWith("FlamingSphere_01_Orange_200x200.webm"));
    expect(orange.map(v => v.name)).toEqual(["jb2a.flaming_sphere.200px.orange.01"]);
  });

  it("une entrée à plusieurs fichiers et des chemins étrangers ne gênent pas", () => {
    const entry = { key: "x", family: "jb2a.eyes.01" };
    const variants = variantsOf(entry, flat);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every(v => !/\.\d+$/.test(v.name))).toBe(true);
    expect(variantsOf(entry, [{ path: "jb2a.eyes.01.x", file: null }, { path: 3, file: "a.webm" }])).toEqual([]);
    expect(variantsOf(null, flat)).toEqual([]);
  });

  it("choix d'office : la dernière si elle existe encore, sinon la table, sinon la première", () => {
    const v = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(chooseVariant(v, { last: "c", fallback: "b" }).name).toBe("c");
    expect(chooseVariant(v, { last: "disparue", fallback: "b" }).name).toBe("b");
    expect(chooseVariant(v, {}).name).toBe("a");
    expect(chooseVariant([], { last: "a" })).toBeNull();
  });

  it("image choisie par le MJ : seule l'image du compendium d'origine se remplace", () => {
    expect(isCompendiumUuid("Compendium.dnd-players-handbook.actors.Actor.phbsplSpiritualW")).toBe(true);
    expect(isCompendiumUuid("Actor.abc")).toBe(false);
    expect(isCompendiumUuid(null)).toBe(false);
    const sourceSrc = "modules/dnd-players-handbook/assets/tokens/spiritual-weapon.webp";
    expect(isOriginalArt({ tokenSrc: sourceSrc, sourceSrc })).toBe(true);
    expect(isOriginalArt({ tokenSrc: "worlds/x/mon-arme.webp", sourceSrc })).toBe(false);
    // Acteurs du SRD de dnd5e : texture vide, Foundry pose l'image de l'acteur ou le token par défaut.
    const srd = { sourceSrc: "", sourceImg: "", defaultToken: "icons/svg/mystery-man.svg" };
    expect(isOriginalArt({ ...srd, tokenSrc: "icons/svg/mystery-man.svg" })).toBe(true);
    expect(isOriginalArt({ ...srd, tokenSrc: "" })).toBe(true);
    expect(isOriginalArt({ ...srd, tokenSrc: "worlds/x/mon-arme.webp" })).toBe(false);
  });

  it("la mise à jour du token : texture, teinte blanche, échelle, anneau coupé, retour possible", () => {
    const entry = artEntry("flaming-sphere");
    const token = { texture: { src: "empty.webp", tint: "#ea5a2a", scaleX: 1, scaleY: 1 }, ring: { enabled: true }, flags: {} };
    const variant = { name: "jb2a.flaming_sphere.200px.orange.01", file: "modules/JB2A_DnD5e/x.webm" };
    const update = artUpdate(entry, variant, token);
    expect(update).toMatchObject({ "texture.src": variant.file, "texture.tint": "#ffffff", "texture.scaleX": entry.scale,
      "ring.enabled": false });
    const flag = update["flags.darsh-animations.summonArt"];
    expect(flag).toMatchObject({ key: "flaming-sphere", name: variant.name, from: { src: "empty.webp", tint: "#ea5a2a", ring: true } });
    // Une seconde pose garde l'image d'origine, pas la première variante.
    const again = artUpdate(entry, { name: "b", file: "b.webm" }, { ...token, texture: { src: variant.file }, flags: { "darsh-animations": { summonArt: flag } } });
    expect(again["flags.darsh-animations.summonArt"].from.src).toBe("empty.webp");
    const back = restoreUpdate({ flags: { "darsh-animations": { summonArt: flag } } });
    expect(back).toMatchObject({ "texture.src": "empty.webp", "texture.tint": "#ea5a2a", "ring.enabled": true, "flags.darsh-animations.summonArt": null });
    expect(restoreUpdate({ flags: {} })).toBeNull();
  });
});
