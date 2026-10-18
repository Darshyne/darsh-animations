/**
 * Le rendu « JB2A + PSFX » (SPEC §17) : ce que ce module joue lui-même (consommables, pièges, murs de sort, zones) quand BLFX n'est
 * pas là, avec les animations de **JB2A gratuit** (`JB2A_DnD5e`) et, si le module est actif, les sons de **PSFX** (`psfx`), tous
 * deux enregistrés dans la base de Sequencer (`jb2a.*`, `psfx.*`). Seul le contenu **gratuit** est nommé : la version Patreon
 * (`jb2a_patreon`) garde les mêmes noms et en ajoute d'autres, tout marche donc avec les deux. Catalogues : `docs/catalogue-jb2a.json`,
 * `docs/catalogue-psfx.json` (`npm run catalogue:libre`) ; `npm test` vérifie chaque nom d'ici contre eux.
 *
 * Un nom peut désigner un groupe (Sequencer tire alors un fichier au hasard, ou, pour un projectile aux clés en pieds — « 05ft »,
 * « 15ft »… —, celui qui va le mieux à la distance quand l'effet est étiré). JB2A gratuit n'a souvent qu'une couleur par animation :
 * `tint` (#rrggbb) la reteinte par Sequencer.
 *
 * Pièges : JB2A est rangé par pièce de donjon, pas par piège — `TRAPS` reprend les mêmes clés que data/traps.mjs.
 */

/**
 * La teinte de chaque couleur des consommables (data/consumables.mjs COLORS), et la variante de la lueur de soin de JB2A
 * (`jb2a.healing_generic.400px.<variante>` : bleu, vert, violet, jaune) à reteindre.
 */
export const COLORS = Object.freeze({
  red: { variant: "yellow", tint: "#ff4050" },
  orange: { variant: "yellow", tint: "#ff9020" },
  yellow: { variant: "yellow" },
  green: { variant: "green" },
  blue: { variant: "blue" },
  purple: { variant: "purple" },
  poison: { variant: "green", tint: "#9ad000" }
});

/** Les sons PSFX qui reviennent. */
const S = Object.freeze({
  drink: "psfx.consumables.potions-vials.drink-liquid.002",
  cork: "psfx.consumables.potions-vials.cork-bottle.002",
  heal: "psfx.1st-level-spells.cure-wounds.v1.001",
  boon: "psfx.conditions.boon.002.01",
  bad: "psfx.conditions.generic-layer.002",
  cast: "psfx.casting.generic.002.001",
  sip: "psfx.consumables.food-and-drink.consume.drink.sip.polite.001",
  bite: "psfx.consumables.food-and-drink.consume.food.bite.soft.001"
});

/**
 * L'impact d'un type de dégâts sur une créature : animation JB2A, échelle, teinte, son PSFX. Sert aux flasques lancées, aux pièges
 * sans entrée propre, aux murs et à leurs créatures touchées.
 */
export const IMPACTS = Object.freeze({
  acid: { animation: "jb2a.impact.004.blue", tint: "#6fd02a", sound: "psfx.cantrips.acid-splash.v1.15ft" },
  bludgeoning: { animation: "jb2a.impact.005.orange", sound: "psfx.impacts.bludgeoning.v1" },
  cold: { animation: "jb2a.impact_themed.ice_shard.blue", sound: "psfx.impacts.magicaleffects.cold" },
  fire: { animation: "jb2a.impact.fire.01.orange", sound: "psfx.impacts.magicaleffects.fire" },
  force: { animation: "jb2a.impact.011.blue", sound: "psfx.impacts.magicaleffects.generic.002.001" },
  lightning: { animation: "jb2a.static_electricity.01.blue", sound: "psfx.impacts.magicaleffects.lightning" },
  necrotic: { animation: "jb2a.toll_the_dead.green.skull_smoke", sound: "psfx.impacts.magicaleffects.necrotic" },
  piercing: { animation: "jb2a.impact.007.yellow", scale: 1.2, sound: "psfx.impacts.slashing.v1" },
  poison: { animation: "jb2a.icon.poison.dark_green", scale: 1, duration: 2000, sound: S.bad },
  psychic: { animation: "jb2a.impact.004.blue", tint: "#c060ff", sound: "psfx.impacts.magicaleffects.psychic" },
  radiant: { animation: "jb2a.divine_smite.target.blueyellow", sound: "psfx.class-features.divine-smite.v1.001.target" },
  slashing: { animation: "jb2a.impact.008.orange", sound: "psfx.impacts.slashing.v1" },
  thunder: { animation: "jb2a.thunderwave.center.blue", sound: "psfx.cantrips.thunderclap.v1" }
});

/**
 * Consommables, par sorte (même forme que BLFX_RECIPES de data/consumables.mjs) : `at` "user" ou "targets", `animation` (où
 * `{color}` devient la variante de COLORS), `tint: true` pour reteindre de la couleur du consommable, `throw` + `splash` pour une
 * flasque lancée (puis l'impact de ses dégâts, IMPACTS), `sound`, `scale`, `delay`, `duration`, `below`.
 */
export const CONSUMABLES = Object.freeze({
  heal: [
    { at: "user", sound: S.drink },
    { at: "targets", animation: "jb2a.healing_generic.400px.{color}", tint: true, scale: 1.6, delay: 500, sound: S.heal }
  ],
  potion: [
    { at: "user", sound: S.drink },
    { at: "targets", animation: "jb2a.healing_generic.400px.{color}", tint: true, scale: 1.6, delay: 500, sound: S.boon }
  ],
  poison: [
    { at: "targets", animation: "jb2a.icon.poison.dark_green", scale: 1, duration: 2500, sound: S.bad },
    { at: "targets", animation: "jb2a.condition.curse.01.001.red", tint: "#9ad000", scale: 1.4, delay: 300 }
  ],
  thrown: [
    { at: "targets", throw: "jb2a.throwable.throw.flask.01.orange", sound: S.cork, splash: "jb2a.liquid.splash.blue", tint: true }
  ],
  scroll: [
    { at: "user", animation: "jb2a.magic_signs.circle.02.divination.intro.blue", scale: 1.6, sound: S.cast }
  ],
  drink: [
    { at: "user", sound: S.sip }
  ],
  food: [
    { at: "user", animation: "jb2a.healing_generic.200px.yellow", scale: 1.2, sound: S.bite }
  ]
});

/** Les signatures des potions marquantes (data/consumables.mjs SIGNATURES), en JB2A : sur la créature qui boit. */
export const SIGNATURES = Object.freeze({
  vanish: { animation: "jb2a.misty_step.01.blue", scale: 1.6 },
  ethereal: { animation: "jb2a.misty_step.02.blue", scale: 1.8, tint: "#c080ff" },
  mist: { animation: "jb2a.fog_cloud.01.white", scale: 2.4, duration: 3000, below: true },
  fire: { animation: "jb2a.explosion.01.orange", scale: 1.6 },
  wings: { animation: "jb2a.swirling_feathers.outburst.01.textured", scale: 2 },
  bubbles: { animation: "jb2a.bubble.001.001.complete.blue", scale: 1.6 },
  shield: { animation: "jb2a.shield.01.complete.01.blue", scale: 1.6 },
  heart: { animation: "jb2a.markers.heart.pink.01", scale: 1.3, duration: 2500 },
  eye: { animation: "jb2a.eyes.01.dark_green.single", scale: 1.3, duration: 2500 },
  grow: null,
  shrink: null
});

/** Une partie d'impact pour les pièges et les murs (forme de data/traps.mjs). */
const impact = (type, extra={}) => ({ at: "targets", ...IMPACTS[type], ...extra });

/** Pièges du DMG 2024, mêmes clés que data/traps.mjs TRAPS. */
export const TRAPS = Object.freeze({
  dmgPoisonedDarts: [impact("piercing"), impact("poison", { delay: 350, sound: undefined })],
  dmgPoisonedNeedl: [impact("piercing", { scale: 0.9 }), impact("poison", { delay: 300, sound: undefined })],
  dmgFireCastingSt: [
    { at: "area", animation: "jb2a.fireball.explosion.orange", sound: "psfx.1st-level-spells.burning-hands.v1.001" },
    impact("fire", { delay: 500, sound: undefined })
  ],
  dmgFireballFungu: [
    { at: "area", animation: "jb2a.fireball.explosion.orange", sound: "psfx.3rd-level-spells.fireball.v1.001.explosion" },
    impact("fire", { delay: 600, sound: undefined })
  ],
  dmgCollapsingRoo: [
    { at: "area", animation: "jb2a.falling_rocks.top.1x1.grey", sound: "psfx.impacts.bludgeoning.v1" },
    { at: "area", animation: "jb2a.smoke.puff.centered.grey", delay: 600, scale: 1.2 },
    impact("bludgeoning", { delay: 400, sound: undefined })
  ],
  dmgRollingStoneT: [
    { at: "area", animation: "jb2a.rolling_boulder.loop.01.rock.brown", duration: 1500, sound: "psfx.impacts.bludgeoning.v1" },
    impact("bludgeoning", { delay: 250, sound: undefined })
  ],
  dmgFallingNetTra: [
    { at: "targets", animation: "jb2a.web.01", scale: 1.6 }
  ],
  dmgHiddenPitTrap: [
    { at: "targets", animation: "jb2a.impact.ground_crack.orange.01", scale: 1.8, below: true, sound: "psfx.impacts.bludgeoning.v1" },
    impact("bludgeoning", { delay: 500, sound: undefined })
  ],
  dmgSpikedPitTrap: [
    { at: "targets", animation: "jb2a.spike_trap.05x05ft.top.holes.normal.01.01", scale: 1.4, below: true,
      sound: "psfx.impacts.bludgeoning.v1" },
    impact("piercing", { delay: 500, sound: undefined })
  ],
  dmgPoisonousGas0: [
    { at: "area", animation: "jb2a.template_circle.smoke.001.complete.800px.001.greenpurple", tint: "#9ad000", scale: 1.2,
      sound: "psfx.cantrips.poison-spray.v1" },
    { at: "area", animation: "jb2a.fog_cloud.01.white", tint: "#9ad000", delay: 500, duration: 12000, scale: 1.4, below: true },
    impact("poison", { delay: 900, sound: undefined })
  ],
  dmgQuicksandPit0: [
    { at: "area", animation: "jb2a.template_circle.whirl.loop.blue", tint: "#b08a50", duration: 3000, below: true,
      sound: "psfx.creature.movement.burrow.breach" }
  ]
});

/** Sans entrée pour le piège : l'impact du premier type de dégâts de son activité. */
export const TRAPS_BY_DAMAGE = Object.freeze(Object.fromEntries(Object.keys(IMPACTS).map(type => [type, [impact(type)]])));

/**
 * Murs de sort posés par points (même forme que data/walls.mjs WALLS). Les murs de JB2A gratuit ont 100 px de haut : `native: 100`,
 * l'épaisseur voulue en cases dans `thickness`. Le Mur de glace n'a pas d'image couchée dans JB2A : seulement son impact.
 */
export const WALLS = Object.freeze({
  "wall-of-fire": {
    animations: { 5: "jb2a.wall_of_fire.100x100.yellow", 10: "jb2a.wall_of_fire.200x100.yellow", 15: "jb2a.wall_of_fire.300x100.yellow" },
    native: 100,
    thickness: 1,
    sound: { name: "psfx.ambient.firesources.fireplace.001", volume: 0.5, reach: 30 },
    hit: [
      { ...IMPACTS.fire, scale: 1.5 },
      { animation: "jb2a.flames.01.orange", scale: 1.1, delay: 300, duration: 3000 }
    ]
  },
  "wind-wall": {
    animations: { 5: "jb2a.wind_wall.100x100", 10: "jb2a.wind_wall.200x100", 15: "jb2a.wind_wall.300x100", 25: "jb2a.wind_wall.500x100" },
    native: 100,
    thickness: 1,
    sound: { name: "psfx.cantrips.gust.v1", volume: 0.4, reach: 15 },
    hit: [{ ...IMPACTS.bludgeoning, scale: 1.4, sound: "psfx.cantrips.gust.v1" }]
  },
  "wall-of-force": {
    animations: { 5: "jb2a.wall_of_force.vertical.grey" },
    native: 25,
    thickness: 0.4
  },
  "wall-of-ice": {
    hit: [{ ...IMPACTS.cold, scale: 1.5 }]
  },
  "prismatic-wall": {
    hit: ["fire", "acid", "lightning", "poison", "cold"].map((type, i) => ({ ...IMPACTS[type], scale: 1.4, delay: i * 250, sound: undefined }))
  },
  "wall-of-thorns": {
    tile: { animation: "jb2a.vine.loop.nature.group.01.green", scale: 1.1 },
    hit: [{ ...IMPACTS.slashing, scale: 1.3 }]
  },
  "blade-barrier": {
    tile: { animation: "jb2a.cloud_of_daggers.daggers.yellow", scale: 1 },
    hit: [{ ...IMPACTS.force, scale: 1.4 }]
  }
});

/**
 * Zones de sort (SPEC §17), quand ni BLFX ni Automated Animations ne les animent : une animation par forme — `circle` (cercle,
 * sphère, émanation, et toute forme sans entrée propre, à la taille de sa boîte), `cone` et `line` (étirées de l'origine vers le
 * bout : JB2A les dessine pour ça) — avec un son. `persist` : la zone dure (Rayon de lune, Toile…) — l'animation boucle tant que la
 * région est là, sous les tokens si `below`. Par identifiant d'abord, puis par le premier type de dégâts, puis le soin.
 */
export const AREAS_BY_DAMAGE = Object.freeze({
  acid: { circle: "jb2a.liquid.splash.blue", tint: "#6fd02a", line: "jb2a.breath_weapons.acid.line.green",
    cone: "jb2a.breath_weapons.poison.cone.green", sound: "psfx.cantrips.acid-splash.v1.15ft" },
  bludgeoning: { circle: "jb2a.impact.ground_crack.orange.01", sound: "psfx.impacts.bludgeoning.v1" },
  cold: { circle: "jb2a.ice_spikes.radial.burst.white", cone: "jb2a.cone_of_cold.blue", line: "jb2a.template_line.ice.01.blue",
    sound: "psfx.5th-level-spells.cone-of-cold.v1.001" },
  fire: { circle: "jb2a.fireball.explosion.orange", cone: "jb2a.burning_hands.01.orange", line: "jb2a.breath_weapons.fire.line.orange",
    sound: "psfx.3rd-level-spells.fireball.v1.001.explosion" },
  force: { circle: "jb2a.template_circle.out_pulse.01.burst.bluewhite", sound: "psfx.impacts.magicaleffects.generic.002.001" },
  lightning: { circle: "jb2a.template_circle.lightning.01.loop.bluepurple", cone: "jb2a.template_cone_5e.lightning.01.loop.bluepurple.30ft",
    line: "jb2a.lightning_bolt.wide.blue", sound: "psfx.impacts.magicaleffects.lightning" },
  necrotic: { circle: "jb2a.toll_the_dead.green.shockwave", cone: "jb2a.template_cone_5e.001.001.purplered.30ft",
    sound: "psfx.impacts.magicaleffects.necrotic" },
  piercing: { circle: "jb2a.impact.ground_crack.orange.01", sound: "psfx.impacts.slashing.v1" },
  poison: { circle: "jb2a.template_circle.smoke.001.complete.800px.001.greenpurple", tint: "#9ad000",
    cone: "jb2a.breath_weapons.poison.cone.green", line: "jb2a.breath_weapons.acid.line.green", sound: "psfx.cantrips.poison-spray.v1" },
  psychic: { circle: "jb2a.template_circle.symbol.normal.stun.purple", cone: "jb2a.template_cone_5e.001.001.purplered.30ft",
    sound: "psfx.impacts.magicaleffects.psychic" },
  radiant: { circle: "jb2a.template_circle.out_pulse.02.burst.bluewhite", tint: "#fff2a0",
    sound: "psfx.cantrips.sacred-flame.v1.001.target" },
  slashing: { circle: "jb2a.impact.ground_crack.orange.01", sound: "psfx.impacts.slashing.v1" },
  thunder: { circle: "jb2a.thunderwave.center.blue", sound: "psfx.cantrips.thunderclap.v1" },
  healing: { circle: "jb2a.template_circle.out_pulse.01.burst.bluewhite", tint: "#60e090", sound: "psfx.1st-level-spells.cure-wounds.v1.001" }
});

export const AREAS_BY_IDENTIFIER = Object.freeze({
  // Zones qui durent.
  "moonbeam": { circle: "jb2a.moonbeam.01.loop.blue", persist: true, sound: "psfx.2nd-level-spells.moonbeam.intro.v1.001" },
  "spirit-guardians": { circle: "jb2a.spirit_guardians.blueyellow.ring", persist: true },
  "fog-cloud": { circle: "jb2a.fog_cloud.01.white", persist: true },
  "darkness": { circle: "jb2a.darkness.black", persist: true },
  "hunger-of-hadar": { circle: "jb2a.darkness.black", persist: true },
  "web": { circle: "jb2a.web.loop.002.white", persist: true, below: true },
  "grease": { circle: "jb2a.grease.dark_brown.loop", persist: true, below: true },
  // Huile étalée au sol (DAS · Core 0.242.0) : une nappe sombre, en feu une fois embrasée (BURNING).
  "oil": { circle: "jb2a.grease.dark_brown.loop", tint: "#2b2214", persist: true, below: true },
  "sleet-storm": { circle: "jb2a.sleet_storm.01.blue", persist: true },
  "ice-storm": { circle: "jb2a.sleet_storm.01.blue", sound: "psfx.impacts.magicaleffects.cold" },
  "entangle": { circle: "jb2a.entangle.02.loop.02.green", persist: true, below: true,
    sound: "psfx.1st-level-spells.entangle.vines.v1.001.intro" },
  "plant-growth": { circle: "jb2a.plant_growth.03.round.4x4.loop.greenyellow", persist: true, below: true },
  "spike-growth": { circle: "jb2a.plant_growth.03.round.4x4.loop.greenyellow", tint: "#a0a040", persist: true, below: true },
  "stinking-cloud": { circle: "jb2a.template_circle.smoke.001.loop.800px.001.greenpurple", tint: "#9ab020", persist: true },
  "cloudkill": { circle: "jb2a.template_circle.smoke.001.loop.800px.001.greenpurple", tint: "#7fbf2a", persist: true },
  "incendiary-cloud": { circle: "jb2a.template_circle.smoke.001.loop.800px.001.greenpurple", tint: "#ff7030", persist: true },
  "insect-plague": { circle: "jb2a.template_circle.smoke.001.loop.800px.001.greenpurple", tint: "#4a3a20", persist: true },
  "evards-black-tentacles": { circle: "jb2a.black_tentacles.dark_purple", persist: true, below: true },
  "cloud-of-daggers": { circle: "jb2a.cloud_of_daggers.daggers.blue", persist: true },
  "call-lightning": { circle: "jb2a.call_lightning.low_res.blue", persist: true, sound: "psfx.3rd-level-spells.call-lightning.v1.cast" },
  "silence": { circle: "jb2a.template_circle.out_pulse.01.loop.bluewhite", tint: "#a0a0c0", persist: true },
  // Zones instantanées à l'allure propre.
  "fireball": { circle: "jb2a.fireball.explosion.orange", sound: "psfx.3rd-level-spells.fireball.v1.001.explosion" },
  "burning-hands": { cone: "jb2a.burning_hands.01.orange", sound: "psfx.1st-level-spells.burning-hands.v1.001" },
  "cone-of-cold": { cone: "jb2a.cone_of_cold.blue", sound: "psfx.5th-level-spells.cone-of-cold.v1.001" },
  "lightning-bolt": { line: "jb2a.lightning_bolt.wide.blue", sound: "psfx.impacts.magicaleffects.lightning" },
  "thunderwave": { circle: "jb2a.thunderwave.center.blue", sound: "psfx.cantrips.thunderclap.v1" },
  "shatter": { circle: "jb2a.shatter.blue", sound: "psfx.cantrips.thunderclap.v1" },
  "arms-of-hadar": { circle: "jb2a.arms_of_hadar.dark_purple", sound: "psfx.1st-level-spells.arms-of-hadar.v1.001" },
  "sleep": { circle: "jb2a.sleep.cloud.01.pink", sound: "psfx.1st-level-spells.sleep.v1.001" },
  "faerie-fire": { circle: "jb2a.swirling_sparkles.01.blue", tint: "#c080ff" },
  "gust-of-wind": { line: "jb2a.wind_stream.white", sound: "psfx.cantrips.gust.v1" }
});

/** Une zone que DAS · Core embrase (huile au sol, toile) : le feu, en boucle, tant qu'elle est là. */
export const BURNING = Object.freeze({ circle: "jb2a.flames.orange.03.2x2", persist: true, below: false,
  sound: "psfx.casting.fire.001" });
