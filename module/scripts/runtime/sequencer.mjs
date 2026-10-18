/**
 * Petits outils Sequencer partagés par les rendus « BLFX » et « JB2A + PSFX » (consommables, pièges, murs, zones) : tous deux jouent
 * des noms de la base de Sequencer, avec les mêmes options.
 */

/** Sequencer connaît-il ce nom (entrée ou groupe) ? */
export const known = name => !!(name && globalThis.Sequencer?.Database?.entryExists?.(name));

/**
 * Ajoute une animation à la séquence, sur ce token (ou ce point). Options : `scale` (fois la taille du token), `delay`, `duration`
 * (pour une boucle, puis fondu), `below` (sous les tokens), `tint` (#rrggbb, reteinte par Sequencer), `attach` (suit le token).
 */
export function addEffect(sequence, name, place, { scale=1.5, delay=0, duration=0, below=false, tint=null, attach=false }={}) {
  const effect = sequence.effect().file(name);
  if ( attach ) effect.attachTo(place);
  else effect.atLocation(place);
  effect.scaleToObject(scale);
  if ( delay ) effect.delay(delay);
  if ( duration ) effect.duration(duration).fadeOut(500);
  if ( below ) effect.belowTokens();
  if ( tint ) effect.tint(tint);
  return effect;
}

/** Ajoute un son s'il est connu (sans PSFX, les sons JB2A se taisent). Rend vrai s'il a été ajouté. */
export function addSound(sequence, name, { delay=0, volume=null }={}) {
  if ( !known(name) ) return false;
  const sound = sequence.sound().file(name);
  if ( delay ) sound.delay(delay);
  if ( volume !== null ) sound.volume(volume);
  return true;
}

/** Le premier fichier d'une entrée de la base (un son d'ambiance du cœur a besoin d'un chemin). */
export function fileOf(name) {
  const found = globalThis.Sequencer?.Database?.getEntry?.(name);
  const pick = Array.isArray(found) ? found[0] : found;
  return [pick?.file, pick?.file?.[0], pick].find(f => typeof f === "string") ?? null;
}
