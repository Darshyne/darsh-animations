/**
 * Le rendu des attaques, sorts et soins à côté de celui des consommables (runtime/strikes.mjs, runtime/consumables.mjs), sur un
 * Foundry, un Sequencer et un DAS · Core simulés, chez le MJ actif : une même utilisation ne se joue qu'une fois.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ENGINE = "dnd5e-combat";

/** Les séquences jouées : pour chacune, les fichiers de ses effets et de ses sons. */
let plays;
let hooks;
let scene;
let documents;

/** Une séquence de Sequencer : toute méthode se chaîne ; `play` note les fichiers demandés. */
class Sequence {
  #files = [];
  #section() {
    const section = new Proxy({}, { get: (_, key) => (...args) => {
      if ( key === "file" ) this.#files.push(args[0]);
      return section;
    } });
    return section;
  }
  effect() { return this.#section(); }
  sound() { return this.#section(); }
  play() { plays.push([...this.#files]); }
}

/** Appelle tous les gestionnaires d'un hook, puis laisse finir ceux qui attendent. */
async function call(name, ...args) {
  for ( const fn of hooks[name] ?? [] ) fn(...args);
  await new Promise(resolve => setTimeout(resolve, 0));
}

/** Une activité de soin sur un objet de ce type, portée par l'acteur du token de la scène. */
function healing(type, system) {
  const activity = { type: "heal", name: "", uuid: `Activity.${type}`, healing: { types: ["healing"] },
    target: { affects: { type: "creature" }, template: { type: "" } } };
  activity.item = { documentName: "Item", type, name: system.identifier, actor: {}, flags: {},
    system: { ...system, activities: [activity], properties: [] } };
  documents[activity.uuid] = activity;
  return activity;
}

/** La carte d'utilisation de l'activité, par le token de la scène. */
function usageOf(activity) {
  const message = { id: "usage1", type: "usage", isAuthor: true, speaker: { scene: scene.id, token: "t1" }, system: { targets: [] },
    rolls: [], getAssociatedItem: () => activity.item, getAssociatedActivity: () => activity };
  globalThis.game.messages.set(message.id, message);
  return message;
}

/** La résolution d'un soin sans jet d'attaque ni sauvegarde que DAS · Core ouvre pour cette carte, sur celui qu'on soigne. */
const resolutionOf = (activity, step) => ({ id: "r1", origin: "usage1", carrier: "usage1", activity: activity.uuid, step,
  plan: { attack: null, save: null, darts: 0 }, targets: [{ token: "Token.t1", unaffected: false }] });

/** Une utilisation complète avec DAS · Core : la carte, l'ouverture de la résolution, puis le soin appliqué. */
async function use(activity) {
  await call("createChatMessage", usageOf(activity));
  await call(`${ENGINE}.resolution`, resolutionOf(activity, "awaitingDamage"), { type: "opened" });
  await call(`${ENGINE}.resolution`, resolutionOf(activity, "done"), { type: "applied" });
}

beforeEach(async () => {
  vi.resetModules();
  plays = [];
  hooks = {};
  documents = {};
  scene = { id: "scene1", tokens: new Map() };
  const token = { name: "Buveur", scene, document: { id: "t1", width: 1, parent: scene } };
  scene.tokens.set("t1", { object: token });
  documents["Token.t1"] = { object: token };
  globalThis.Hooks = { on: (name, fn) => { (hooks[name] ??= []).push(fn); }, once: () => {} };
  globalThis.game = {
    users: { activeGM: { isSelf: true } },
    modules: new Map([["JB2A_DnD5e", { active: true }], [ENGINE, { active: true, api: {} }]]),
    messages: new Map(),
    settings: { register: () => {}, get: () => { throw new Error("not registered"); } }
  };
  globalThis.canvas = { scene };
  globalThis.fromUuid = async uuid => documents[uuid] ?? null;
  globalThis.fromUuidSync = uuid => documents[uuid] ?? null;
  globalThis.Sequence = Sequence;
  globalThis.Sequencer = { Database: { entryExists: () => true } };
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { registerStrikes } = await import("../module/scripts/runtime/strikes.mjs");
  const { registerConsumables } = await import("../module/scripts/runtime/consumables.mjs");
  registerStrikes();
  registerConsumables();
});

describe("avec DAS · Core : une utilisation, un seul rendu", () => {
  it("une potion de soin bue : le rendu des consommables seul, pas d'incantation ni de second soin (issue #7)", async () => {
    await use(healing("consumable", { identifier: "potion-of-healing", type: { value: "potion" } }));
    expect(plays).toHaveLength(1);
    expect(plays.flat().filter(file => file.startsWith("jb2a.cast_generic"))).toEqual([]);
    expect(plays.flat().filter(file => file.startsWith("jb2a.healing_generic"))).toHaveLength(1);
  });

  it("un sort de soin : l'incantation à l'ouverture, puis le soin une fois appliqué", async () => {
    await use(healing("spell", { identifier: "soin-maison", school: "abj" }));
    expect(plays).toHaveLength(2);
    expect(plays[0].some(file => file.startsWith("jb2a.cast_generic"))).toBe(true);
    expect(plays[1].some(file => file.startsWith("jb2a.healing_generic"))).toBe(true);
  });
});
