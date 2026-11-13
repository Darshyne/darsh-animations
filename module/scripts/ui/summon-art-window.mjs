/**
 * La petite fenêtre « Apparence de l'invocation » (SPEC §26), chez le client qui vient d'invoquer, quand la base de Sequencer offre
 * plus d'une variante (JB2A gratuit en offre quelques-unes, le Premium bien plus). L'image d'office est déjà posée sur le token ;
 * la fenêtre propose d'en changer : une liste des groupes (l'arme, pour l'Arme spirituelle), une liste des variantes du groupe, un
 * aperçu animé. Premier bouton : « Comme la dernière invocation » (ou « Garder celle-ci » la première fois), qui ne change rien.
 * Rend la variante choisie, ou null.
 */

const t = (key, data) => data ? game.i18n.format(`DARSHANIM.SummonArt.${key}`, data) : game.i18n.localize(`DARSHANIM.SummonArt.${key}`);
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const pretty = s => String(s ?? "").replace(/[_-]/g, " ");

const STYLE = `
.das-summon-art { display: flex; flex-direction: column; gap: 0.5rem; min-width: 300px; }
.das-summon-art .preview { display: flex; justify-content: center; align-items: center; height: 160px;
  background: radial-gradient(circle, rgba(60,60,70,0.9), rgba(10,10,15,0.95)); border-radius: 6px; }
.das-summon-art .preview video { max-height: 150px; max-width: 100%; }
.das-summon-art label { display: flex; align-items: center; gap: 0.5rem; }
.das-summon-art label > span { flex: 0 0 6rem; }
.das-summon-art select { flex: 1; }
.das-summon-art .hint { font-size: 0.85em; opacity: 0.8; margin: 0; }
`;

function content({ variants, current, grouped }) {
  const groups = grouped ? [...new Set(variants.map(v => v.group))] : [];
  const inGroup = grouped ? variants.filter(v => v.group === current.group) : variants;
  return `<style>${STYLE}</style><div class="das-summon-art">
    <div class="preview"><video src="${esc(current.file)}" autoplay loop muted playsinline></video></div>
    ${grouped ? `<label><span>${esc(t("Group"))}</span><select name="group">${groups.map(g =>
      `<option value="${esc(g)}"${g === current.group ? " selected" : ""}>${esc(pretty(g))}</option>`).join("")}</select></label>` : ""}
    <label><span>${esc(t("Variant"))}</span><select name="variant">${inGroup.map(v =>
      `<option value="${esc(v.name)}"${v.name === current.name ? " selected" : ""}>${esc(pretty(v.label))}</option>`).join("")}</select></label>
    <p class="hint">${esc(t("Hint", { count: variants.length }))}</p>
  </div>`;
}

/** Ouvre la fenêtre ; rend la variante choisie (objet de `variants`) ou null (fermée, ou « garder »). */
export async function askSummonArt({ entry, variants, current, hasLast=false, itemName="" }) {
  const DialogV2 = foundry.applications.api.DialogV2;
  const grouped = !!entry.group;
  const byName = new Map(variants.map(v => [v.name, v]));
  let picked = current;
  const result = await DialogV2.wait({
    window: { title: t("Title", { name: itemName }), icon: "fa-solid fa-wand-sparkles" },
    position: { width: 380 },
    modal: false, rejectClose: false,
    content: content({ variants, current, grouped }),
    buttons: [
      { action: "keep", label: t(hasLast ? "KeepLast" : "Keep"), icon: "fa-solid fa-clock-rotate-left", default: true },
      { action: "choose", label: t("Choose"), icon: "fa-solid fa-check", callback: () => picked }
    ],
    render: (event, dialog) => {
      const root = dialog.element;
      const video = root.querySelector(".preview video");
      const variantSelect = root.querySelector("select[name=variant]");
      const show = name => {
        picked = byName.get(name) ?? picked;
        if ( video && (video.getAttribute("src") !== picked.file) ) video.src = picked.file;
      };
      variantSelect?.addEventListener("change", ev => show(ev.target.value));
      root.querySelector("select[name=group]")?.addEventListener("change", ev => {
        const list = variants.filter(v => v.group === ev.target.value);
        variantSelect.innerHTML = list.map(v => `<option value="${esc(v.name)}">${esc(pretty(v.label))}</option>`).join("");
        if ( list[0] ) show(list[0].name);
      });
    }
  });
  return (result && (typeof result === "object")) ? result : null;
}
