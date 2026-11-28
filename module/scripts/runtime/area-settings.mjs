import { MODULE_ID } from "./shared.mjs";

const PAINTED = "painted-fx";
const AUTO = "templateAutoPaint";
const read = key => game.settings.get(MODULE_ID, key);
export const areaKeys = ["areaPainted", "areaOpacity", "areaHighlight", "areaColor"];

export function paintedActive() {
  return game.modules.get(PAINTED)?.active === true;
}

export function paintedEnabled() {
  return paintedActive() && game.settings.get(PAINTED, AUTO) === true;
}

export function persistentRegion(region) {
  const ref = region.flags?.dnd5e?.activity;
  if (!ref) return false;
  const duration = fromUuidSync(ref, { strict: false })?.duration;
  return !!duration?.units && !["inst", "instantaneous"].includes(duration.units)
    && Number(duration.value) > 0;
}

export const areaOpacity = () => read("areaOpacity");

export function registerAreaSettings() {
  const definitions = {
    areaPainted: { type: Boolean, default: true, onChange: async value => {
      if (game.user.isGM && paintedActive() && paintedEnabled() !== value) {
        await game.settings.set(PAINTED, AUTO, value);
        Hooks.callAll(MODULE_ID + ".areaRendererChanged");
      }
    }},
    areaOpacity: { type: Number, default: 1, range: { min: 0, max: 1, step: 0.05 } },
    areaHighlight: { type: Boolean, default: true },
    areaColor: { type: String, default: "" }
  };
  for (const [key, definition] of Object.entries(definitions)) {
    game.settings.register(MODULE_ID, key, { name: "DARSHANIM.Area." + key,
      scope: "world", config: true, ...definition });
  }

  Hooks.on("preCreateRegion", region => {
    if (!persistentRegion(region)) return;
    const change = {};
    change.visibility = read("areaHighlight") ? CONST.REGION_VISIBILITY.ALWAYS : CONST.REGION_VISIBILITY.LAYER;
    const color = read("areaColor").trim();
    if (/^#[a-f0-9]{6}$/i.test(color)) change.color = color;
    if (Object.keys(change).length) region.updateSource(change);
  });

  Hooks.on("renderApplicationV2", (_app, element) => {
    const input = key => [...element.querySelectorAll("input[data-key], select[data-key]")]
      .filter(node => node.dataset.key === MODULE_ID + "." + key);
    const painted = input("areaPainted")[0];
    if (!painted) return;
    const apply = () => {
      for (const node of input("areaOpacity")) node.disabled = paintedActive() && painted.checked;
    };
    painted.disabled = !paintedActive();
    painted.addEventListener("change", apply);
    apply();
  });
}
