import { describe, expect, it } from "vitest";
import { DOMAINS, SOURCES, defaultSources, detectionNotes, migrateSources, moveSource, normalizeSources, pickSource, placeSource,
  ranksBefore, sourceChain, sourceTable, yieldsToBlfx } from "../module/scripts/core/sources.mjs";

const ALL = { blfx: true, aa: true, jb2a: true, tokenmagic: true };
const NONE = {};

describe("sources : valeur", () => {
  it("défaut : BLFX, AA, JB2A, Token Magic, rendu intégré ; tout allumé", () => {
    const v = defaultSources();
    expect(v.order).toEqual(["blfx", "aa", "jb2a", "tokenmagic", "native"]);
    expect(v.off).toEqual([]);
    expect(Object.values(v.domains).every(Boolean)).toBe(true);
  });

  it("normalise : inconnus et doublons retirés, sources oubliées remises à leur place", () => {
    const v = normalizeSources({ order: ["jb2a", "zzz", "jb2a", "blfx"], off: ["tokenmagic", "bad"], domains: { traps: false, nope: false } });
    // Une source oubliée suit sa plus proche devancière de l'ordre par défaut (Token Magic suit JB2A, AA suit BLFX) ; BLFX en tête.
    expect(v.order).toEqual(["blfx", "jb2a", "tokenmagic", "native", "aa"]);
    expect(new Set(v.order)).toEqual(new Set(SOURCES));
    expect(v.off).toEqual(["tokenmagic"]);
    expect(v.domains.traps).toBe(false);
    expect(v.domains.nope).toBeUndefined();
    expect(normalizeSources(null)).toEqual(defaultSources());
  });

  it("monter, descendre, glisser", () => {
    let v = moveSource(defaultSources(), "jb2a", -1);
    expect(v.order.slice(0, 3)).toEqual(["blfx", "jb2a", "aa"]);
    // BLFX reste en tête : rien ne passe avant lui, il ne descend pas.
    expect(moveSource(v, "jb2a", -1).order[0]).toBe("blfx");
    expect(moveSource(v, "blfx", 1).order[0]).toBe("blfx");
    v = placeSource(defaultSources(), "native", "blfx");
    expect(v.order.slice(0, 2)).toEqual(["blfx", "native"]);
    expect(placeSource(defaultSources(), "blfx", null).order[0]).toBe("blfx");
    v = placeSource(defaultSources(), "native", "aa");
    expect(v.order).toEqual(["blfx", "native", "aa", "jb2a", "tokenmagic"]);
  });
});

describe("sources : anciens réglages", () => {
  it("rien de changé : le défaut", () => {
    expect(migrateSources({})).toEqual(defaultSources());
  });
  it("« à partir de Token Magic » coupe BLFX et JB2A", () => {
    const v = migrateSources({ renderer: "tokenmagic" });
    expect(v.off).toEqual(["blfx", "jb2a"]);
    expect(pickSource("consumables", v, ALL)).toBe("tokenmagic");
  });
  it("« aucun » coupe les domaines qu'il réglait, pas les attaques", () => {
    const v = migrateSources({ renderer: "none" });
    expect(v.domains.consumables).toBe(false);
    expect(v.domains.walls).toBe(false);
    expect(v.domains.strikes).toBe(true);
  });
  it("attaques et états éteints ; « AA devant BLFX » pas repris, BLFX reste en tête", () => {
    const v = migrateSources({ strikes: false, conditions: false, aaYieldToBlfx: false, conditionsWithBlfx: true });
    expect(v.domains.strikes).toBe(false);
    expect(v.domains.conditions).toBe(false);
    expect(ranksBefore(v, "blfx", "aa")).toBe(true);
  });
});

describe("sources : choix par domaine", () => {
  it("le premier installé, coché et capable", () => {
    const v = defaultSources();
    expect(pickSource("consumables", v, ALL)).toBe("blfx");
    expect(pickSource("consumables", v, { jb2a: true })).toBe("jb2a");
    expect(pickSource("consumables", v, NONE)).toBe("native");
    expect(pickSource("traps", v, { tokenmagic: true })).toBe("tokenmagic");
    expect(pickSource("strikes", v, ALL)).toBe("blfx");
    expect(pickSource("strikes", v, NONE)).toBe(null);
    expect(pickSource("walls", v, { tokenmagic: true })).toBe(null);
  });
  it("AA n'est jamais la source d'un domaine, seulement dans la chaîne", () => {
    const v = placeSource(normalizeSources({ off: ["blfx"] }), "aa", "jb2a");
    expect(sourceChain("strikes", v, ALL)[0]).toBe("aa");
    expect(pickSource("strikes", v, ALL)).toBe("jb2a");
  });
  it("une source décochée est sautée ; un domaine coupé ne rend rien", () => {
    const v = normalizeSources({ ...defaultSources(), off: ["blfx"] });
    expect(pickSource("consumables", v, ALL)).toBe("jb2a");
    const w = normalizeSources({ ...defaultSources(), domains: { doors: false } });
    expect(sourceChain("doors", w, ALL)).toEqual([]);
  });
  it("JB2A avant Token Magic, ou l'inverse", () => {
    const v = placeSource(normalizeSources({ off: ["blfx"] }), "tokenmagic", "jb2a");
    expect(pickSource("consumables", v, ALL)).toBe("tokenmagic");
    expect(pickSource("walls", v, ALL)).toBe("jb2a");
  });
});

describe("sources : BLFX de lui-même", () => {
  it("JB2A après BLFX se tait devant lui là où BLFX joue de lui-même", () => {
    const v = defaultSources();
    expect(yieldsToBlfx("strikes", v, "jb2a")).toBe(true);
    expect(yieldsToBlfx("summons", v, "jb2a")).toBe(true);
    // Les consommables, BLFX ne les joue que si ce module le lui demande.
    expect(yieldsToBlfx("consumables", v, "jb2a")).toBe(false);
  });
  it("BLFX décoché : JB2A prend le domaine, mais se tait encore devant l'Auto-Rec de BLFX (signalé)", () => {
    const v = normalizeSources({ off: ["blfx"] });
    expect(yieldsToBlfx("strikes", v, "jb2a")).toBe(true);
    const row = sourceTable(v, ALL).find(r => r.domain === "strikes");
    expect(row.source).toBe("jb2a");
    expect(row.notes).toContain("blfxFirst");
  });
  it("BLFX décoché ne change pas sa place pour son Auto-Rec", () => {
    const v = normalizeSources({ ...defaultSources(), off: ["blfx"] });
    expect(yieldsToBlfx("strikes", v, "jb2a")).toBe(true);
  });
});

describe("sources : tableau", () => {
  it("une ligne par domaine, avec ses sources possibles", () => {
    const rows = sourceTable(defaultSources(), ALL);
    expect(rows.map(r => r.domain)).toEqual(Object.keys(DOMAINS));
    expect(rows.find(r => r.domain === "traps").source).toBe("blfx");
  });
  it("rien d'installé : « aucune » là où le rendu intégré ne sait pas faire", () => {
    const rows = sourceTable(defaultSources(), NONE);
    expect(rows.find(r => r.domain === "strikes").notes).toContain("nothing");
    expect(rows.find(r => r.domain === "consumables").source).toBe("native");
  });
  it("AA placé avant la source : signalé", () => {
    const v = placeSource(normalizeSources({ off: ["blfx"] }), "aa", "jb2a");
    expect(sourceTable(v, ALL).find(r => r.domain === "strikes").notes).toContain("aaFirst");
  });
  it("domaine coupé", () => {
    const row = sourceTable(normalizeSources({ domains: { areas: false } }), ALL).find(r => r.domain === "areas");
    expect(row).toMatchObject({ on: false, source: null });
  });
});

describe("sources : détection", () => {
  const mod = (active=true) => ({ installed: true, active });
  it("Sequencer manquant, deux JB2A, pas de PSFX, case BLFX", () => {
    const keys = detectionNotes({ modules: { "JB2A_DnD5e": mod(), "jb2a_patreon": mod(), "boss-loot-assets-premium": mod() },
      sequencer: false, blfxCustomUpdates: false }).map(n => n.key);
    expect(keys).toEqual(expect.arrayContaining(["NoSequencer", "BothJb2a", "NoPsfx", "BlfxUpdates"]));
  });
  it("rien d'installé : seul le rendu intégré", () => {
    expect(detectionNotes({}).map(n => n.key)).toEqual(["OnlyNative"]);
  });
  it("installé mais pas activé", () => {
    const notes = detectionNotes({ modules: { tokenmagic: mod(false), "JB2A_DnD5e": mod(), psfx: mod() }, sequencer: true });
    expect(notes).toEqual([{ level: "info", key: "InstalledOff", data: { id: "tokenmagic" } }]);
  });
});
