import { known, addSound } from "./sequencer.mjs";

const aliases = {
  "tashas-hideous-laughter": "hideous-laughter",
  "shield": "shield-spell"
};
const cache = new Map();

Hooks.on("sequencer.ready", () => cache.clear());

export function spellSound(item, voice = "", treatment = "") {
  if (item?.type !== "spell") return null;
  const id = item.system?.identifier;
  const level = item.system?.level;
  if (!id || !Number.isInteger(level) || level < 0 || level > 9) return null;
  const group = ["cantrips", "1st-level-spells", "2nd-level-spells", "3rd-level-spells"][level]
    ?? `${level}th-level-spells`;
  const branch = `psfx.${group}.${aliases[id] ?? id}${voice ? "." + voice : ""}`;
  return soundVariant(branch, treatment);
}

export function soundVariant(branch, treatment = "") {
  if (!known(branch)) return null;
  if (!cache.has(branch)) {
    const paths = Sequencer.Database.getPathsUnder(branch, { fullyQualified: true });
    cache.set(branch, paths.filter(path => known(path)));
  }
  const available = cache.get(branch);
  const matching = treatment ? available.filter(path => path.split(".").includes(treatment)) : available;
  const paths = matching.length ? matching : available;
  return paths[Math.floor(Math.random() * paths.length)] ?? null;
}

/** Resolve only dedicated, semantically equivalent sounds. */
export function featureSound(item) {
  if (!["feat", "class", "subclass"].includes(item?.type)) return null;
  const id = item.system?.identifier;
  return id ? soundVariant("psfx.class-features." + id) : null;
}

export function instrumentSound(item, activity) {
  if (!["tool", "equipment", "loot"].includes(item?.type)
    || !["check", "utility"].includes(activity?.type)) return null;
  const instrument = item.system?.type?.baseItem || item.system?.identifier;
  if (!["lute", "violin", "flute", "bagpipes"].includes(instrument)) return null;
  return soundVariant("psfx.musical-instruments." + instrument);
}

export function meleeWeaponSound(item, choice) {
  if (item?.type !== "weapon" || choice.kind !== "swing") return null;
  const base = item.system?.type?.baseItem || item.system?.identifier;
  const family = ["longsword", "shortsword", "greatsword", "rapier", "scimitar"].includes(base) ? "sword" : base;
  return ["sword", "spear"].includes(family) ? soundVariant("psfx.weapon-attacks." + family) : null;
}

export function laughterPreset(sequence, item, source, targets, { skipCast }) {
  if (!["hideous-laughter", "tashas-hideous-laughter"].includes(item.system?.identifier)) return null;
  const cast = "jb2a.on_token_cast.initiate.001.instant.combined";
  const strands = "jb2a.energy_strands.range.standard";
  const curse = "jb2a.condition.curse.01.006.purple";
  const wave = "jb2a.soundwave.02";
  const sounds = ["masc", "fem", "fem-group"].map(voice => spellSound(item, voice, "dry"));
  if (![cast, strands, curse, wave].every(known) || sounds.some(sound => !sound)) return null;
  if (!skipCast) {
    addSound(sequence, "psfx.casting.on-token");
    sequence.effect().file(cast).atLocation(source).scale(0.6).belowTokens().waitUntilFinished(-3500);
  }
  for (const { token, save } of targets) {
    sequence.effect().file(strands).atLocation(source).stretchTo(token);
    if (save?.success !== true) {
      sounds.forEach((sound, index) => {
        const laugh = sequence.sound().file(sound).atLocation(source).toLocation(token)
          .baseEffect({ type: "reverb", intensity: 100 })
          .timeRange(0, 3500 - index * 500).fadeOutAudio(1000)
          .volume(0.8).delay(index * 500).globalSound();
        if (index === 1) laugh.panSound(true, { innerEaseDistance: 1, outerEaseDistance: 1000 });
        if (index === 2) laugh.panSound(true, { innerEaseDistance: 999, outerEaseDistance: 1000 });
      });
      addSound(sequence, "psfx.ranged-magic.generic.energy-strands");
      addSound(sequence, "psfx.conditions.boon.005");
    }
    for (const effect of [curse, wave]) {
      sequence.effect().file(effect).atLocation(token).scale(0.6).belowTokens();
    }
  }
  return { played: true, sounds };
}
