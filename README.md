# Hollow Blocks

**Buuin ang bahay!** It's the falling-block classic, Pinoy style, on a real 3D construction site in a barangay at golden hour.
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
- **Controller** (any gamepad the browser sees, PlayStation included): the d-pad or left stick moves and drops gently, **up** drops hard, **✕/A** turns, **○/B** turns back, **△/Y** or a shoulder button holds, **Options/Start** pauses. In the menus the d-pad moves between buttons, ✕ presses and ○ goes back.
- **Rules:** a 7-piece bag, standard rotation with wall kicks, a ghost showing where the piece will land, and lock delay with move resets.
- **Scoring (your *kita*, in pesos):**
  - 100, 300, 500 or 800 for 1–4 rows, times the level.
  - T-spins pay extra.
  - Back-to-back Bayanihan or T-spins pay half again.
  - Clears in a row add a combo bonus.

## Modes

- **Bahay:** endless. Every ten rows is a new floor, and faster. It starts at golden hour; as the house rises the sun sets, and past the fifth floor the crew works on under floodlights. Every fifth floor finishes a house: the neighbours cheer and a line of banderitas goes up.
- **Deadline:** clear forty rows as fast as you can, at noon, in the heat haze.
- **Bagyo:** a storm, with rain, wind and lightning, and the flood pushes rows of wet, dripping mud up from below with a squelch, faster as you go, while brown water creeps over the site. Hold it off as long as you can.
- **Karera:** two minutes, the most kita wins.
- **Daily:** two minutes on the same pieces as everyone else today (by Manila date), with your best kept and a spoiler-free result to share.
- **Proyekto:** fifteen contracts across three barangays (San Roque, Malinta, Bagong Silang), each a job order from Kapatas with a goal and a twist: clear rows with only two holds, reach a floor against the clock, make T-spins, outlast the mud, clear a messy foundation in few pieces, earn ₱6,000 while a **lindol** (earthquake) slides the stack sideways every 30 seconds. Finishing earns a star, beating the par two or three; each contract opens the next, and 8 stars open the next barangay.

## Gamit (tools)

In Bahay, Karera and Proyekto, every 8 to 12 pieces one comes with a glowing **toolbox** in one cell. Clear the row it lands in (or make a Bayanihan) to bank a tool, up to three; **E**, the toolbox button or □ on a controller uses the oldest:
- **Martilyo** smashes the top block of each column under the piece.
- **Semento** pours into the covered holes in the bottom four rows.
- **Kreyn** swaps the piece for a kawayan, lowered on its hook.
- **Pison** rolls across and flattens every column to the median height.
- **Merienda** halves gravity for 15 seconds, with a clock over the well.

Tools are off in Deadline, Bagyo and the Daily, so those results stay comparable.

## Progress

Every game earns XP, and the ranks run **Peon, Mason, Kapatas, Inhinyero, Arkitekto**; a rank-up is a small ceremony and unlocks a style for the house next door (apartment, bahay kubo, bahay na bato, condo tower), picked on the stats page. There are twelve medals (a first Bayanihan, a T-spin triple, a 10-combo, a perfect clear, all the stars in a barangay…) and a page of totals. Everything is kept on your device; older saves carry over.

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
  - every contract winnable: the bot plays each at a strong player's pace and must earn a star; the pars come from those runs, so three stars means matching it (Diskarte, Sunod-sunod and Tatlong T-spin need T-spins and combos the bot doesn't play, so their pars are set by hand) (`test/contracts.test.mjs`)
  - every tool, the toolboxes and the inventory, time limits, the lindol, rubble setups, each contract's goals and stars, the Daily seed, XP, ranks and medals (`test/modes.test.mjs`)
- **The offline cache:** every module, three.js and the sounds are precached.
- **Sanity floors:** from a bot (`src/bot.mjs`) that scores every placement with the classic El-Tetris weights.

The music is an original tune. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT. three.js is MIT licensed (`src/vendor/THREE-LICENSE`); the Kenney sounds and Poly Haven assets are CC0.
