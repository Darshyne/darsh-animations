/**
 * Bogue signalé le 2026-10-13 : un sort à zone dont on **annule** la pose laissait tourner l'incantation persistante de BLFX sur le
 * lanceur (animation et son, que BLFX n'arrête qu'à la pose). runtime/casting.mjs l'arrête quand aucune zone n'est posée et que le
 * moteur ne vise plus rien.
 *  1. Une incantation nommée comme BLFX la nomme (`Video-<item>-<token>`) sur l'Ensorceleur, puis une utilisation de Mains brûlantes
 *     sans zone posée : l'incantation s'arrête d'elle-même en quelques secondes.
 *  2. Zone posée tout de suite, incantation démarrée **après** (le son retardé de BLFX quand le moteur pose la zone dès l'utilisation :
 *     Éclair, signalé sur le Discord le 2026-11-17) : l'incantation est arrêtée quand même, peu après.
 * Sans BLFX : non applicable.
 */
const MODULE = "darsh-animations";
const pause = ms => new Promise(r => setTimeout(r, ms));
const CAST = "blfx.spell.cast.circles1.energy1.blue";

export default {
  name: "incantation annulée — l'incantation de BLFX s'arrête quand la pose est annulée, ou quand la zone est posée avant elle",

  async run(ctx) {
    const api = async (fn, args={}) => (await ctx.call("call-module-api", { moduleId: MODULE, fn, args, waitMs: 8000 })).result;
    if ( (await api("renderer")) !== "blfx" ) { ctx.log("BLFX inactif : non applicable"); return; }
    const { tokens, sceneId } = await ctx.scene();
    if ( !tokens.some(t => t.name === "Ensorceleur") ) { ctx.log("Ensorceleur absent : non applicable"); return; }
    const sorc = await ctx.token("Ensorceleur");

    // 1. Pose annulée.
    const one = await api("previewCancelledCast", { tokenId: sorc.id, identifier: "burning-hands", animation: CAST });
    ctx.restore(() => api("castingEffects", { name: one.name, end: true }));
    ctx.expect(one.before === 1 && !!one.decided?.watching, `incantation jouée et surveillée (${JSON.stringify(one.decided)})`);
    let left = 1;
    for ( let s = 0; (s < 8) && left; s++ ) { await pause(1000); left = (await api("castingEffects", { name: one.name })).count; }
    ctx.expect(left === 0, "pose annulée : l'incantation s'arrête");

    // 2. Zone posée d'abord, incantation démarrée après : arrêtée quand même (second arrêt après la création de la région).
    const box = await ctx.box(sorc);
    const region = await ctx.call("create-region", { sceneId, name: "Zone (essai)",
      shapes: [{ type: "rectangle", x: box.x + box.width, y: box.y, width: box.width * 2, height: box.height }],
      regionData: { flags: { dnd5e: { activity: one.activity, origin: `Scene.${sceneId}.Token.${sorc.id}` } } } });
    const regionId = region?.id ?? region?.regionId;
    ctx.restore(() => ctx.call("delete-scene-object", { type: "Region", objectId: regionId }).catch(() => {}));
    await pause(500);
    const two = await api("previewCancelledCast", { tokenId: sorc.id, identifier: "burning-hands", animation: CAST, watch: false });
    ctx.restore(() => api("castingEffects", { name: two.name, end: true }));
    ctx.expect(two.before === 1 && !two.decided?.watching, `incantation jouée après la pose, sans surveillance (${two.before} effet)`);
    left = 1;
    for ( let s = 0; (s < 6) && left; s++ ) { await pause(1000); left = (await api("castingEffects", { name: two.name })).count; }
    ctx.expect(left === 0, "zone posée avant l'incantation retardée : l'incantation s'arrête quand même");

    // 3. Le son d'incantation chargé sur un client **après** l'arrêt envoyé par le poseur (Discord, 2026-11-19 : la boucle restait
    //    chez les autres) : joué ici seulement, 2,5 s après une nouvelle région (après l'arrêt de 2 s, avant le rattrapage de 5 s),
    //    il s'arrête dès son chargement. Témoin : un son au nom d'un autre objet continue de tourner.
    await ctx.call("delete-scene-object", { type: "Region", objectId: regionId }).catch(() => {});
    // Témoin d'abord : un client qui ne joue pas vraiment les sons (banc sans audio) les retire aussitôt — rien à conclure alors.
    const witness = `Sound-Témoin-${sorc.id}`;
    ctx.restore(() => api("castingSounds", { name: witness, end: true }));
    await api("previewCastingSound", { tokenId: sorc.id, identifier: "burning-hands", name: witness });
    await pause(1500);
    if ( !(await api("castingSounds", { name: witness })).count ) { ctx.log("sons non joués sur ce client (pas d'audio) : partie 3 non applicable"); return; }
    const again = await ctx.call("create-region", { sceneId, name: "Zone (essai 2)",
      shapes: [{ type: "rectangle", x: box.x + box.width, y: box.y, width: box.width * 2, height: box.height }],
      regionData: { flags: { dnd5e: { activity: one.activity, origin: `Scene.${sceneId}.Token.${sorc.id}` } } } });
    const againId = again?.id ?? again?.regionId;
    ctx.restore(() => ctx.call("delete-scene-object", { type: "Region", objectId: againId }).catch(() => {}));
    await pause(2500);
    const late = await api("previewCastingSound", { tokenId: sorc.id, identifier: "burning-hands" });
    ctx.restore(() => api("castingSounds", { name: late.name, end: true }));
    let sounds = 1;
    for ( let s = 0; (s < 4) && sounds; s++ ) { await pause(500); sounds = (await api("castingSounds", { name: late.name })).count; }
    ctx.expect(!late.error && (sounds === 0), `son d'incantation chargé après l'arrêt : arrêté dès son chargement, avant 5 s (${late.error ?? `${sounds} restant`})`);
    const kept = (await api("castingSounds", { name: witness })).count;
    ctx.expect(kept === 1, `témoin : un son d'un autre nom continue (${kept})`);
  }
};
