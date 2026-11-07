/**
 * La fenêtre « Sources d'animation » (SPEC §23), ouverte par un bouton de menu des réglages du module (le MJ seul) ; dans la fenêtre de
 * réglages de la suite DAS, ce bouton devient un outil de l'onglet du module, sans rien déclarer de plus. Trois parties : ce qui est
 * détecté, l'ordre des sources (glisser-déposer ou flèches, case pour couper), et, par domaine, la source qui jouera. Rien n'est
 * écrit avant « Enregistrer ».
 */

import { MODULE_ID } from "../runtime/shared.mjs";
import { detection, saveSources, sourcesValue } from "../runtime/sources.mjs";
import { DOMAINS, defaultSources, detectionNotes, moveSource, normalizeSources, placeSource, sourceTable } from "../core/sources.mjs";

const t = (key, data) => data ? game.i18n.format(`DARSHANIM.Sources.${key}`, data) : game.i18n.localize(`DARSHANIM.Sources.${key}`);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Les modules derrière chaque source, pour la ligne de détection. */
const SOURCE_MODULES = Object.freeze({
  blfx: ["boss-loot-assets-premium"],
  aa: ["autoanimations"],
  jb2a: ["jb2a_patreon", "JB2A_DnD5e", "psfx"],
  tokenmagic: ["tokenmagic"],
  native: []
});

const STYLE = `
.das-sources { display: flex; flex-direction: column; gap: 0.75rem; }
.das-sources h3 { margin: 0.25rem 0 0; border-bottom: 1px solid var(--color-border, #7a7971); font-size: 1.05em; }
.das-sources .hint { font-size: 0.85em; opacity: 0.8; margin: 0; }
.das-sources .notes { display: flex; flex-direction: column; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.das-sources .notes li { padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.9em; }
.das-sources .notes .warn { background: rgba(200, 80, 40, 0.18); border-left: 3px solid #c85028; }
.das-sources .notes .info { background: rgba(80, 130, 200, 0.14); border-left: 3px solid #5082c8; }
.das-sources ol.order { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
.das-sources ol.order li { display: grid; grid-template-columns: 1.5rem 1.5rem 1fr auto auto; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.5rem; border: 1px solid var(--color-border-light-2, #8884); border-radius: 5px; background: rgba(0,0,0,0.04); }
.das-sources ol.order li.dragging { opacity: 0.4; }
.das-sources ol.order li.over { outline: 2px dashed var(--color-warm-2, #ff6400); }
.das-sources ol.order li.unavailable .name { opacity: 0.55; }
.das-sources .grip { cursor: grab; opacity: 0.6; text-align: center; }
.das-sources .rank { font-weight: bold; text-align: center; }
.das-sources .name strong { display: block; }
.das-sources .name small { display: block; opacity: 0.8; }
.das-sources .name small.role { opacity: 0.65; font-style: italic; }
.das-sources .badge { font-size: 0.75em; padding: 0.05rem 0.4rem; border-radius: 3px; margin-left: 0.3rem; white-space: nowrap; }
.das-sources .badge.on { background: rgba(60, 160, 80, 0.25); }
.das-sources .badge.idle { background: rgba(200, 160, 40, 0.25); }
.das-sources .badge.missing { background: rgba(128, 128, 128, 0.25); }
.das-sources .arrows { display: flex; gap: 0.15rem; }
.das-sources .arrows button { width: 1.6rem; height: 1.6rem; padding: 0; line-height: 1; }
.das-sources label.use { display: flex; align-items: center; gap: 0.25rem; font-size: 0.85em; white-space: nowrap; }
.das-sources table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
.das-sources th, .das-sources td { text-align: left; padding: 0.25rem 0.4rem; border-bottom: 1px solid var(--color-border-light-2, #8883); vertical-align: top; }
.das-sources td.src { font-weight: bold; white-space: nowrap; }
.das-sources td.src.none { font-weight: normal; opacity: 0.6; }
.das-sources td .remark { display: block; font-size: 0.85em; opacity: 0.85; }
.das-sources footer { display: flex; gap: 0.5rem; }
.das-sources footer button { flex: 1; }
`;

/** La fenêtre, construite à la demande (les classes de Foundry n'existent qu'après le chargement). */
let AppClass = null;
function SourcesApp() {
  if ( AppClass ) return AppClass;
  const { ApplicationV2 } = foundry.applications.api;
  AppClass = class extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${MODULE_ID}-sources`,
      tag: "form",
      classes: ["das-sources-window"],
      window: { title: "DARSHANIM.Sources.Title", icon: "fa-solid fa-layer-group", resizable: true },
      position: { width: 680, height: "auto" },
      form: { handler: this.onSubmit, closeOnSubmit: true },
      actions: {
        up: function(event, target) { this.move(target.closest("li").dataset.source, -1); },
        down: function(event, target) { this.move(target.closest("li").dataset.source, 1); },
        reset: function() { this.value = defaultSources(); this.render(); }
      }
    };

    value = sourcesValue();

    move(source, delta) {
      this.value = moveSource(this.value, source, delta);
      this.render();
    }

    static async onSubmit() {
      await saveSources(this.value);
      ui.notifications.info(t("Saved"));
    }

    async _renderHTML() {
      return renderBody(this.value, detection());
    }

    _replaceHTML(result, content) {
      content.innerHTML = result;
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      // Les cases changent la valeur en mémoire et redessinent le tableau.
      root.querySelectorAll("input[data-off]").forEach(input => input.addEventListener("change", () => {
        const off = new Set(this.value.off);
        if ( input.checked ) off.delete(input.dataset.off); else off.add(input.dataset.off);
        this.value = normalizeSources({ ...this.value, off: [...off] });
        this.render();
      }));
      root.querySelectorAll("input[data-domain]").forEach(input => input.addEventListener("change", () => {
        this.value = normalizeSources({ ...this.value, domains: { ...this.value.domains, [input.dataset.domain]: input.checked } });
        this.render();
      }));
      // Glisser-déposer des sources.
      let dragged = null;
      root.querySelectorAll("ol.order li").forEach(li => {
        li.addEventListener("dragstart", event => {
          dragged = li.dataset.source;
          li.classList.add("dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", dragged);
        });
        li.addEventListener("dragend", () => li.classList.remove("dragging"));
        li.addEventListener("dragover", event => { event.preventDefault(); li.classList.add("over"); });
        li.addEventListener("dragleave", () => li.classList.remove("over"));
        li.addEventListener("drop", event => {
          event.preventDefault();
          li.classList.remove("over");
          const source = dragged ?? event.dataTransfer.getData("text/plain");
          if ( !source || (source === li.dataset.source) ) return;
          // Déposé sur la moitié basse : après cette ligne.
          const box = li.getBoundingClientRect();
          const after = event.clientY > box.top + (box.height / 2);
          const rest = this.value.order.filter(s => s !== source);
          const target = rest[rest.indexOf(li.dataset.source) + (after ? 1 : 0)] ?? null;
          this.value = placeSource(this.value, source, target);
          this.render();
        });
      });
    }
  };
  return AppClass;
}

/** L'état d'un module, pour un badge. */
function badge(mod) {
  if ( !mod?.installed ) return `<span class="badge missing">${t("State.Missing")}</span>`;
  if ( !mod.active ) return `<span class="badge idle">${t("State.Inactive")}</span>`;
  return `<span class="badge on">${t("State.Active")}${mod.version ? ` ${esc(mod.version)}` : ""}</span>`;
}

/** La ligne de détail d'une source : ses modules et leur état. */
function sourceDetail(source, det) {
  const mods = SOURCE_MODULES[source];
  if ( !mods.length ) return esc(t("Detail.native"));
  return mods.map(id => {
    const mod = det.modules[id];
    return `${esc(mod?.title ?? id)}${badge(mod)}`;
  }).join(" · ");
}

function renderBody(value, det) {
  const v = normalizeSources(value);
  const notes = detectionNotes({ modules: det.modules, sequencer: det.sequencer, blfxCustomUpdates: det.blfxCustomUpdates,
    blfxAutoRec: det.blfxAutoRec });
  const noteItems = notes.map(n => `<li class="${n.level}">${esc(t(`Notes.${n.key}`, n.data?.id ? { id: det.modules[n.data.id]?.title ?? n.data.id } : n.data))}</li>`).join("");
  const rows = v.order.map((source, i) => {
    const usable = det.available[source];
    const on = !v.off.includes(source);
    return `<li data-source="${source}" draggable="true" class="${usable ? "" : "unavailable"}">
      <span class="grip"><i class="fa-solid fa-grip-vertical"></i></span>
      <span class="rank">${i + 1}</span>
      <span class="name"><strong>${esc(t(`Source.${source}`))}</strong><small>${sourceDetail(source, det)}</small>
        <small class="role">${esc(t(`Role.${source}`))}</small></span>
      <label class="use"><input type="checkbox" data-off="${source}" ${on ? "checked" : ""}> ${esc(t("Use"))}</label>
      <span class="arrows">
        <button type="button" data-action="up" ${i === 0 ? "disabled" : ""} data-tooltip="${esc(t("Up"))}"><i class="fa-solid fa-arrow-up"></i></button>
        <button type="button" data-action="down" ${i === v.order.length - 1 ? "disabled" : ""} data-tooltip="${esc(t("Down"))}"><i class="fa-solid fa-arrow-down"></i></button>
      </span>
    </li>`;
  }).join("");
  const table = sourceTable(v, det.available).map(row => {
    const remarks = row.notes.filter(n => n !== "off").map(n => `<span class="remark">${esc(t(`Table.${n}`))}</span>`).join("");
    const capable = row.capable.map(s => t(`Short.${s}`)).join(", ");
    const src = row.on ? (row.source ? esc(t(`Short.${row.source}`)) : esc(t("Table.none"))) : esc(t("Table.offShort"));
    return `<tr>
      <td><label><input type="checkbox" data-domain="${row.domain}" ${row.on ? "checked" : ""}> ${esc(t(`Domain.${row.domain}`))}</label></td>
      <td class="src ${row.on && row.source ? "" : "none"}">${src}</td>
      <td>${esc(capable)}${remarks}</td>
    </tr>`;
  }).join("");
  return `<style>${STYLE}</style>
  <div class="das-sources">
    <p class="hint">${esc(t("Intro"))}</p>
    <h3>${esc(t("Detection"))}</h3>
    ${noteItems ? `<ul class="notes">${noteItems}</ul>` : `<p class="hint">${esc(t("AllGood"))}</p>`}
    <h3>${esc(t("Order"))}</h3>
    <p class="hint">${esc(t("OrderHint"))}</p>
    <ol class="order">${rows}</ol>
    <h3>${esc(t("Domains"))}</h3>
    <p class="hint">${esc(t("DomainsHint"))}</p>
    <table>
      <thead><tr><th>${esc(t("Table.domain"))}</th><th>${esc(t("Table.source"))}</th><th>${esc(t("Table.capable"))}</th></tr></thead>
      <tbody>${table}</tbody>
    </table>
    <footer>
      <button type="button" data-action="reset"><i class="fa-solid fa-rotate-left"></i> ${esc(t("Reset"))}</button>
      <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${esc(t("Save"))}</button>
    </footer>
  </div>`;
}

/** Ouvre la fenêtre (MJ). */
export function openSources() {
  return new (SourcesApp())().render({ force: true });
}

/** Le bouton de menu des réglages du module (aussi un outil de la fenêtre de réglages DAS). */
export function registerSourcesMenu() {
  game.settings.registerMenu(MODULE_ID, "sourcesMenu", {
    name: "DARSHANIM.Sources.Menu.Name", label: "DARSHANIM.Sources.Menu.Label", hint: "DARSHANIM.Sources.Menu.Hint",
    icon: "fa-solid fa-layer-group", restricted: true,
    type: class extends foundry.applications.api.ApplicationV2 {
      // Foundry instancie le type du menu : on ouvre la vraie fenêtre à la place.
      render() { openSources(); return this; }
    }
  });
}

export { DOMAINS };
