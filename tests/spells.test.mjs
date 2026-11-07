import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as S from "../module/scripts/data/strikes.mjs";
import { chooseAction, expand, resolutionMoment, spellTimeline } from "../module/scripts/core/strikes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = file => JSON.parse(fs.readFileSync(file, "utf8")).entries;
const free = new Set([...read(path.join(root, "docs/catalogue-jb2a.json")), ...read(path.join(root, "docs/catalogue-psfx.json"))]
  .map(e => e.name));
const premiumFile = path.join(root, "prive/docs/catalogue-jb2a-premium.json");
const premium = fs.existsSync(premiumFile) ? new Set(read(premiumFile).map(e => e.name)) : null;
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
const COLORS = [...new Set(["white", ...Object.values(S.DAMAGE_COLORS), "dark_green"])];

/** Les listes de candidats des sorts : exceptions, projectiles par type, incantations, soin. */
function lists() {
  const out = [];
  for ( const [key, spell] of Object.entries(S.SPELLS) ) {
    out.push([`${key}.animation`, spell.animation]);
    if ( spell.cast ) out.push([`${key}.cast`, spell.cast]);
  }
  for ( const [type, list] of Object.entries(S.SPELL_PROJECTILES) ) out.push([`projectile.${type}`, list]);
  for ( const [type, cast] of Object.entries(S.SPELL_CASTS) ) out.push([`cast.${type}`, cast.animation]);
  out.push(["heal", S.HEAL.animation]);
  return out;
}

describe("sorts : recettes", () => {
  it("chaque liste a un nom du JB2A gratuit, quelle que soit la couleur", () => {
    const bad = [];
    for ( const [key, list] of lists() ) {
      for ( const color of COLORS ) if ( !expand(list, { color }).some(existsIn(free)) ) bad.push(`${key} (${color})`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
  it("chaque son existe dans PSFX", () => {
    const sounds = [...Object.values(S.SPELL_SOUNDS), ...Object.values(S.SPELLS).flatMap(s => [s.sound, s.castSound]).filter(Boolean),
      ...Object.values(S.SPELL_CASTS).map(c => c.sound), S.HEAL.sound];
    expect(sounds.filter(n => !existsIn(free)(n))).toEqual([]);
  });
  it.skipIf(!premium)("chaque nom absent du gratuit existe dans le Premium", () => {
    const bad = [];
    for ( const [key, list] of lists() ) {
      for ( const name of list ) {
        const variants = COLORS.flatMap(color => expand([name], { color }));
        if ( !variants.some(existsIn(free)) && !variants.some(existsIn(premium)) ) bad.push(`${key}: ${name}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

const spell = (extra) => ({ itemType: "spell", classification: "spell", damageTypes: [], keys: [], ...extra });

describe("sorts : choix", () => {
  it("Trait de feu : projectile du sort, son du sort, impact de feu ; pas d'incantation au sol", () => {
    const c = chooseAction(spell({ keys: ["firebolt"], activityType: "attack", attackType: "ranged", damageTypes: ["fire"] }));
    expect(c.action).toBe("spell");
    expect(c.kind).toBe("shot");
    expect(c.animation.at(-1)).toBe("jb2a.fire_bolt.white");
    expect(c.animation[0]).toBe("jb2a.fire_bolt.orange");
    expect(c.cast).toEqual([]);
    expect(c.sound).toBe("psfx.cantrips.fire-bolt.v1");
    expect(c.impact.animation).toEqual(["jb2a.impact.fire.01.orange"]);
  });
  it("sort à jet d'attaque sans exception (Orbe chromatique, acide) : projectile du type de dégâts", () => {
    const c = chooseAction(spell({ keys: ["chromaticorb"], activityType: "attack", attackType: "ranged", damageTypes: ["acid"] }));
    expect(c.family).toBe("shot:acid");
    expect(c.animation[0]).toBe("jb2a.ranged.04.projectile.01.green");
  });
  it("sort de contact : sur la cible, incantation au lanceur", () => {
    const c = chooseAction(spell({ keys: ["inflictwounds"], activityType: "attack", attackType: "melee", damageTypes: ["necrotic"] }));
    expect(c.kind).toBe("onTarget");
    expect(c.cast[0]).toBe("jb2a.cast_generic.dark.01.red");
  });
  it("sort à sauvegarde : incantation, impact du type ; sans dégâts, un impact neutre", () => {
    const sacred = chooseAction(spell({ keys: ["sacredflame"], activityType: "save", damageTypes: ["radiant"] }));
    expect(sacred.family).toBe("spell:sacredflame");
    expect(sacred.cast[0]).toBe("jb2a.sacred_flame.source.yellow");
    expect(sacred.impact).toBeNull();
    const hold = chooseAction(spell({ keys: ["holdperson"], activityType: "save" }));
    expect(hold.cast).toEqual(["jb2a.cast_generic.02.blue"]);
    expect(hold.impact.animation).toEqual(["jb2a.impact.011.blue"]);
  });
  it("soins : Soins des blessures par identifiant, un soin quelconque en lueur jaune", () => {
    expect(chooseAction(spell({ keys: ["curewounds"], activityType: "heal" })).animation.at(-1)).toBe("jb2a.cure_wounds.400px.white");
    const potion = chooseAction({ itemType: "feat", keys: ["secondwind"], activityType: "heal" });
    expect(potion.kind).toBe("heal");
    expect(potion.animation[0]).toBe("jb2a.healing_generic.400px.yellow");
  });
  it("une attaque d'arme reste au lot 1", () => {
    expect(chooseAction({ itemType: "weapon", baseItem: "longsword", activityType: "attack", attackType: "melee",
      classification: "weapon", damageTypes: ["slashing"] }).action).toBe("weapon");
  });
});

describe("sorts : déroulé et moment", () => {
  it("projectiles multiples, sauvegarde réussie", () => {
    const t = spellTimeline([{ token: "a", hit: null, times: 3 }, { token: "b", hit: null, save: { success: true } }]);
    expect(t.map(s => s.token)).toEqual(["a", "a", "a", "b"]);
    expect(t[1].delay - t[0].delay).toBe(S.DART_GAP);
    expect(t[3].saved).toBe(true);
  });
  it("DAS · Core : attaque au verdict, sauvegarde quand toutes sont jetées, soin au jet", () => {
    const attack = { plan: { attack: true }, attack: { messageId: "m" }, step: "awaitingRolls", targets: [] };
    expect(resolutionMoment(attack, { type: "attackRolled" })).toBe("attack");
    expect(resolutionMoment({ ...attack, step: "awaitingReaction" }, { type: "attackRolled" })).toBeNull();
    const save = { plan: { save: {} }, step: "awaitingRolls", targets: [{ save: { success: false } }, { save: null }] };
    expect(resolutionMoment(save, { type: "saveRolled" })).toBeNull();
    expect(resolutionMoment({ ...save, targets: [{ save: { success: false } }, { save: { success: true } }] }, { type: "saveRolled" }))
      .toBe("effect");
    const heal = { plan: { heal: true }, step: "awaitingRolls", targets: [{ save: null }] };
    expect(resolutionMoment(heal, { type: "opened" })).toBeNull();
    expect(resolutionMoment(heal, { type: "damageRolled" })).toBe("effect");
    expect(resolutionMoment({ plan: { darts: 3 }, allocated: false, targets: [{}] }, { type: "damageRolled" })).toBeNull();
  });
});
