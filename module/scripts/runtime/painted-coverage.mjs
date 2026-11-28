import { paintedEnabled, persistentRegion } from "./area-settings.mjs";
import { MODULE_ID } from "./shared.mjs";

let modules;
function paintedModules() {
  if (!modules) {
    const load = path => import(foundry.utils.getRoute("modules/painted-fx/scripts/" + path));
    modules = Promise.all([load("adapters/templates.js"), load("adapters/store.js"), load("engine/model.js")])
      .catch(error => { modules = null; throw error; });
  }
  return modules;
}

export function registerPaintedCoverage() {
  Hooks.on("createRegion", async region => {
    if (!game.users.activeGM?.isSelf || !paintedEnabled() || !persistentRegion(region)) return;
    if (region.parent !== canvas.scene || canvas.grid.isGridless) return;
    try {
      const [templates, store, model] = await paintedModules();
      if (region.parent.id !== store.stateSceneId() || !region.parent.regions.has(region.id)) return;
      const surface = templates.templateSurface(region);
      if (surface?.mode !== "fill") return;
      const regionObject = region.object ?? canvas.regions.get(region.id);
      const offsets = regionObject?._getCoveredGridSpaceOffsets?.();

      const level = [...(region.levels ?? [])][0] ?? store.viewLevel();
      const state = store.getState(level);
      if (!state) return;
      // Painted FX already processed its own cells in its create hook.
      const alreadyPainted = new Set(templates.templateCells(region));
      const missing = (offsets ?? []).map(({ i, j }) => i + "," + j).filter(key => !alreadyPainted.has(key));
      await region.setFlag(MODULE_ID, "paintedCoverage", { level, keys: [...alreadyPainted, ...missing] });
      if (!missing.length || !region.parent.regions.has(region.id)) return;
      const { state: next, events } = model.paint(store.getState(level) ?? state, missing, surface.paint, store.currentPaintCfg());
      store.setState(next, { snapshot: true, level });
      if (events.some(event => event.type === "cap")) ui.notifications.warn(game.i18n.localize("PFX.Notify.CellCap"));
      Hooks.callAll("painted-fx.painted", { keys: missing, paintType: surface.paint, variant: null, events, level });
    } catch (error) {
      console.warn(MODULE_ID + " | Painted FX coverage", error);
    }
  });
  Hooks.on("deleteRegion", async region => {
    const coverage = region.getFlag(MODULE_ID, "paintedCoverage");
    const legacy = region.getFlag("campagne-ajustements", "fx");
    if ((!coverage && !legacy) || !game.modules.get("painted-fx")?.active || !game.users.activeGM?.isSelf) return;
    try {
      const [templates, store, model] = await paintedModules();
      if (region.parent?.id !== store.stateSceneId()) return;
      const level = coverage?.level ?? [...(region.levels ?? [])][0] ?? store.viewLevel();
      const state = store.getState(level);
      if (!state) return;
      const occupied = new Set();
      for (const other of region.parent.regions) {
        if (other.id === region.id) continue;
        const tracked = other.getFlag(MODULE_ID, "paintedCoverage");
        if (tracked?.level === level) for (const key of tracked.keys) occupied.add(key);
      }
      const cells = (coverage?.keys ?? templates.templateCells(region)).filter(key => !occupied.has(key));
      const { state: next, removed } = model.erase(state, cells);
      if (removed) store.setState(next, { snapshot: true, level });
    } catch (error) {
      console.warn(MODULE_ID + " | Painted FX cleanup", error);
    }
  });

}
