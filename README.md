# DAS · Animations (`darsh-animations`)

[![Tests](https://github.com/Darshyne/darsh-animations/actions/workflows/tests.yml/badge.svg)](https://github.com/Darshyne/darsh-animations/actions/workflows/tests.yml)

Part of **Darshyne's Automation Suite (DAS)**. BLFX (Boss Loot) animations for the abilities BLFX does not
recognise by itself: Ravenloft: The Horrors Within, third-party creatures, high-level Player's Handbook spells.

The module adds its animations to BLFX's **Custom Auto-Rec** when the world loads, on the GM's client; BLFX then
plays them. Your own custom animations are kept.

## Installation

In Foundry (or on The Forge), *Install Module* → paste the manifest URL:

```
https://github.com/Darshyne/darsh-animations/releases/latest/download/module.json
```

- Requires **BLFX Animation Editor Premium** (`boss-loot-assets-premium`), and therefore Sequencer and the BLFX
  asset pack.
- In the Boss Loot module settings, tick **"BLFX Custom Auto-Rec Updates"**, then reload.
- Enable "darsh-dnd · Animations". On the next load, the console reports what was added.

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

- `npm test` — core, registry and table. Checks against the BLFX catalogue (existing aliases, animations and
  sounds) read `prive/docs/` and are skipped when those files are missing.
- `npm run catalogue` — regenerates `prive/docs/catalogue-blfx.json` and `prive/docs/blfx-autorec.json` from the
  local BLFX install (`FOUNDRY_DATA` for a path other than `F:/Foundry V14/Data`). Indexes of a premium module:
  not published.
- `npm run inventaire` — regenerates `prive/docs/inventaire.md` and `prive/docs/table.md` (what is covered, what
  is missing), from the sibling repositories.

## License

Code under the MIT license (see `LICENSE`). Requires the premium Boss Loot (BLFX) module, which is not provided:
this module contains none of its files, only names of animations to request from it. Not affiliated with, nor
endorsed by, Wizards of the Coast.
