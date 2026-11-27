import { MODULE_ID } from "../runtime/shared.mjs";
import { defaultAudioSources, audioSources, saveAudioSources } from "../runtime/audio-sources.mjs";
import { SOURCES_STYLE } from "./sources-window.mjs";

const text = key => foundry.utils.escapeHTML(game.i18n.localize(key));
const label = key => text("DARSHANIM.Sources." + key);
let app;

function openWindow() {
  const { ApplicationV2 } = foundry.applications.api;
  return new (class extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: MODULE_ID + "-audio-sources", tag: "form",
      window: { title: "DARSHANIM.Audio.sources", icon: "fa-solid fa-volume-high", resizable: true },
      position: { width: 520, height: "auto" },
      form: { handler: this.onSubmit, closeOnSubmit: true },
      actions: {
        up: function(_event, target) { this.move(target.closest("li").dataset.source, -1); },
        down: function(_event, target) { this.move(target.closest("li").dataset.source, 1); },
        reset: function() { this.value = defaultAudioSources(); this.render(); }
      }
    };
    value = audioSources();

    move(source, delta) {
      const order = this.value.order;
      const index = order.indexOf(source);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
      this.render();
    }

    static async onSubmit() {
      await saveAudioSources(this.value);
      ui.notifications.info(label("Saved"));
    }

    async _renderHTML() {
      const rows = this.value.order.map((source, index) => `
        <li data-source="${source}" draggable="true">
          <span class="grip"><i class="fa-solid fa-grip-vertical"></i></span>
          <span class="arrows">
            <button type="button" data-action="up" ${index === 0 ? "disabled" : ""} aria-label="${label("Up")}">&#8593;</button>
            <button type="button" data-action="down" ${index === this.value.order.length - 1 ? "disabled" : ""} aria-label="${label("Down")}">&#8595;</button>
          </span>
          <span class="name"><strong>${text("DARSHANIM.Audio.audio_" + source)}</strong></span>
          <label class="use"><input type="checkbox" data-off="${source}" ${this.value.off.includes(source) ? "" : "checked"}> ${label("Use")}</label>
        </li>`).join("");
      return `<style>${SOURCES_STYLE}</style><div class="das-sources">
        <ol class="order">${rows}</ol>
        <footer>
          <button type="button" data-action="reset">${label("Reset")}</button>
          <button type="submit">${label("Save")}</button>
        </footer></div>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
      super._onRender?.(context, options);
      for (const input of this.element.querySelectorAll("[data-off]")) {
        input.addEventListener("change", () => {
          const off = new Set(this.value.off);
          if (input.checked) off.delete(input.dataset.off);
          else off.add(input.dataset.off);
          this.value.off = [...off];
        });
      }
      for (const row of this.element.querySelectorAll("li[data-source]")) {
        row.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", row.dataset.source));
        row.addEventListener("dragover", event => event.preventDefault());
        row.addEventListener("drop", event => {
          event.preventDefault();
          const source = event.dataTransfer.getData("text/plain");
          const destination = row.dataset.source;
          if (!this.value.order.includes(source) || source === destination) return;
          const order = this.value.order.filter(id => id !== source);
          const box = row.getBoundingClientRect();
          order.splice(order.indexOf(destination) + Number(event.clientY > box.top + box.height / 2), 0, source);
          this.value.order = order;
          this.render();
        });
      }
    }
  })();
}

export function openAudioSources() {
  if (!app?.rendered) app = openWindow();
  return app.render({ force: true });
}
