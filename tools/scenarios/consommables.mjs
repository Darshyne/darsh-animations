/**
 * Effets des potions et consommables (SPEC §13), par le vrai chemin : une utilisation crée la carte `usage`, le MJ actif
 * l'intercepte et joue l'effet.
 *  - le Paladin boit une Potion de soins (consommée : la potion est détruite, l'effet la relit dans la carte), rendu BLFX ;
 *  - la même chose avec le rendu Token Magic FX : la lueur est posée sur son token, puis retirée ;
 *  - le Paladin lance un Feu grégeois sur le Zombi : flasque lancée, éclaboussure de feu.
 *  - la même potion avec le rendu autonome : un anneau vert sur le Paladin ;
 *  - un Poison basique sur le Zombi, rendu autonome : un anneau rouge.
 * Le réglage « renderer » est remis à sa valeur.
 *
 * Se lance avec le lanceur du moteur : `node tools/scenario.mjs "../Foundry dnd5e animations/tools/scenarios"` (depuis le dépôt du moteur).
 */
const MODULE = "darsh-animations";
const POTION = "Compendium.dnd-players-handbook.equipment.Item.phbagPotionofHea";
const FIRE = "Compendium.dnd-players-handbook.equipment.Item.phbagAlchemistsF";
const POISON = "Compendium.dnd-players-handbook.equipment.Item.phbagPoisonBasic";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export default {
  name: "consommables — potion bue (BLFX, Token Magic FX), flasque lancée",

  async run(ctx) {
    const api = async (fn, args={}) => (await ctx.call("call-module-api", { moduleId: MODULE, fn, args, waitMs: 8000 })).result;
    const { tokens } = await ctx.scene();
    if ( !["Paladin", "Zombi"].every(n => tokens.some(t => t.name === n)) ) { ctx.log("Paladin ou Zombi absent : non applicable"); return; }
    const paladin = await ctx.token("Paladin");
    const zombi = await ctx.token("Zombi");
    const before = await api("rendererSetting");
    ctx.restore(() => api("rendererSetting", { value: before }));
    const hp0 = await ctx.hp(paladin);
    ctx.restore(() => ctx.setHp(paladin, hp0));
    const zhp0 = await ctx.hp(zombi);
    ctx.restore(() => ctx.setHp(zombi, zhp0));
    await ctx.setHp(zombi, 100);

    const lines = async () => ((await ctx.call("get-client-errors", { watch: [MODULE], levels: ["log", "warn", "error"], limit: 100 })).entries ?? [])
      .map(e => String(e.text ?? e.message ?? "")).filter(t => t.startsWith(`${MODULE} |`));
    const filters = async token => ((await ctx.call("get-scene-object", { type: "Token", objectId: token.id })).data?.flags?.tokenmagic?.filters ?? [])
      .map(f => f.tmFilters?.tmFilterId ?? "").filter(id => id.startsWith(`${MODULE}.`));

    const drink = async (label, re=/: heal \(red, positive\) by /) => {
      const itemId = await ctx.ensureItem(paladin, POTION);
      await ctx.setHp(paladin, 1);
      const seen = (await lines()).length;
      const used = await ctx.use({ tokenId: paladin.id, itemId, activityType: "heal", targetTokenIds: [], consume: true });
      ctx.expect(used.used !== false, `${label} : potion bue`);
      await pause(2500);
      const after = (await lines()).slice(seen);
      return after.find(l => re.test(l)) ?? null;
    };

    // 1. Rendu BLFX (si actif dans ce monde).
    const backend = await api("renderer");
    await api("rendererSetting", { value: "blfx" });
    if ( (await api("renderer")) === "blfx" ) {
      const line = await drink("BLFX");
      ctx.expect(!!line && line.includes("by blfx"), `BLFX : effet de soin joué (${line ?? "rien"})`);
    } else ctx.log("BLFX inactif : partie sautée");

    // 2. Rendu Token Magic FX.
    await api("rendererSetting", { value: "tokenmagic" });
    if ( (await api("renderer")) === "tokenmagic" ) {
      const line = await drink("Token Magic FX");
      ctx.expect(!!line && line.includes("by tokenmagic"), `Token Magic FX : effet de soin joué (${line ?? "rien"})`);
      const on = await filters(paladin);
      ctx.expect(on.some(id => id.includes(".heal.")), `Token Magic FX : lueur posée sur le Paladin (${on.join(", ") || "aucune"})`);
      await pause(6000);
      const left = await filters(paladin);
      ctx.expect(!left.length, `Token Magic FX : lueur retirée après l'animation (${left.join(", ") || "plus rien"})`);
    } else ctx.log("Token Magic FX inactif : partie sautée");

    // 3. Flasque lancée, rendu automatique.
    await api("rendererSetting", { value: "auto" });
    const fireId = await ctx.ensureItem(paladin, FIRE);
    const seen = (await lines()).length;
    await ctx.use({ tokenId: paladin.id, itemId: fireId, activityType: "save", targetTokenIds: [zombi.id] });
    await pause(3000);
    const thrown = (await lines()).slice(seen).find(l => /: thrown \(orange, negative\) by /.test(l));
    ctx.expect(!!thrown, `Feu grégeois : flasque lancée sur le Zombi (${thrown ?? "rien"} ; rendu ${backend})`);

    // 4. Rendu autonome : la potion (anneau vert), puis un poison sur le Zombi (anneau rouge).
    await api("rendererSetting", { value: "native" });
    const ring = await drink("autonome");
    ctx.expect(!!ring && ring.includes("by native, 1 part"), `autonome : anneau vert sur le Paladin (${ring ?? "rien"})`);
    const poisonId = await ctx.ensureItem(paladin, POISON);
    const seen2 = (await lines()).length;
    await ctx.use({ tokenId: paladin.id, itemId: poisonId, activityType: "damage", targetTokenIds: [zombi.id] });
    await pause(2500);
    const red = (await lines()).slice(seen2).find(l => /: poison \(poison, negative\) by native, 1 part/.test(l));
    ctx.expect(!!red, `autonome : anneau rouge sur le Zombi empoisonné (${red ?? "rien"})`);
  }
};
