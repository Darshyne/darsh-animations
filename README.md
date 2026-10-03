# darsh-dnd · Animations

Animations BLFX (Boss Loot) pour les capacités que BLFX ne reconnaît pas de lui-même : Ravenloft: The Horrors Within,
créatures tierces, sorts de haut niveau du Manuel des joueurs.

Le module ajoute ses animations à l'**Auto-Rec personnalisée** de BLFX, au chargement du monde, chez le MJ ; c'est ensuite
BLFX qui les joue. Vos propres animations personnalisées sont conservées.

## Installation

Dans Foundry (ou sur The Forge), *Installer un module* → coller l'URL de manifeste :

```
https://github.com/Darshyne/darsh-animations/releases/latest/download/module.json
```

- Requiert **BLFX Animation Editor Premium** (`boss-loot-assets-premium`), donc Sequencer et le pack d'assets BLFX.
- Dans les paramètres du module Boss Loot, cocher **« BLFX Custom Auto-Rec Updates »**, puis recharger.
- Activer « darsh-dnd · Animations ». Au chargement suivant, la console indique ce qui a été versé.

## Ajouter les animations d'un autre module

Un module (créatures d'une campagne, supplément) peut verser ses propres entrées avec celles-ci, sans toucher à ce dépôt :

```js
Hooks.once("init", () => {
  Hooks.once("darsh-animations.register", register => register("mon-module", {
    animations: { "mon-identifiant": [{ trigger: "afterAttack", activity: "attack", alias: "weapon.claw" }] },
    without: { "autre-identifiant": "rien à montrer" },     // facultatif
    sources: ["mon-module.creatures"]                       // facultatif : compendiums où chercher ces items
  }));
});
```

Le hook est appelé une fois, à `setup` (donc avant la synchronisation de `ready`). La même chose existe en appel direct :
`game.modules.get("darsh-animations")?.api.register(source, table)`, suivi de `api.sync()` s'il vient après `ready` ;
`api.registered()` dit ce qui est enregistré. La forme d'une animation est décrite en tête de
`module/scripts/data/animations.mjs` ; une animation mal formée est écartée et signalée dans la console.

## Développement

- `npm test` — cœur, registre et table. Les vérifications contre le catalogue BLFX (alias existants, animations et sons
  présents) lisent `prive/docs/` et sont sautées si ces fichiers manquent.
- `npm run catalogue` — régénère `prive/docs/catalogue-blfx.json` et `prive/docs/blfx-autorec.json` depuis l'installation
  locale de BLFX (`FOUNDRY_DATA` pour un autre chemin que `F:/Foundry V14/Data`). Index d'un module premium : non publiés.
- `npm run inventaire` — régénère `prive/docs/inventaire.md` et `prive/docs/table.md` (ce qui est couvert, ce qui manque),
  à partir des dépôts frères.

## Licence

Code sous licence MIT (voir `LICENSE`). Requiert le module premium Boss Loot (BLFX), qui n'est pas fourni : ce module
ne contient aucun de ses fichiers, seulement des noms d'animations à lui demander. Ni affilié à Wizards of the Coast
ni approuvé par elle.
