// The Konami code (↑ ↑ ↓ ↓ ← → ← → B A). Typed during a game by a signed-in player, the bot takes over
// at 1×, 3× or 10×, and the same code hands the game back. Pure: main.mjs feeds it each key.
export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
export const AUTO_SPEEDS = [1, 3, 10];
// A matcher: feed it keys (e.key, letters lowercased); it answers true on the key that completes the code.
export function konami() {
  let i = 0;
  return (k) => {
    if (k === KONAMI[i]) { i++; if (i < KONAMI.length) return false; i = 0; return true; }
    i = k !== 'ArrowUp' ? 0 : i === 2 ? 2 : 1; // ↑ ↑ ↑ is still ↑ ↑ so far
    return false;
  };
}
