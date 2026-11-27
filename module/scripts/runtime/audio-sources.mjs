import { MODULE_ID } from "./shared.mjs";

const order = ["blfx", "psfx", "das", "foundry"];
const prefix = "DARSHANIM.Audio";
export const audioKeys = ["audioEnabled", "audioOrder", ...order.map(id => "audio_" + id)];
const setting = key => game.settings.get(MODULE_ID, key);

export function registerAudioSettings() {
  for (const key of audioKeys) {
    const priority = key === "audioOrder";
    game.settings.register(MODULE_ID, key, {
      name: prefix + "." + key, hint: priority ? prefix + ".orderHint" : "",
      scope: "world", config: key === "audioEnabled", type: priority ? String : Boolean,
      default: priority ? order.join(", ") : true
    });
  }
}

export function audioAllowed(provider) {
  return setting("audioEnabled") !== false && setting("audio_" + provider) !== false;
}

export function audioProvider(name) {
  if (name?.startsWith("blfx.")) return "blfx";
  if (name?.startsWith("sounds/")) return "foundry";
  return "das";
}

export function audioSources() {
  const configured = (setting("audioOrder") ?? "").toLowerCase().split(/[\s,>]+/);
  return { order: [...new Set([...configured.filter(id => order.includes(id)), ...order])],
    off: order.filter(id => setting("audio_" + id) === false) };
}

export const defaultAudioSources = () => ({ order: [...order], off: [] });

export async function saveAudioSources(value) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "audioOrder", value.order.join(", "));
  for (const id of order) await game.settings.set(MODULE_ID, "audio_" + id, !value.off.includes(id));
}

export function selectAudio(candidates, available) {
  const priority = audioSources().order;
  for (const provider of priority) {
    const name = candidates[provider];
    if (name && audioAllowed(provider) && available(name)) return name;
  }
  return null;
}
