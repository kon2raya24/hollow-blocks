// The CrazyGames SDK (v3), in the CrazyGames build only (portal.mjs): it is told when the game loads and
// when play starts and stops, so the portal can measure both. A Basic Launch shows no ads and uses no
// accounts, so that's all for now. Off CrazyGames' domains the SDK is 'disabled' and every call is skipped.
const SRC = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
let sdk = null, playing = false;
export async function initCrazy() {
  try {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = SRC; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    await window.CrazyGames.SDK.init();
    sdk = window.CrazyGames.SDK.environment === 'disabled' ? null : window.CrazyGames.SDK;
  } catch { sdk = null; }
  return !!sdk;
}
const said = []; // what the portal was told, for checking the build (window.__crazy)
if (typeof window !== 'undefined') window.__crazy = said;
const call = (name, f) => { said.push(name); try { f(); } catch { /* the portal's problem, not the game's */ } };
export function loading(on) { if (sdk) call(on ? 'loadingStart' : 'loadingStop', () => (on ? sdk.game.loadingStart() : sdk.game.loadingStop())); }
// on: is a piece of the game being played right now (not a menu, a pause or the results)
export function gameplay(on) { if (!sdk || on === playing) return; playing = on; call(on ? 'gameplayStart' : 'gameplayStop', () => (on ? sdk.game.gameplayStart() : sdk.game.gameplayStop())); }
