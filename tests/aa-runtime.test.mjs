/**
 * Automated Animations devant ce que ce module joue lui-même (runtime/aa.mjs, hook `AutomatedAnimations-WorkflowStart`), sur un Foundry,
 * un Sequencer et un AA simulés : une entrée livrée d'AA se tait dès que ce module anime l'utilisation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const AA = "autoanimations";

let hooks;
let modules;
/** Les menus de l'Auto-Rec d'AA (réglages `aaAutorec-<menu>`). */
let autorec;

/** Un sort d'invocation et son activité, comme AA les reçoit. */
function summonSpell(name, identifier) {
  const activity = { type: "summon", name: "" };
  const item = { documentName: "Item", type: "spell", name, flags: {}, system: { identifier, activities: [activity] } };
  return { item, activity };
}

/** Ce qu'AA annonce avant de jouer : rend les données, que le module a pu arrêter (`stopWorkflow`). */
function workflowStart(use) {
  const data = { ...use };
  hooks["AutomatedAnimations-WorkflowStart"](data, { label: "entry" });
  return data;
}

beforeEach(async () => {
  vi.resetModules();
  hooks = {};
  autorec = { melee: [{ label: "Sword", menu: "melee", metaData: { default: true } }] };
  modules = new Map([[AA, { active: true }], ["JB2A_DnD5e", { active: true }]]);
  globalThis.Hooks = { on: (name, fn) => { hooks[name] = fn; }, once: () => {} };
  globalThis.game = {
    modules,
    settings: {
      register: () => {},
      get: (scope, key) => {
        if ( (scope === AA) && key.startsWith("aaAutorec-") ) return autorec[key.slice("aaAutorec-".length)] ?? [];
        if ( (scope === AA) && (key === "disableAutoRec") ) return false;
        throw new Error("not registered");
      }
    }
  };
  globalThis.AutomatedAnimations = {};
  globalThis.Sequence = class {};
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { registerAA } = await import("../module/scripts/runtime/aa.mjs");
  registerAA();
});

describe("Automated Animations et les invocations", () => {
  it("entrée livrée d'AA sur un sort d'invocation : elle se tait, ce module joue l'apparition (issue #8)", () => {
    const data = workflowStart(summonSpell("Mordenkainen's Sword", "mordenkainens-sword"));
    expect(data.stopWorkflow).toBe(true);
  });

  it("sans JB2A : ce module ne joue pas l'apparition, l'entrée livrée d'AA joue", () => {
    modules.delete("JB2A_DnD5e");
    expect(workflowStart(summonSpell("Mordenkainen's Sword", "mordenkainens-sword")).stopWorkflow).toBeUndefined();
  });

  it("une animation personnalisée d'AA (entrée sans la marque des entrées livrées) joue toujours", () => {
    autorec.melee = [{ label: "Sword", menu: "melee" }];
    expect(workflowStart(summonSpell("Mordenkainen's Sword", "mordenkainens-sword")).stopWorkflow).toBeUndefined();
  });
});

describe("l'apparition d'une créature invoquée devant une animation personnalisée d'AA (issue #8)", () => {
  /** Le rendu des invocations seul, avec un Sequencer qui compte ce qui part. */
  async function summons(leftToAa) {
    const played = [];
    const section = { file: () => section, atLocation: () => section, scaleToObject: () => section, delay: () => section,
      belowTokens: () => section, volume: () => section, startTime: () => section };
    globalThis.Sequence = class { effect() { return section; } sound() { return section; } play() { played.push("summon"); } };
    globalThis.Sequencer = { Database: { entryExists: () => true } };
    globalThis.canvas = { scene: { id: "s" } };
    const { registerSummons } = await import("../module/scripts/runtime/summons.mjs");
    registerSummons(leftToAa);
    return { played, fire: activity => hooks["dnd5e.postSummon"](activity, {}, [{ document: { parent: canvas.scene } }]) };
  }
  const { item, activity } = summonSpell("Spiritual Weapon", "spiritual-weapon");
  activity.item = item;

  it("AA jouera le sort avec une animation personnalisée : l'apparition lui est laissée", async () => {
    const asked = [];
    const { played, fire } = await summons((i, a) => { asked.push([i.name, a.type]); return true; });
    fire(activity);
    expect(asked).toEqual([["Spiritual Weapon", "summon"]]);
    expect(played).toEqual([]);
  });

  it("AA ne joue pas : l'apparition part", async () => {
    const { played, fire } = await summons(() => false);
    fire(activity);
    expect(played).toEqual(["summon"]);
  });

  it("sans prédicat (AA absent) : l'apparition part, comme avant", async () => {
    const { played, fire } = await summons(undefined);
    fire(activity);
    expect(played).toEqual(["summon"]);
  });
});
