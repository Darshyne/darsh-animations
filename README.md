# DAS · Animations (`darsh-animations`)

[![Tests](https://github.com/Darshyne/darsh-animations/actions/workflows/tests.yml/badge.svg)](https://github.com/Darshyne/darsh-animations/actions/workflows/tests.yml)

**[Website](https://darshyne.github.io)** · **[Discord](https://discord.gg/PDSq8dYdTP)** (questions, bugs, ideas)

> **Beta.** Darshyne's Automation Suite is still in beta: not every spell and feature is covered yet, and things may change
> between versions. If something doesn't behave as it should, tell us on [Discord](https://discord.gg/PDSq8dYdTP) or
> [open an issue](https://github.com/Darshyne/darsh-animations/issues).

Part of **Darshyne's Automation Suite (DAS)**. BLFX (Boss Loot) animations for the abilities BLFX does not
recognise by itself: Ravenloft: The Horrors Within, third-party creatures, high-level Player's Handbook spells.

The module adds its animations to BLFX's **Custom Auto-Rec** when the world loads, on the GM's client; BLFX then
plays them. Your own custom animations are kept.

Two things BLFX cannot see are played by the module itself, through Sequencer: traps (no source token), and
**walls drawn point by point** by DAS · Core (Wall of Fire: a looping wall of flames along each segment, or a
ring, for as long as the spell's region is on the scene).

**Potions and consumables** get visual feedback too, played by the module when the item is used: a potion drunk
or administered, a poison applied, a flask thrown (Alchemist's Fire, Acid, Holy Water, Oil), a scroll read, food and
drink. Every Player's Handbook and Dungeon Master's Guide potion has its own colour, and the striking ones a
signature effect (Invisibility fades, Gaseous Form turns to mist, Flying spreads wings, Growth and Diminution
swell or shrink…). Four renderers, in this order (world setting **"Effect renderer"**, *Auto* by default):

1. **Boss Loot (BLFX)** — drinking sounds, glows, splashes and signature animations from the BLFX asset pack;
2. **JB2A + PSFX** — animations from the **free** JB2A module (`JB2A_DnD5e`; the Patreon version works too, it keeps
   the same names) and sounds from **PSFX** (`psfx`, optional: without it the animations play silently);
3. **Token Magic FX** — a pulsing glow on the token (plus fade, blur, scale, bloom or shockwave), which removes
   itself;
4. **Built-in** — with none of them: a coloured ring pulsing around the token, **green** for a beneficial effect,
   **red** for a harmful one, **blue** for a neutral one.

Traps follow the same order (with JB2A: falling rocks, spikes, fumes, fire, impacts by damage type; with Token Magic
FX: a red glow and shockwave; built-in: a red ring on each victim). Spell walls are drawn with BLFX or JB2A. **Spell
areas** that nothing else animates (no BLFX, or a spell BLFX does not know) get a JB2A animation fitted to the area
(a cone or line stretched from its origin, the rest sized to the area; looping for as long as a lasting area such as
Moonbeam or Web stays), otherwise a Token Magic FX effect by damage type. The Custom Auto-Rec needs BLFX.

### Automated Animations

[Automated Animations](https://github.com/theripper93/autoanimations) recognises items by their **English name**, so
in a translated world it finds nothing. With this module active (world setting **"Automated Animations in every
language"**, on by default), when Automated Animations finds nothing with the translated name, it is given the matching
entry of its own list, found from the item's English name kept by Babele, its dnd5e identifier, its base weapon
(*Épée longue* → *Longsword*), or the translation table of the world's language — `module/names/fr.json` for French
(3 700 names of the SRD, from [dnd5e_fr-FR](https://github.com/adgranger/foundryvtt-dnd5e-lang-fr-fr), MIT). Names with
apostrophes (*Hunter's Mark*) and placed areas work too. Your own entries in another language still win. This replaces
the "Automated Animation for Babele" module, which can be disabled. Other languages: add `module/names/<code>.json`
(same shape), or call `game.modules.get("darsh-animations").api.aaNames({ "Local name": "English Name" })`.

Nothing plays twice: with **"Automated Animations gives way to BLFX"** (on by default), Automated Animations stays
silent for the items BLFX animates; and the potions, areas and walls this module plays itself are left to Automated
Animations when it has an entry for them. Not covered: Automated Animations' critical-hit animation, active effects
and ammunition (it only looks at their own, translated, names).

## Installation

In Foundry (or on The Forge), *Install Module* → paste the manifest URL:

```
https://github.com/Darshyne/darsh-animations/releases/latest/download/module.json
```

- Recommended: **BLFX Animation Editor Premium** (`boss-loot-assets-premium`), and therefore Sequencer and the BLFX
  asset pack. Without it, potions, consumables, traps, walls and areas use **JB2A** (free, `JB2A_DnD5e`) and
  **PSFX** (`psfx`) if present, otherwise **Token Magic FX** (`tokenmagic`), otherwise the built-in ring; nothing else
  is needed.
- With BLFX: in the Boss Loot module settings, tick **"BLFX Custom Auto-Rec Updates"**, then reload.
- Enable "DAS · Animations". On the next load, the console reports what was added.

## Translations

The module ships in English, French and Brazilian Portuguese (pt-BR translation by Henrique, [@henriquebot](https://github.com/henriquebot)). To add a language, copy `module/lang/en.json` to
`module/lang/<code>.json`, translate the values (keep the keys and the `{placeholders}` as they are), and add an
entry to `languages` in `module/module.json`. Any key missing from a translation falls back to English.

## Adding animations from another module

A module (campaign creatures, a supplement) can add its own entries alongside these, without touching this
repository:

```js
Hooks.once("init", () => {
  Hooks.once("darsh-animations.register", register => register("my-module", {
    animations: { "my-identifier": [{ trigger: "afterAttack", activity: "attack", alias: "weapon.claw" }] },
    without: { "other-identifier": "nothing to show" },     // optional
    sources: ["my-module.creatures"]                        // optional: compendiums to search for these items
  }));
});
```

The hook is called once, at `setup` (so before the `ready` sync). The same is available as a direct call:
`game.modules.get("darsh-animations")?.api.register(source, table)`, followed by `api.sync()` if it comes after
`ready`; `api.registered()` tells what is registered. The shape of an animation is documented at the top of
`module/scripts/data/animations.mjs`; a malformed animation is dropped and reported in the console.

## Development

- `npm test` — core, registry, tables (animations, traps, walls, consumables). Checks against the BLFX catalogue (existing aliases, animations and
  sounds) read `prive/docs/` and are skipped when those files are missing.
- `npm run catalogue` — regenerates `prive/docs/catalogue-blfx.json` and `prive/docs/blfx-autorec.json` from the
  local BLFX install (`FOUNDRY_DATA` for a path other than `F:/Foundry V14/Data`). Indexes of a premium module:
  not published.
- `npm run catalogue:libre` — regenerates `docs/catalogue-jb2a.json` and `docs/catalogue-psfx.json`: every
  animation of the free JB2A module and every PSFX sound registered in Sequencer, with size and duration (`ffprobe`,
  if installed). These two modules are free, so the catalogues are published; `npm test` checks every JB2A and PSFX
  name the module uses against them.
- `npm run noms:fr` — regenerates `module/names/fr.json` from the local `dnd5e_fr-FR` module.
- `npm run inventaire` — regenerates `prive/docs/inventaire.md` and `prive/docs/table.md` (what is covered, what
  is missing), from the sibling repositories.

In-game checks run through the DAS · Core scenario runner (MCP connector), from the engine's repository:
`node tools/scenario.mjs "../Foundry dnd5e animations/tools/scenarios"`.

## License

Code under the MIT license (see `LICENSE`). Works best with the premium Boss Loot (BLFX) module, which is not provided:
this module contains none of its files, only names of animations to request from it. Not affiliated with, nor
endorsed by, Wizards of the Coast.
