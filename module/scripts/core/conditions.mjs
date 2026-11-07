/**
 * SPEC §21, lot 3 bis : quels états animer sur un token, et quelles boucles poser ou arrêter. Sans Foundry.
 */
import { CONDITIONS, CONDITION_PREFIX } from "../data/conditions.mjs";

/** Le nom Sequencer de la boucle d'un état. */
export const conditionName = status => `${CONDITION_PREFIX}${status}`;

/**
 * Les états à animer pour ces statuts : `[{ status, animation[], scale }]`, dans l'ordre de la table. Avec BLFX actif, sans le réglage
 * `withBlfx`, les états que BLFX joue lui-même sont laissés.
 * @param {Iterable<string>} statuses
 * @param {{ blfx?: boolean, withBlfx?: boolean }} [options]
 */
export function wantedConditions(statuses, { blfx=false, withBlfx=false }={}) {
  const set = new Set(statuses ?? []);
  return Object.entries(CONDITIONS)
    .filter(([status, c]) => set.has(status) && !(blfx && c.blfx && !withBlfx))
    .map(([status, c]) => ({ status, animation: c.animation, scale: c.scale ?? 1.5 }));
}

/**
 * Ce qu'il faut changer : `{ add: [status], remove: [status] }`. `playing` : les états dont la boucle tourne déjà sur le token.
 * @param {{ status: string }[]} wanted
 * @param {Iterable<string>} playing
 */
export function conditionDiff(wanted, playing) {
  const want = new Set(wanted.map(w => w.status));
  const have = new Set(playing ?? []);
  return { add: [...want].filter(s => !have.has(s)), remove: [...have].filter(s => !want.has(s)) };
}
