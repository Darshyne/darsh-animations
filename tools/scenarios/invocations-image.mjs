/**
 * SPEC §26 : l'image animée JB2A sur le token d'une invocation, jouée par le vrai chemin (activité d'invocation de dnd5e → hook
 * `dnd5e.postSummon`), dans l'« Arène des sorts » du moteur. Lancer depuis le moteur : `node tools/scenario.mjs "<ce fichier>"`.
 *  1. Arme spirituelle du Manuel → le token prend une vidéo JB2A d'arme spirituelle (pas un acteur : l'acteur garde son image),
 *     anneau coupé, teinte blanche, drapeau de retour ; le fichier se charge (HTTP 200, vidéo qui joue) ; la fenêtre « Apparence » s'ouvre.
 *  2. Dans la fenêtre : une autre arme choisie → le token la prend, le Lanceur la retient (« dernière invocation »).
 *  3. Seconde invocation → la dernière apparence est posée d'office.
 *  4. Le moteur pilote toujours l'arme : déplacement, puis attaque de l'arme sur la Cible (la seconde arme : sort à concentration).
 *  5. Réglage de monde coupé → l'image du compendium reste. 6. JB2A retiré des sources « Invocations » → idem.
 *  7. Sphère de feu, Main de Bigby, Lumières dansantes, Main de mage, Épée de Mordenkainen → chacune prend sa vidéo.
 * Sans JB2A : non applicable.
 */
const MODULE = "darsh-animations";
const PHB = id => `Compendium.dnd-players-handbook.spells.Item.${id}`;
const pause = ms => new Promise(r => setTimeout(r, ms));

export default {
  name: "invocations — image animée JB2A sur le token invoqué, choix de l'apparence, dernière invocation (Arène des sorts)",
  scene: "Arène des sorts",

  async run(ctx) {
    const api = async (fn, args={}) => (await ctx.call("call-module-api", { moduleId: MODULE, fn, args, waitMs: 8000 })).result;
    const script = async code => (await ctx.call("run-script", { code }))?.result;
    const offered = await api("summonArtVariants", { identifier: "spiritual-weapon" });
    if ( !offered?.count ) { ctx.log("JB2A absent (aucune variante dans Sequencer) : non applicable"); return; }
    ctx.log(`variantes offertes pour l'Arme spirituelle : ${offered.count} (${offered.groups.length} armes)`);

    const caster = await ctx.token("Lanceur");
    const target = await ctx.token("Cible");
    const grid = await ctx.gridSize();
    const p = await ctx.position(caster);
    const sceneId = (await ctx.scene()).sceneId;
    const created = [];
    ctx.restore(async () => {
      for ( const id of created ) await ctx.call("delete-scene-object", { type: "Token", objectId: id }).catch(() => {});
      await script(`const a = canvas.scene.tokens.get("${caster.id}").actor; await a.unsetFlag("${MODULE}", "summonArt"); return true;`);
      await script(`await game.settings.set("${MODULE}", "summonArt", true); return true;`);
    });
    await script(`const a = canvas.scene.tokens.get("${caster.id}").actor; await a.unsetFlag("${MODULE}", "summonArt"); return true;`);

    const tokenState = id => script(`const t = canvas.scene.tokens.get("${id}"); if ( !t ) return null;
      const src = t.texture.src; const res = await fetch(src, { method: "HEAD" }).catch(() => null);
      const video = t.object?.mesh?.texture?.baseTexture?.resource?.source;
      return { src, tint: t.texture.tint?.css ?? String(t.texture.tint), scale: t.texture.scaleX, ring: t.ring.enabled,
        flag: t.getFlag("${MODULE}", "summonArt") ?? null, actorImg: t.actor?.img ?? null, protoSrc: t.actor?.prototypeToken?.texture?.src ?? null,
        http: res?.status ?? null, video: video instanceof HTMLVideoElement ? { paused: video.paused, ready: video.readyState, loop: video.loop, locked: game.video.locked,
          pending: [...game.video.pending].some(([v]) => v === video) } : null,
        x: t.x, y: t.y };`);
    const dialogs = () => script(`return [...foundry.applications.instances.values()].filter(a => a.element?.querySelector?.(".das-summon-art"))
      .map(a => ({ id: a.id, title: a.title, options: [...a.element.querySelectorAll("select[name=group] option")].map(o => o.value) }));`);
    const closeDialogs = () => script(`for ( const a of [...foundry.applications.instances.values()] ) if ( a.element?.querySelector?.(".das-summon-art") ) await a.close(); return true;`);
    const summon = async (uuid, at) => {
      const itemId = await ctx.ensureItem(caster, uuid);
      const s = await ctx.engine("summonAt", { tokenId: caster.id, itemId, x: at.x, y: at.y });
      for ( const t of s?.tokens ?? [] ) created.push(t.id);
      await pause(2500);
      return s?.tokens ?? [];
    };

    // 1. Arme spirituelle, image d'office.
    const [w1] = await summon(PHB("phbsplSpiritualW"), { x: p.x + grid, y: p.y });
    if ( !ctx.expect(!!w1, "l'Arme spirituelle est posée") ) return;
    const s1 = await tokenState(w1.id);
    ctx.log(JSON.stringify(s1));
    ctx.expect(/Spiritual_Weapon\/.*\.webm$/.test(s1.src), `le token montre une arme spirituelle JB2A (${s1.src})`);
    ctx.expect(s1.flag?.key === "spiritual-weapon" && !!s1.flag?.from?.src, `drapeau de retour (${s1.flag?.from?.src})`);
    ctx.expect(s1.ring === false && /ffffff/i.test(s1.tint), "anneau dynamique coupé, teinte blanche");
    ctx.expect(!/\.webm$/.test(s1.protoSrc ?? "") && !/\.webm$/.test(s1.actorImg ?? ""), `l'acteur garde ses images (${s1.protoSrc})`);
    ctx.expect(s1.http === 200, `le fichier se charge (HTTP ${s1.http})`);
    // Foundry garde les vidéos en attente jusqu'au premier geste de l'utilisateur sur la page (`game.video.locked`, VideoHelper#play) :
    // un client sans clic (le Chrome du banc) a la vidéo en file, un joueur réel la voit jouer.
    ctx.expect(!!s1.video && s1.video.ready >= 2 && (!s1.video.paused || (s1.video.locked && s1.video.pending)),
      `la vidéo joue sur la toile, ou attend le premier geste (${JSON.stringify(s1.video)})`);
    const open = await dialogs();
    ctx.expect(open.length === 1 && open[0].options.length > 1, `la fenêtre « Apparence » s'ouvre, ${open[0]?.options.length ?? 0} armes`);

    // 2. Choisir une autre arme dans la fenêtre.
    const wanted = (open[0]?.options ?? []).find(g => g === "greatsword") ?? open[0]?.options.find(g => g !== "mace");
    const picked = await script(`const app = [...foundry.applications.instances.values()].find(a => a.element?.querySelector?.(".das-summon-art"));
      const g = app.element.querySelector("select[name=group]"); g.value = "${wanted}"; g.dispatchEvent(new Event("change"));
      const v = app.element.querySelector("select[name=variant]").value;
      app.element.querySelector("button[data-action=choose]").click(); return v;`);
    await pause(2500);
    const s2 = await tokenState(w1.id);
    ctx.expect(s2.flag?.name === picked && s2.src !== s1.src, `l'arme choisie est posée (${picked})`);
    ctx.expect(s2.flag?.from?.src === s1.flag?.from?.src, "le retour garde l'image du compendium, pas la première vidéo");
    const remembered = await script(`return canvas.scene.tokens.get("${caster.id}").actor.getFlag("${MODULE}", "summonArt") ?? null;`);
    ctx.expect(remembered?.["spiritual-weapon"] === picked, `le Lanceur retient son choix (${JSON.stringify(remembered)})`);

    // 3. Seconde invocation : la dernière apparence d'office.
    const [w2] = await summon(PHB("phbsplSpiritualW"), { x: p.x + 2 * grid, y: p.y });
    const s3 = w2 ? await tokenState(w2.id) : null;
    ctx.expect(s3?.flag?.name === picked, `seconde invocation : « comme la dernière » d'office (${s3?.flag?.name})`);
    const again = await dialogs();
    ctx.expect(again.length === 1, "la fenêtre propose encore d'en changer");
    await closeDialogs();

    // 4. Le moteur pilote toujours l'arme (la seconde : l'Arme spirituelle est à concentration, relancer le sort a fait partir la première).
    const w1b = w2;
    const before = await tokenState(w1b.id);
    await ctx.engine("move", { tokenId: w1b.id, point: { x: before.x + grid * 1.5, y: before.y + grid * 0.5 } })
      .catch(err => ctx.log(`move : ${err.message}`));
    await pause(1500);
    const after = await tokenState(w1b.id);
    ctx.expect((after.x !== before.x) || (after.y !== before.y), `l'arme se déplace (${before.x},${before.y} → ${after.x},${after.y})`);
    ctx.expect(after.src === s3.src, "l'image reste après le déplacement");
    const attack = await script(`const t = canvas.scene.tokens.get("${w1b.id}");
      const item = t.actor.items.find(i => i.system.activities?.some(a => a.type === "attack")); return item ? { id: item.id, name: item.name } : null;`);
    if ( ctx.expect(!!attack, `l'arme a une attaque (${attack?.name})`) ) {
      const used = await ctx.use({ tokenId: w1b.id, itemId: attack.id, activityType: "attack", targetTokenIds: [target.id], consume: false });
      ctx.expect(!!used?.usageMessageId || !!used?.messageId, `l'arme attaque la Cible (${JSON.stringify(used).slice(0, 160)})`);
      if ( used?.usageMessageId ) await ctx.settle(used.usageMessageId, { timeoutMs: 30000 }).catch(() => null);
    }

    // 5. Réglage coupé.
    await script(`await game.settings.set("${MODULE}", "summonArt", false); return true;`);
    const [w3] = await summon(PHB("phbsplSpiritualW"), { x: p.x + 3 * grid, y: p.y });
    const s5 = w3 ? await tokenState(w3.id) : null;
    ctx.expect(!!s5 && !/\.webm$/.test(s5.src) && !s5.flag, `réglage coupé : image du compendium (${s5?.src})`);
    await script(`await game.settings.set("${MODULE}", "summonArt", true); return true;`);

    // 6. JB2A retiré des sources du domaine « Invocations » (même chemin que JB2A absent : chain("summons") sans jb2a).
    const sources = await api("sources");
    const off = { ...sources, off: [...new Set([...(sources.off ?? []), "jb2a"])] };
    await api("sourcesSetting", { value: off });
    ctx.restore(() => api("sourcesSetting", { value: sources }));
    const [w4] = await summon(PHB("phbsplSpiritualW"), { x: p.x + 4 * grid, y: p.y });
    const s6 = w4 ? await tokenState(w4.id) : null;
    ctx.expect(!!s6 && !/\.webm$/.test(s6.src) && !s6.flag, `sans JB2A dans les sources : image du compendium (${s6?.src})`);
    await api("sourcesSetting", { value: sources });

    // 7. Les autres sorts de la table.
    const others = [["phbsplFlamingSph", "Flaming_Sphere"], ["phbsplBigbysHand", "Arcane_Hand"], ["phbsplDancingLig", "Dancing_Lights"],
      ["phbsplMageHand00", "Arcane_Hand"], ["phbswdMordenkain", "Spiritual_Weapon"]];
    let row = 1;
    for ( const [id, folder] of others ) {
      const placed = await summon(PHB(id), { x: p.x + grid, y: p.y + (2 * row++) * grid });
      await closeDialogs();
      const states = await Promise.all(placed.map(t => tokenState(t.id)));
      ctx.expect(states.length > 0 && states.every(s => new RegExp(`${folder}/.*\\.webm$`).test(s?.src ?? "") && s.http === 200),
        `${id} : ${states.length} token(s) en vidéo JB2A (${states.map(s => s?.src?.split("/").pop()).join(", ")})`);
    }

    await pause(600);
    const errors = await ctx.clientErrors();
    ctx.expect(!errors.length, `aucune erreur dans la console du MJ${errors.length ? ` — ${errors.map(e => e.message ?? e.text).join(" | ").slice(0, 300)}` : ""}`);
  }
};
