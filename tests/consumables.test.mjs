import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classify, filtersDuration, fill, pickBackend, tokenMagicFilters } from "../module/scripts/core/consumables.mjs";
import { BLFX_BUILTIN, BLFX_RECIPES, BY_IDENTIFIER, COLORS, IMPACT, KINDS, MOODS, NATIVE, SIGNATURES, TOKENMAGIC_RECIPES }
  from "../module/scripts/data/consumables.mjs";

const data = { kinds: KINDS, byIdentifier: BY_IDENTIFIER };
const consumable = (subtype, identifier, activities=[]) => ({ type: "consumable", subtype, identifier, activities });

// Formes relevées dans les compendiums du SRD, du Manuel des joueurs et du Guide du maître (2026-10-13).
describe("classement d'un consommable", () => {
  it("potion de soin : soin, rouge", () => {
    expect(classify(consumable("potion", "potion-of-healing", [{ type: "heal", healingTypes: ["healing"] }]), data))
      .toEqual({ kind: "heal", color: "red", mood: "positive", damage: null, signature: null });
  });
  it("une couleur par identifiant", () => {
    expect(classify(consumable("potion", "fire-potion-of-giant-strength", [{ type: "utility" }]), data))
      .toMatchObject({ kind: "potion", color: "red", mood: "positive", signature: "grow" });
    expect(classify(consumable("potion", "potion-of-heroism", [{ type: "heal", healingTypes: ["temphp"] }]), data).color)
      .toBe("yellow");
  });
  it("potion inconnue : potion, violette", () => {
    expect(classify(consumable("potion", "potion-maison", [{ type: "cast" }]), data))
      .toEqual({ kind: "potion", color: "purple", mood: "positive", damage: null, signature: null });
  });
  it("flasques lancées (sauvegardes en 2024) : la sorte et les dégâts de l'éclaboussure", () => {
    expect(classify(consumable("potion", "alchemists-fire", [{ type: "save", damageTypes: ["fire"] }]), data))
      .toMatchObject({ kind: "thrown", color: "orange", mood: "negative", damage: "fire" });
    expect(classify(consumable("potion", "holy-water", [{ type: "save", damageTypes: ["radiant"] }]), data).damage).toBe("radiant");
    expect(classify(consumable("potion", "oil", [{ type: "save" }, { type: "damage", damageTypes: ["fire"] }]), data))
      .toMatchObject({ kind: "thrown", color: "orange", damage: null });
  });
  it("poisons : le sous-type, et une potion qui ne fait que du poison", () => {
    expect(classify(consumable("poison", "serpent-venom", [{ type: "save", damageTypes: ["poison"] }]), data).kind).toBe("poison");
    expect(classify(consumable("potion", "poison-basic", [{ type: "damage", damageTypes: ["poison"] }]), data).kind).toBe("poison");
    expect(classify(consumable("potion", "potion-of-poison", [{ type: "save", damageTypes: ["poison"] }]), data).kind).toBe("poison");
  });
  it("parchemins, boissons, nourriture", () => {
    expect(classify(consumable("scroll", "spell-scroll-level-1"), data).kind).toBe("scroll");
    expect(classify(consumable("food", "water-pint", [{ type: "utility" }]), data).kind).toBe("drink");
    expect(classify(consumable("food", "wine-pint"), data).kind).toBe("drink");
    expect(classify(consumable("food", "rations"), data).kind).toBe("food");
    expect(classify(consumable("food", "fruit-of-restoration", [{ type: "cast" }]), data))
      .toMatchObject({ kind: "food", color: "green", mood: "positive" });
    expect(classify(consumable("scroll", "spell-scroll"), data).mood).toBe("neutral");
    expect(classify(consumable("poison", "serpent-venom"), data).mood).toBe("negative");
  });
  it("humeur propre : une potion qui nuit à qui la boit, une potion neutre", () => {
    expect(classify(consumable("potion", "truth-serum", [{ type: "save" }]), data)).toMatchObject({ kind: "potion", mood: "negative" });
    expect(classify(consumable("potion", "philter-of-love", [{ type: "utility" }]), data)).toMatchObject({ mood: "neutral", signature: "heart" });
  });
  it("rien pour les munitions, babioles, et ce qui n'est pas un consommable", () => {
    expect(classify(consumable("ammo", "arrows"), data)).toBeNull();
    expect(classify(consumable("trinket", "hooded-lantern", [{ type: "utility" }]), data)).toBeNull();
    expect(classify({ type: "weapon", identifier: "dagger" }, data)).toBeNull();
    expect(classify(null, data)).toBeNull();
  });
});

describe("choix du rendu : BLFX > Token Magic FX > autonome", () => {
  it("auto : le premier disponible, l'autonome toujours là", () => {
    expect(pickBackend("auto", { blfx: true, tokenmagic: true })).toBe("blfx");
    expect(pickBackend("auto", { blfx: false, tokenmagic: true })).toBe("tokenmagic");
    expect(pickBackend("auto", {})).toBe("native");
  });
  it("un rendu demandé : pris s'il est là, sinon le suivant de l'ordre", () => {
    expect(pickBackend("tokenmagic", { blfx: true, tokenmagic: true })).toBe("tokenmagic");
    expect(pickBackend("tokenmagic", { blfx: true })).toBe("native");
    expect(pickBackend("blfx", { tokenmagic: true })).toBe("tokenmagic");
    expect(pickBackend("blfx", {})).toBe("native");
    expect(pickBackend("native", { blfx: true, tokenmagic: true })).toBe("native");
  });
  it("JB2A + PSFX entre BLFX et Token Magic FX", () => {
    expect(pickBackend("auto", { blfx: true, jb2a: true, tokenmagic: true })).toBe("blfx");
    expect(pickBackend("auto", { jb2a: true, tokenmagic: true })).toBe("jb2a");
    expect(pickBackend("jb2a", { blfx: true, tokenmagic: true })).toBe("tokenmagic");
    expect(pickBackend("blfx", { jb2a: true })).toBe("jb2a");
    expect(pickBackend("jb2a", { jb2a: true, blfx: true })).toBe("jb2a");
  });
  it("« none » : rien", () => expect(pickBackend("none", { blfx: true, tokenmagic: true })).toBeNull());
});

describe("tables", () => {
  const colors = new Set([...Object.values(KINDS).map(k => k.color), ...Object.values(BY_IDENTIFIER).map(e => e.color).filter(Boolean),
    ...Object.values(MOODS)]);
  it("chaque couleur employée existe", () => {
    for ( const c of colors ) expect(Number.isInteger(COLORS[c]), c).toBe(true);
  });
  it("humeurs : vert positif, rouge négatif, bleu neutre ; chaque humeur employée existe", () => {
    expect(MOODS).toEqual({ positive: "green", negative: "red", neutral: "blue" });
    for ( const k of Object.values(KINDS) ) expect(MOODS[k.mood], k.mood).toBeTruthy();
    for ( const [id, e] of Object.entries(BY_IDENTIFIER) ) if ( e.mood ) expect(MOODS[e.mood], id).toBeTruthy();
  });
  it("chaque signature employée existe, avec une forme connue", () => {
    for ( const [id, e] of Object.entries(BY_IDENTIFIER) ) if ( e.signature ) expect(SIGNATURES[e.signature], id).toBeTruthy();
    for ( const [name, sig] of Object.entries(SIGNATURES) ) {
      expect("blfx" in sig && "tokenmagic" in sig, name).toBe(true);
      for ( const key of Object.keys(sig.tokenmagic ?? {}) ) expect(["fade", "blur", "scale"], `${name}.${key}`).toContain(key);
    }
  });
  it("rendu autonome : des anneaux qui finissent", () => {
    expect(NATIVE.rings).toBeGreaterThan(0);
    expect(NATIVE.duration).toBeGreaterThan(0);
    expect(NATIVE.to).toBeGreaterThan(NATIVE.from);
  });
  it("chaque sorte a ses deux recettes, et une entrée par identifiant n'en invente pas", () => {
    for ( const kind of Object.keys(KINDS) ) {
      expect(BLFX_RECIPES[kind]?.length, kind).toBeGreaterThan(0);
      expect(TOKENMAGIC_RECIPES[kind], kind).toBeTruthy();
    }
    for ( const [id, e] of Object.entries(BY_IDENTIFIER) ) if ( e.kind ) expect(KINDS[e.kind], id).toBeTruthy();
  });
});

describe("filtres Token Magic FX", () => {
  const ALLOWED = new Set(["glow", "xbloom", "shockwave", "adjustment", "blur", "transform"]);
  for ( const [kind, recipe] of Object.entries(TOKENMAGIC_RECIPES) ) {
    it(`${kind} : s'effacent d'eux-mêmes après des boucles finies`, () => {
      const filters = tokenMagicFilters(recipe, 0xff0000, "darsh-animations.test");
      expect(filters.length).toBeGreaterThan(0);
      for ( const f of filters ) {
        expect(ALLOWED.has(f.filterType), f.filterType).toBe(true);
        expect(f.autoDestroy).toBe(true);
        expect(f.filterId).toBe("darsh-animations.test");
        for ( const [key, anim] of Object.entries(f.animated) ) {
          // Sans durée de boucle, Token Magic ne compte jamais ses boucles (fx/Anime.js, cycleCheck) : le filtre resterait.
          expect(anim.loopDuration > 0, `${f.filterType}.${key}`).toBe(true);
          expect(Number.isInteger(anim.loops) && (anim.loops > 0), `${f.filterType}.${key}`).toBe(true);
          expect(anim.syncShift, `${f.filterType}.${key}`).toBe(0);
        }
      }
    });
  }
  it("durée : la plus longue animation (boucles × durée)", () => {
    expect(filtersDuration(tokenMagicFilters(TOKENMAGIC_RECIPES.poison, 0, "x"))).toBe(3 * 1400);
    expect(filtersDuration(tokenMagicFilters(TOKENMAGIC_RECIPES.thrown, 0, "x"))).toBe(1400);
    expect(filtersDuration([])).toBe(0);
  });
  for ( const [name, sig] of Object.entries(SIGNATURES) ) {
    it(`signature ${name} : des filtres qui s'effacent`, () => {
      const filters = tokenMagicFilters(TOKENMAGIC_RECIPES.potion, 0, "x", sig.tokenmagic);
      expect(filters.length).toBe(1 + Object.keys(sig.tokenmagic ?? {}).length);
      for ( const f of filters ) {
        expect(ALLOWED.has(f.filterType), f.filterType).toBe(true);
        expect(f.autoDestroy).toBe(true);
        for ( const anim of Object.values(f.animated) ) {
          expect(anim.loopDuration > 0 && anim.loops > 0 && anim.syncShift === 0).toBe(true);
        }
      }
    });
  }
  it("la lueur prend la couleur donnée", () => {
    expect(tokenMagicFilters(TOKENMAGIC_RECIPES.heal, COLORS.red, "x").find(f => f.filterType === "glow").color).toBe(COLORS.red);
  });
});

const dir = path.resolve(import.meta.dirname, "../prive/docs");
const catalogue = fs.existsSync(`${dir}/catalogue-blfx.json`)
  ? JSON.parse(fs.readFileSync(`${dir}/catalogue-blfx.json`, "utf8")).map(c => c.name) : null;
const inCatalogue = name => catalogue.includes(name) || catalogue.some(n => n.startsWith(`${name}.`));
const autorec = fs.existsSync(`${dir}/blfx-autorec.json`) ? JSON.parse(fs.readFileSync(`${dir}/blfx-autorec.json`, "utf8")) : null;

describe.skipIf(!catalogue)("noms BLFX au catalogue (prive/docs)", () => {
  const colors = [...new Set([...Object.values(KINDS).map(k => k.color), ...Object.values(BY_IDENTIFIER).map(e => e.color).filter(Boolean)])];
  const damages = [...new Set(Object.values(BY_IDENTIFIER).map(e => e.damage).filter(Boolean))];
  for ( const [kind, parts] of Object.entries(BLFX_RECIPES) ) {
    it(kind, () => {
      for ( const part of parts ) {
        for ( const key of ["throw", "splash", "sound"] ) if ( part[key] ) expect(inCatalogue(part[key]), part[key]).toBe(true);
        if ( part.animation ) for ( const color of colors ) {
          const name = fill(part.animation, { color });
          expect(inCatalogue(name), name).toBe(true);
        }
      }
    });
  }
  it("signatures", () => {
    for ( const sig of Object.values(SIGNATURES) ) if ( sig.blfx ) expect(inCatalogue(sig.blfx.animation), sig.blfx.animation).toBe(true);
  });
  it("impacts des flasques", () => {
    for ( const damage of damages ) expect(inCatalogue(fill(IMPACT, { damage })), damage).toBe(true);
  });
});

describe.skipIf(!autorec)("ce que BLFX joue déjà (prive/docs/blfx-autorec.json)", () => {
  it("BLFX_BUILTIN = la section consumable de son Auto-Rec intégrée", () => {
    expect([...BLFX_BUILTIN].sort()).toEqual(Object.keys(autorec.consumable).sort());
  });
});

// Les potions relevées dans les compendiums du SRD, du Manuel des joueurs et du Guide du maître (2026-10-13) : chacune a son entrée,
// pour qu'aucune ne tombe sur la couleur par défaut sans l'avoir voulu (« poison-basic » : la sorte générique « poison » suffit).
const SURVEYED_POTIONS = ["acid","alchemists-fire","antitoxin","cloud-potion-of-giant-strength","elixir-of-health","fire-potion-of-giant-strength","frost-potion-of-giant-strength","greater-potion-of-healing","hill-potion-of-giant-strength","holy-water","keoghtoms-ointment","oil","oil-of-etherealness","oil-of-sharpness","oil-of-slipperiness","philter-of-love","poison-basic","potion-of-animal-friendship","potion-of-clairvoyance","potion-of-climbing","potion-of-comprehension","potion-of-diminution","potion-of-fire-breath","potion-of-flying","potion-of-gaseous-form","potion-of-giant-strength","potion-of-greater-invisibility","potion-of-growth","potion-of-healing","potion-of-heroism","potion-of-invisibility","potion-of-invulnerability","potion-of-longevity","potion-of-mind-reading","potion-of-poison","potion-of-pugilism","potion-of-resistance","potion-of-speed","potion-of-vitality","potion-of-water-breathing","stone-potion-of-giant-strength","storm-potion-of-giant-strength","superior-potion-of-healing","supreme-potion-of-healing","truth-serum"];

describe("toutes les potions relevées", () => {
  it.each(SURVEYED_POTIONS.filter(id => id !== "poison-basic"))("%s a son entrée", id => expect(BY_IDENTIFIER[id]).toBeTruthy());
});
