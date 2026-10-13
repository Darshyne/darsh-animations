/**
 * Le rendu autonome (SPEC §14) : quand ni BLFX ni Token Magic FX ne sont là, un anneau qui pulse autour du token, de la couleur de
 * l'humeur (vert positif, rouge négatif, bleu neutre). Rien n'est écrit dans un document : le MJ actif le dessine chez lui et le
 * diffuse par le socket du module (`module.json`, `socket: true`) ; chaque client le dessine sur son canevas, au-dessus des tokens
 * (`canvas.interface`), et seulement sur un token qu'il voit.
 *
 * Pas `canvas.ping` : il passe par l'activité de l'utilisateur (`game.user.broadcastActivity`, client/canvas/board.mjs:1871-1895),
 * qui déplace aussi le curseur du MJ chez tous les joueurs.
 */

import { MODULE_ID } from "./shared.mjs";
import { NATIVE } from "../data/consumables.mjs";

const SOCKET = `module.${MODULE_ID}`;

/** Dessine les anneaux sur ce client. `tokens` : uuids de tokens ; `color` : 0xRRGGBB. */
function draw({ tokens=[], color=0x40a0ff }={}) {
  if ( !canvas?.ready || !canvas.interface ) return 0;
  let drawn = 0;
  for ( const uuid of tokens ) {
    const token = fromUuidSync(uuid, { strict: false })?.object;
    if ( !token || (token.scene !== canvas.scene) || !token.visible ) continue;
    pulse(token, color);
    drawn++;
  }
  return drawn;
}

/** Un anneau qui s'élargit et s'efface, `NATIVE.rings` fois, autour du token. */
function pulse(token, color) {
  const g = new PIXI.Graphics();
  const { x, y } = token.center;
  g.position.set(x, y);
  canvas.interface.addChild(g);
  const size = Math.max(token.w, token.h);
  const start = performance.now();
  const total = NATIVE.duration * NATIVE.rings;
  const tick = () => {
    const elapsed = performance.now() - start;
    g.clear();
    if ( (elapsed >= total) || g.destroyed ) {
      canvas.app.ticker.remove(tick);
      if ( !g.destroyed ) g.destroy();
      return;
    }
    const t = (elapsed % NATIVE.duration) / NATIVE.duration;   // 0 → 1 dans chaque anneau
    const radius = size * (NATIVE.from + ((NATIVE.to - NATIVE.from) * t));
    const alpha = Math.sin(Math.PI * t);                       // apparaît, puis s'efface
    g.beginFill(color, 0.18 * alpha).drawCircle(0, 0, radius).endFill();
    g.lineStyle(NATIVE.width, color, 0.9 * alpha).drawCircle(0, 0, radius);
  };
  canvas.app.ticker.add(tick);
}

/** Chez le MJ actif : dessine chez soi et chez tous les autres clients. Rend le nombre d'anneaux dessinés ici. */
export function playNative(tokens, color) {
  const payload = { action: "pulse", tokens: tokens.map(t => t.document?.uuid ?? t.uuid).filter(Boolean), color };
  game.socket.emit(SOCKET, payload);
  return draw(payload);
}

export function registerNative() {
  game.socket.on(SOCKET, payload => {
    if ( payload?.action === "pulse" ) draw(payload);
  });
}
