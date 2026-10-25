/**
 * Choisir les animations d'une serrure de porte (data/doors.mjs) : pur, testable hors du jeu.
 */

/** Le moment d'un hook du moteur : `noise` d'un forçage → « force » ; `doorUnlocked` → « burst » (forcée) ou « unlock ». */
export function doorMoment(hook, { method=null, cause=null }={}) {
  if ( hook === "noise" ) return (cause === "forceDoor") ? "force" : null;
  if ( hook === "doorUnlocked" ) return (method === "force") ? "burst" : (["pick", "key"].includes(method) ? "unlock" : null);
  return null;
}

const PREFIXES = Object.freeze({
  blfx: { animation: "blfx.", sound: "blfx.sound." },
  jb2a: { animation: "jb2a.", sound: "psfx." }
});

/** Les erreurs de forme d'une partie (vide si elle est bonne). */
export function checkDoorPart(part, label, library="blfx") {
  const lib = PREFIXES[library] ?? PREFIXES.blfx;
  const errors = [];
  if ( (typeof part?.animation !== "string") || !part.animation.startsWith(lib.animation) ) errors.push(`${label}: ${library} animation expected`);
  if ( (part?.sound !== undefined) && !String(part.sound).startsWith(lib.sound) ) errors.push(`${label}: ${library} sound expected`);
  for ( const key of ["scale", "delay"] ) {
    if ( (part?.[key] !== undefined) && !(Number.isFinite(part[key]) && (part[key] >= 0)) ) errors.push(`${label}: invalid ${key}`);
  }
  return errors;
}
