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
swell or shrink…). Three renderers, in this order (world setting **"Effect renderer"**, *Auto* by default):

1. **Boss Loot (BLFX)** — drinking sounds, glows, splashes and signature animations from the BLFX asset pack;
2. **Token Magic FX** — a pulsing glow on the token (plus fade, blur, scale, bloom or shockwave), which removes
   itself;
3. **Built-in** — with neither module: a coloured ring pulsing around the token, **green** for a beneficial effect,
   **red** for a harmful one, **blue** for a neutral one.

Traps follow the same order when BLFX is missing (a red glow and shockwave, or a red ring, on each victim). Spell
walls and the Custom Auto-Rec need BLFX.

## Installation

In Foundry (or on The Forge), *Install Module* → paste the manifest URL:

```
https://github.com/Darshyne/darsh-animations/releases/latest/download/module.json
```

- Recommended: **BLFX Animation Editor Premium** (`boss-loot-assets-premium`), and therefore Sequencer and the BLFX
  asset pack. Without it, potions, consumables and traps use **Token Magic FX** (`tokenmagic`) if present, otherwise the
  built-in ring; nothing else is needed.
- With BLFX: in the Boss Loot module settings, tick **"BLFX Custom Auto-Rec Updates"**, then reload.
- Enable "DAS · Animations". On the next load, the console reports what was added.

## Translations

The module ships in English and French. To add a language, copy `module/lang/en.json` to
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
- `npm run inventaire` — regenerates `prive/docs/inventaire.md` and `prive/docs/table.md` (what is covered, what
  is missing), from the sibling repositories.

In-game checks run through the DAS · Core scenario runner (MCP connector), from the engine's repository:
`node tools/scenario.mjs "../Foundry dnd5e animations/tools/scenarios"`.

## License

Code under the MIT license (see `LICENSE`). Works best with the premium Boss Loot (BLFX) module, which is not provided:
this module contains none of its files, only names of animations to request from it. Not affiliated with, nor
endorsed by, Wizards of the Coast.
