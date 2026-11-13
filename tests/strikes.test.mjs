import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as S from "../module/scripts/data/strikes.mjs";
import { carriesActivity, chooseStrike, expand, judgeAgainstAc, strikeForm, strikeTimeline } from "../module/scripts/core/strikes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = file => JSON.parse(fs.readFileSync(file, "utf8")).entries;
const leavesOf = entries => new Set(entries.map(e => e.name));
const free = leavesOf([...read(path.join(root, "docs/catalogue-jb2a.json")), ...read(path.join(root, "docs/catalogue-psfx.json"))]);
// Le catalogue du Premium est privé (prive/, contenu payant) : ses tests sont sautés sans lui (CI comprise).
const premiumFile = path.join(root, "prive/docs/catalogue-jb2a-premium.json");
const premium = fs.existsSync(premiumFile) ? leavesOf(read(premiumFile)) : null;
// Un nom vaut s'il est une entrée ou un groupe (préfixe d'entrées) : tous les préfixes, calculés une fois par catalogue.
const prefixes = new Map();
const existsIn = set => {
  if ( !prefixes.has(set) ) {
    const all = new Set();
    for ( const n of set ) { const p = n.split("."); for ( let i = 1; i <= p.length; i++ ) all.add(p.slice(0, i).join(".")); }
    prefixes.set(set, all);
  }
  return name => prefixes.get(set).has(name);
};

/** Toutes les recettes de la table (coups, tirs, lancers, retours). */
function recipes() {
  const out = [];
  for ( const [key, weapon] of Object.entries(S.WEAPONS) ) {
    for ( const form of ["melee", "ranged", "thrown"] ) if ( weapon[form] ) out.push([`${key}.${form}`, weapon[form]]);
  }
  out.push(["unarmed", S.UNARMED]);
  for ( const [word, recipe] of S.NATURAL ) out.push([`natural.${word}`, recipe]);
  for ( const [key, recipe] of Object.entries(S.GENERIC) ) out.push([`generic.${key}`, recipe]);
  return out;
}
const VARIANTS = [...new Set(["white", ...Object.values(S.DAMAGE_COLORS)])].flatMap(color =>
  ["physical", ...Object.values(S.ELEMENTS)].flatMap(element => ["one_handed", "two_handed"].map(hands => ({ color, element, hands }))));

describe("attaques d'arme : recettes", () => {
  it("chaque animation a un nom du JB2A gratuit, quelle que soit la couleur (un retour d'arme peut n'exister qu'au Premium)", () => {
    const bad = [];
    for ( const [key, recipe] of recipes() ) {
      for ( const list of [recipe.animation] ) {
        for ( const vars of VARIANTS ) if ( !expand(list, vars).some(existsIn(free)) ) bad.push(`${key} ${JSON.stringify(vars)}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
  it("chaque son et chaque impact existent (PSFX, JB2A gratuit)", () => {
    expect(Object.values(S.SOUNDS).filter(n => !existsIn(free)(n))).toEqual([]);
    for ( const impact of Object.values(S.STRIKE_IMPACTS) ) {
      expect(impact.animation.some(existsIn(free))).toBe(true);
      expect(existsIn(free)(impact.sound)).toBe(true);
    }
  });
  it.skipIf(!premium)("chaque nom absent du gratuit existe dans le Premium (pour au moins une couleur)", () => {
    const bad = [];
    const all = [...recipes().flatMap(([key, r]) => [...r.animation, ...(r.back ?? [])].map(n => [key, n])),
      ...Object.values(S.WEAPONS).filter(w => w.fire).map(w => ["fire", w.fire])];
    for ( const [key, name] of all ) {
      const variants = VARIANTS.map(vars => expand([name], vars)).flat();
      if ( variants.some(existsIn(free)) ) continue;
      if ( !variants.some(existsIn(premium)) ) bad.push(`${key}: ${name}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

const longsword = { itemType: "weapon", weaponType: "martialM", baseItem: "longsword", keys: ["longsword"], properties: ["ver"],
  attackType: "melee", classification: "weapon", damageTypes: ["slashing"] };

describe("attaques d'arme : choix", () => {
  it("épée longue au contact : le coup de l'épée, en blanc, souffle léger, impact tranchant", () => {
    const c = chooseStrike(longsword);
    expect(c.kind).toBe("swing");
    expect(c.animation.at(-1)).toBe("jb2a.sword.melee.01.white");
    expect(c.color).toBe("white");
    expect(c.swoosh).toBe(S.SOUNDS.light);
    expect(c.impact).toBe(S.STRIKE_IMPACTS.slashing);
  });
  it("Langue de feu : la variante feu du Premium d'abord, orange, puis le blanc du gratuit", () => {
    const c = chooseStrike({ ...longsword, properties: ["mgc"], damageTypes: ["slashing", "fire"] });
    expect(c.color).toBe("orange");
    expect(c.animation[0]).toBe("jb2a.sword.melee.fire.orange");
    expect(c.animation.at(-1)).toBe("jb2a.sword.melee.01.white");
    expect(c.swoosh).toBe(S.SOUNDS.fire);
  });
  it("arc long : flèche étirée, son d'arc ; flèche de feu au Premium", () => {
    const c = chooseStrike({ ...longsword, weaponType: "martialR", baseItem: "longbow", attackType: "ranged", damageTypes: ["piercing", "fire"] });
    expect(c.kind).toBe("shot");
    expect(c.animation[0]).toBe("jb2a.arrow.fire.orange");
    expect(c.animation.at(-1)).toBe("jb2a.arrow.physical.white.01");
    expect(c.swoosh).toBe(S.SOUNDS.fire);
  });
  it("dague lancée : elle tourne vers la cible ; une arme qui revient a son retour", () => {
    const dagger = { ...longsword, weaponType: "simpleM", baseItem: "dagger", properties: ["fin", "lgt", "thr"], attackMode: "thrown",
      damageTypes: ["piercing"] };
    expect(strikeForm(dagger)).toBe("thrown");
    expect(chooseStrike(dagger).animation.at(-1)).toBe("jb2a.dagger.throw.01.white");
    expect(chooseStrike(dagger).back).toEqual([]);
    expect(chooseStrike({ ...dagger, properties: [...dagger.properties, "ret"] }).back.at(-1)).toBe("jb2a.dagger.return.01.white");
  });
  it("hache à deux mains : souffle lourd ; arme maison sans arme de base : coup générique du type de dégâts", () => {
    expect(chooseStrike({ ...longsword, baseItem: "greataxe", properties: ["hvy", "two"] }).swoosh).toBe(S.SOUNDS.heavy);
    const homebrew = chooseStrike({ ...longsword, baseItem: null, keys: ["epee-du-roi"], damageTypes: ["bludgeoning"], properties: ["two"] });
    expect(homebrew.family).toBe("generic:bludgeoning");
    expect(homebrew.animation[0]).toBe("jb2a.melee_generic.bludgeoning.two_handed");
  });
  it("attaques naturelles : morsure et griffes sur la cible, coup à mains nues, repli par type", () => {
    const natural = { itemType: "weapon", weaponType: "natural", keys: ["bite"], attackType: "melee", classification: "weapon",
      damageTypes: ["piercing"] };
    expect(chooseStrike(natural).kind).toBe("onTarget");
    expect(chooseStrike(natural).animation.at(-1)).toBe("jb2a.bite.400px.red");
    expect(chooseStrike({ ...natural, keys: ["claws"], damageTypes: ["slashing"] }).animation.at(-1)).toBe("jb2a.claws.400px.red");
    expect(chooseStrike({ ...natural, keys: ["unarmedstrike"] }).family).toBe("unarmed");
    expect(chooseStrike({ ...natural, keys: ["mysterious-appendage"], damageTypes: ["bludgeoning"] }).family).toBe("natural:bludgeoning");
    // Une aptitude de créature (objet « feat ») avec une attaque d'arme, sans arme : attaque naturelle.
    expect(chooseStrike({ ...natural, itemType: "feat", weaponType: undefined }).family).toBe("natural:bite");
  });
  it("un sort à jet d'attaque n'est pas une attaque d'arme (lot 2)", () => {
    expect(chooseStrike({ itemType: "spell", attackType: "ranged", classification: "spell", damageTypes: ["fire"] })).toBeNull();
  });
  it("les noms se développent par couleur, puis le blanc", () => {
    expect(expand(["a.{color}"], { color: "orange" })).toEqual(["a.orange", "a.red", "a.yellow", "a.dark_orangepurple", "a.white"]);
  });
});

describe("attaques d'arme : déroulé", () => {
  it("raté, critique, Bouclier, verdict inconnu", () => {
    const t = strikeTimeline([
      { token: "a", hit: true, critical: true }, { token: "b", hit: false, reason: "miss" },
      { token: "c", hit: false, reason: "reaction" }, { token: "d", hit: null }
    ]);
    expect(t.map(s => [s.hit, s.critical, s.impact, s.shielded])).toEqual([
      [true, true, true, false], [false, false, false, false], [false, false, false, true], [true, false, false, false]
    ]);
    expect(t[1].delay).toBeGreaterThan(t[0].delay);
  });
  it("sans DAS · Core : touché contre la CA notée, 1 naturel raté, 20 naturel critique", () => {
    const targets = [{ token: "a", ac: 15 }, { token: "b", ac: 12 }, { token: "c", ac: null }];
    expect(judgeAgainstAc({ total: 13 }, targets).map(t => t.hit)).toEqual([false, true, null]);
    expect(judgeAgainstAc({ total: 30, isFumble: true }, targets).every(t => t.hit === false)).toBe(true);
    expect(judgeAgainstAc({ total: 5, isCritical: true }, targets).every(t => t.hit && t.critical)).toBe(true);
  });
});

describe("messages dont l'activité se lit", () => {
  it("carte d'utilisation et jet d'attaque seulement : jamais une carte de tour de combat (dnd5e 6.1 y lève)", () => {
    expect(carriesActivity({ type: "usage" })).toBe(true);
    expect(carriesActivity({ type: "attack" })).toBe(true);
    for ( const type of ["turn", "rest", "damage", "base", "save", undefined] ) expect(carriesActivity({ type })).toBe(false);
    expect(carriesActivity(null)).toBe(false);
  });
});
