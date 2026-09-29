# Hollow Blocks

**Buuin ang bahay!** It's the falling-block classic, Pinoy style, on a construction site.
- **The pieces** are building materials: kawayan, hollow blocks, ladrilyo, yero, plywood, baldosa and adobe.
- **Clear rows** to raise the building floor by floor. Four at once is a **BAYANIHAN**, and the neighbours carry a bahay kubo across the screen.
- **Kapatas**, the foreman, comments on how you're doing.

**Play:** https://hollow-blocks.vercel.app

## How to play

- **Keyboard:**
  - **← →** move and **↓** soft drops.
  - **↑** or **X** turns clockwise, and **Z** turns back.
  - **Space** hard drops, and **C** or **Shift** holds (*imbak*).
  - **P** pauses and **M** toggles sound.
- **Phone:** tap to turn, drag sideways to move, drag down to drop gently, flick down to drop hard, and flick up to hold. There's a row of buttons too.
- **Rules:** a 7-piece bag, standard rotation with wall kicks, a ghost showing where the piece will land, and lock delay with move resets.
- **Scoring (your *kita*, in pesos):**
  - 100, 300, 500 or 800 for 1–4 rows, times the level.
  - T-spins pay extra.
  - Back-to-back Bayanihan or T-spins pay half again.
  - Clears in a row add a combo bonus.

## Modes

- **Bahay:** endless. Every ten rows is a new floor, and faster. The sky goes from morning to night as the building rises.
- **Deadline:** clear forty rows as fast as you can.
- **Bagyo:** the flood pushes rows of mud up from below, faster as you go. Hold it off as long as you can.

**Difficulty:**
- **Madali:** slower falls and a longer grace period before a piece sticks.
- **Katamtaman:** the classic.
- **Mahirap:** starts on the sixth floor.

## Safety

Kapatas says it once before your first game: on a real construction site, always wear a hard hat, and children don't belong there.

## Run locally

```sh
python3 -m http.server 8000
```

Tests (Node 20+): `node --test test/*.test.mjs`.
- **The rules:**
  - the shapes and the bag
  - spawning, shifting with auto-repeat, and wall kicks
  - a T-spin double, gravity, soft and hard drops, and lock delay
  - clears, combos and back-to-back, hold, levels, the Deadline goal, the Bagyo flood, lock-out
  - exact replays
- **Sanity floors:** from a bot (`src/bot.mjs`) that scores every placement with the classic El-Tetris weights.

The music is an original tune. All art and sounds are drawn or synthesized in code. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
