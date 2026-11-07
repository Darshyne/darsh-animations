import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as S from "../module/scripts/data/strikes.mjs";
import { applyAliases, chooseAction, chooseRider, chooseSmite, expand } from "../module/scripts/core/strikes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = file => JSON.parse(fs.readFileSync(file, "utf8")).entries;
const free = new Set([...read(path.join(root, "docs/catalogue-jb2a.json")), ...read(path.join(root, "docs/catalogue-psfx.json"))]
  .map(e => e.name));
// Un nom vaut s'il est une entrée ou un groupe (préfixe d'entrées).
const prefixes = new Set();
for ( const n of free ) { const p = n.split("."); for ( let i = 1; i <= p.length; i++ ) prefixes.add(p.slice(0, i).join(".")); }
const exists = name => prefixes.has(name);

describe("aptitudes : recettes", () => {
  it("chaque animation a un nom du JB2A gratuit, chaque son existe dans PSFX", () => {
    const lists = [...Object.entries(S.FEATURES).flatMap(([k, f]) => [[k, f.animation, f.color], ...(f.arrive ? [[`${k}.arrive`, f.arrive, f.color]] : []),
      ...(f.cast ? [[`${k}.cast`, f.cast, f.color]] : [])]),
      ...Object.entries(S.UTILITY).map(([k, u]) => [`utility.${k}`, u.animation, u.color]),
      ...Object.entries(S.RIDERS).map(([k, r]) => [`rider.${k}`, r.animation, r.color]),
      ...Object.entries(S.SMITES).filter(([, m]) => m.animation).map(([k, m]) => [`smite.${k}`, m.animation, m.color])];
    expect(lists.filter(([, list, color]) => !expand(list, { color }).some(exists)).map(([k]) => k)).toEqual([]);
    const sounds = [...Object.values(S.FEATURE_SOUNDS), ...Object.values(S.FEATURES).flatMap(f => [f.sound, f.arriveSound, f.castSound]),
      ...Object.values(S.UTILITY).map(u => u.sound), ...Object.values(S.RIDERS).map(r => r.sound)].filter(Boolean);
    expect(sounds.filter(n => !exists(n))).toEqual([]);
  });
});

describe("aptitudes : choix", () => {
  it("Bénédiction : sur chaque cible, son du sort, pas d'impact", () => {
    const c = chooseAction({ itemType: "spell", keys: ["bless"], activityType: "utility" });
    expect(c.kind).toBe("onTarget");
    expect(c.animation[0]).toBe("jb2a.bless.400px.intro.yellow");
    expect(c.impact).toBeNull();
  });
  it("Foulée brumeuse : disparition puis réapparition, sans incantation", () => {
    const c = chooseAction({ itemType: "spell", keys: ["mistystep"], activityType: "utility" });
    expect(c.kind).toBe("teleport");
    expect(c.cast).toEqual([]);
    expect(c.arrive[0]).toBe("jb2a.misty_step.02.blue");
  });
  it("activité de téléportation de dnd5e sans exception (Porte dimensionnelle) : celle de Foulée brumeuse", () => {
    const c = chooseAction({ itemType: "spell", keys: ["dimensiondoor"], activityType: "teleport" });
    expect(c.kind).toBe("teleport");
    expect(c.arrive).toContain("jb2a.misty_step.02.blue");
  });
  it("Imposition des mains et Second souffle : soins d'aptitude, sans incantation", () => {
    expect(chooseAction({ itemType: "feat", keys: ["layonhands"], activityType: "heal" }).cast).toEqual([]);
    expect(chooseAction({ itemType: "feat", keys: ["secondwind"], activityType: "heal" }).animation[0])
      .toBe("jb2a.healing_generic.burst.greenorange");
  });
  it("utilitaire sans exception : bienfait sur un allié, marque sur un ennemi ; jamais une action de base ni un objet", () => {
    expect(chooseAction({ itemType: "spell", keys: ["magearmor"], activityType: "utility", affects: "self" }).family).toBe("utility:boon");
    expect(chooseAction({ itemType: "spell", keys: ["xyz"], activityType: "utility", affects: "enemy" }).family).toBe("utility:bane");
    expect(chooseAction({ itemType: "feat", keys: ["dash"], activityType: "utility" })).toBeNull();
    expect(chooseAction({ itemType: "consumable", keys: ["torch"], activityType: "utility" })).toBeNull();
  });
  it("Fléau (sauvegarde sans dégâts, exception) : sa marque, pas d'impact neutre en plus", () => {
    const c = chooseAction({ itemType: "spell", keys: ["bane"], activityType: "save" });
    expect(c.animation).toEqual(["jb2a.markers.fear.dark_purple.01"]);
    expect(c.impact).toBeNull();
  });
});

describe("riders et châtiments", () => {
  it("Attaque sournoise : sur la cible", () => {
    expect(chooseRider("sneak").animation).toContain("jb2a.sneak_attack.dark_green");
    expect(chooseRider("inconnu")).toBeNull();
  });
  it("Châtiment divin par son animation, Châtiment ardent par l'impact de feu, un châtiment maison par son type", () => {
    expect(chooseSmite(["divinesmite"], ["radiant"]).animation.at(-1)).toBe("jb2a.divine_smite.target.blueyellow");
    expect(chooseSmite(["searingsmite"], ["fire"]).animation).toEqual(["jb2a.impact.fire.01.orange"]);
    expect(chooseSmite(["frappe-maison"], ["cold"]).animation).toEqual(["jb2a.impact_themed.ice_shard.blue"]);
    expect(chooseSmite(["frappe-maison"], [])).toBeNull();
  });
});

describe("exceptions par identifiant (lot 4)", () => {
  const weaponish = { itemType: "weapon", weaponType: "natural", activityType: "attack", attackType: "melee", classification: "weapon",
    damageTypes: ["piercing"] };
  it("« joue comme » : Morsure vampirique → morsure ; Flamme radiante → Éclair traçant", () => {
    const bite = applyAliases(["vampiricbite"]);
    expect(chooseAction({ ...weaponish, keys: bite.keys }).family).toBe("natural:bite");
    const flame = applyAliases(["radiantflame"]);
    expect(chooseAction({ itemType: "feat", activityType: "attack", attackType: "ranged", classification: "spell", damageTypes: ["radiant"],
      keys: flame.keys }).family).toBe("spell:guidingbolt");
  });
  it("une table enregistrée : identifiants dans une autre langue, « joue comme » une arme ou une recette complète", () => {
    const extra = { "cos-morsure": "bite", "cos-rahadin-sabre": { like: "scimitar" },
      "cos-rayon": { kind: "shot", animation: ["jb2a.guiding_bolt.01.blueyellow"], sound: "psfx.ranged-magic.generic.beam.001" } };
    expect(chooseAction({ ...weaponish, keys: applyAliases(["cosmorsure"], extra).keys }).family).toBe("natural:bite");
    expect(chooseAction({ ...weaponish, weaponType: "martialM", damageTypes: ["slashing"],
      keys: applyAliases(["cosrahadinsabre"], extra).keys }).family).toBe("scimitar");
    const own = applyAliases(["cosrayon"], extra);
    const c = chooseAction({ itemType: "feat", activityType: "save", damageTypes: ["radiant"], keys: own.keys, own: own.own, ownKey: own.ownKey });
    expect(c.kind).toBe("shot");
    expect(c.animation[0]).toBe("jb2a.guiding_bolt.01.blueyellow");
  });
  it("une aptitude de créature attaquant « comme une arme » mais jouée comme un sort (Dards radiants → Éclair traçant)", () => {
    const keys = applyAliases(["cosithurieldardsradiants"], { "cos-ithuriel-dards-radiants": "guiding-bolt" }).keys;
    expect(chooseAction({ ...weaponish, itemType: "feat", weaponType: undefined, attackType: "ranged", damageTypes: ["radiant"], keys }).family)
      .toBe("spell:guidingbolt");
  });
  it("Regard mortel, Doigt de mort, Absorption des éléments, Conduit divin ont leur recette", () => {
    for ( const k of ["eyebite", "fingerofdeath", "absorbelements", "channeldivinity"] ) {
      expect(chooseAction({ itemType: "spell", keys: [k], activityType: "save", damageTypes: [] })?.family, k).toBe(`spell:${k}`);
    }
  });
});

