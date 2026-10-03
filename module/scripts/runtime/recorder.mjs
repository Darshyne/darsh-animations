/**
 * Ce que Sequencer a réellement joué (vérification en jeu, connecteur MCP) : entre `start` et `stop`, les fichiers des effets et des
 * sons créés — crochets `createSequencerEffect` et `createSequencerSound` de Sequencer (dist/sequencer.js, `Hooks.callAll`). Une
 * animation de BLFX dure souvent moins d'une seconde : la liste des effets en cours ne suffit pas à dire qu'elle a eu lieu.
 */

let recording = null;
let hooks = null;

const fileOf = x => {
  const f = x?.data?.file ?? x?.file ?? x?.data?.src ?? null;
  return Array.isArray(f) ? f.join(" | ") : (f ?? null);
};

/**
 * Où un effet se pose (source, cible) : Sequencer garde l'objet lui-même (token, région) ou une position ; on rend l'uuid du
 * document, ou « x,y ».
 */
const placeOf = p => {
  if ( !p ) return null;
  if ( typeof p === "string" ) return p;
  return p.uuid ?? p.document?.uuid ?? (("x" in p) ? `${Math.round(p.x)},${Math.round(p.y)}` : null);
};
const placesOf = x => [x?.data?.source, x?.data?.target].map(placeOf).filter(Boolean);

/** Commence un enregistrement (le précédent est oublié). */
export function startRecording() {
  recording = { effects: [], sounds: [], places: [], started: Date.now() };
  if ( !hooks ) hooks = {
    effect: Hooks.on("createSequencerEffect", effect => { recording?.effects.push(fileOf(effect)); recording?.places.push(...placesOf(effect)); }),
    sound: Hooks.on("createSequencerSound", sound => recording?.sounds.push(fileOf(sound)))
  };
  return { recording: true };
}

/** Arrête l'enregistrement et rend ce qui a été joué. */
export function stopRecording() {
  const out = recording ?? { effects: [], sounds: [], places: [], started: Date.now() };
  recording = null;
  if ( hooks ) {
    Hooks.off("createSequencerEffect", hooks.effect);
    Hooks.off("createSequencerSound", hooks.sound);
    hooks = null;
  }
  return { effects: out.effects, sounds: out.sounds, places: [...new Set(out.places)], ms: Date.now() - out.started };
}
