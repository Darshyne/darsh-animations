/**
 * Effets de zone en Token Magic FX (SPEC §15) — à jouer **sans BLFX** (ou avec le réglage « renderer » sur Token Magic FX) :
 *  - Mains brûlantes de l'Ensorceleur sur le Zombi (instantané) : une région compagne « Zone : Fire » apparaît, avec ses filtres Token
 *    Magic ; elle disparaît après la zone, pas avant 3 s ;
 *  - Rayon de lune du Magicien (qui dure) : sa compagne suit la zone déplacée et part avec elle.
 * La zone du moteur n'est jamais touchée. Sans Token Magic FX : non applicable.
 *
 * Se lance avec le lanceur du moteur : `node tools/scenario.mjs "../Foundry dnd5e animations/tools/scenarios/zones.mjs"`.
 */
const MODULE = "darsh-animations";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export default {
  name: "zones — effet Token Magic FX par type de dégâts sur Mains brûlantes et Rayon de lune",

  async run(ctx) {
    const api = async (fn, args={}) => (await ctx.call("call-module-api", { moduleId: MODULE, fn, args, waitMs: 8000 })).result;
    const { tokens } = await ctx.scene();
    if ( !["Ensorceleur", "Magicien", "Zombi"].every(n => tokens.some(t => t.name === n)) ) { ctx.log("Ensorceleur, Magicien ou Zombi absent : non applicable"); return; }
    const backend = await api("renderer");
    if ( backend === "native" || !backend ) { ctx.log(`rendu « ${backend} » : Token Magic FX inactif, non applicable`); return; }
    if ( backend === "blfx" ) {
      const before = await api("rendererSetting");
      ctx.restore(() => api("rendererSetting", { value: before }));
      await api("rendererSetting", { value: "tokenmagic" });
      ctx.log("BLFX actif : rendu forcé sur Token Magic FX le temps du test");
    }
    const sorc = await ctx.token("Ensorceleur");
    const mage = await ctx.token("Magicien");
    const zombi = await ctx.token("Zombi");
    const hp0 = await ctx.hp(zombi);
    ctx.restore(() => ctx.setHp(zombi, hp0));
    await ctx.setHp(zombi, 100);
    const regions = async () => (await ctx.call("list-scene-objects", { types: ["Region"] })).objects.Region ?? [];
    const before = (await regions()).map(r => r.id);

    // 1. Mains brûlantes, instantané.
    const box = await ctx.box(zombi);
    const used = await ctx.use({ tokenId: sorc.id, identifier: "burning-hands", activityType: "save", area: { shape: "rectangle", ...box } });
    ctx.expect(used.used && !!used.regionId, "Mains brûlantes posées sur le Zombi");
    if ( !used.regionId ) return;
    ctx.restore(() => ctx.call("delete-scene-object", { type: "Region", objectId: used.regionId }).catch(() => {}));
    const shown = Date.now();
    let state = null;
    for ( let i = 0; (i < 10) && !state?.fx?.filters?.length; i++ ) { await pause(300); state = await api("areaState", { regionId: used.regionId }).catch(() => null); }
    ctx.expect(state?.plan?.key === "fire" && state.plan.preset === "Zone : Fire", `plan : ${JSON.stringify(state?.plan)}`);
    ctx.expect(!!state?.fx?.filters?.length, `région compagne avec ses filtres Token Magic (${state?.fx?.filters?.join(", ")})`);
    await ctx.settle(used.usageMessageId).catch(() => null);
    let gone = null;
    for ( const until = Date.now() + 15000; Date.now() < until; ) {
      const now = (await regions()).map(r => r.id);
      if ( !now.includes(used.regionId) && !now.includes(state?.fx?.id) ) { gone = Date.now() - shown; break; }
      await pause(400);
    }
    ctx.expect(gone !== null, `zone et compagne retirées (${gone} ms après la pose)`);
    ctx.expect(gone === null || gone >= 2900, "la compagne est restée au moins 3 s");

    // 2. Rayon de lune, qui dure : la compagne suit la zone, puis part avec elle.
    const zb = await ctx.box(zombi);
    const centre = { x: zb.x + zb.width / 2, y: zb.y + zb.height / 2 };
    const beam = await ctx.use({ tokenId: mage.id, identifier: "moonbeam", activityType: "save", area: { shape: "circle", ...centre, radius: zb.width } });
    ctx.expect(beam.used && !!beam.regionId, "Rayon de lune posé");
    if ( !beam.regionId ) return;
    ctx.restore(() => ctx.call("delete-scene-object", { type: "Region", objectId: beam.regionId }).catch(() => {}));
    ctx.restore(async () => {
      const actor = await ctx.call("get-actor", { actorId: mage.actorId });
      for ( const e of (actor.effects ?? []).filter(e => /concentr/i.test(e.name ?? "")) ) {
        await ctx.call("remove-embedded-effect", { uuid: `Actor.${mage.actorId}`, effectId: e._id ?? e.id }).catch(() => {});
      }
    });
    await ctx.settle(beam.usageMessageId).catch(() => null);
    let moon = null;
    for ( let i = 0; (i < 10) && !moon?.fx; i++ ) { await pause(300); moon = await api("areaState", { regionId: beam.regionId }).catch(() => null); }
    ctx.expect(moon?.plan?.key === "moonbeam" && !!moon?.fx, `Rayon de lune : compagne « ${moon?.plan?.preset} » (${moon?.fx?.filters?.join(", ")})`);
    // Déplacer la zone : la compagne suit.
    const zone = await ctx.call("get-scene-object", { type: "Region", objectId: beam.regionId });
    const shapes = (zone.data?.shapes ?? []).map(s => ({ ...s, x: (s.x ?? 0) + 280 }));
    await ctx.call("update-scene-object", { type: "Region", objectId: beam.regionId, data: { shapes } });
    await pause(1500);
    const fx = moon?.fx ? await ctx.call("get-scene-object", { type: "Region", objectId: moon.fx.id }) : null;
    ctx.expect(fx?.data?.shapes?.[0]?.x === shapes[0]?.x, `la compagne suit la zone (x ${fx?.data?.shapes?.[0]?.x} = ${shapes[0]?.x})`);
    await ctx.call("delete-scene-object", { type: "Region", objectId: beam.regionId });
    await pause(1500);
    const after = (await regions()).map(r => r.id);
    ctx.expect(!after.includes(moon?.fx?.id), "la compagne part avec la zone");
    ctx.expect(after.filter(id => !before.includes(id)).length === 0, "aucune région laissée");
  }
};
