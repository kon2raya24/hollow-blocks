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
- **Half turn (option):** **V**. Every key can be changed in Settings.
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
- **Laban (versus):** your well and a rival's, side by side on the site; the rival's scaffold stands on a raised deck next to yours, its name on a board on top. Clears send mud rows with one gap: 2 rows send 1, 3 send 2, a Bayanihan 4, a T-spin double 4 (single 2, triple 6), back-to-back adds 1, combos add more the longer they run, and a perfect clear sends 10. Incoming mud stacks up as sacks beside your well (amber while it waits, red once it's armed, after half a second) and comes up the next time a piece locks without a clear, at most eight rows at once; your own clears cancel it first. Play a quick match against **Baguhan**, **Bihasa** or **Kapatas**, or climb the **Liga ng Barangay**: six rivals (Totoy Bato, Aling Nena, Mang Berto, Bebang Bilis, Engr. Dado and Kapatas Rodel), each with a pace, a mistake rate, a style (a clean stacker, a Bayanihan builder, a speedster, a T-spinner) and their own trash talk. Each one you beat opens the next, and the ladder is saved.
- **Tapatan (two players, desktop):** two people on one computer, on the same versus rules. Player 1 plays on A/D/S/W with Q/E to turn and C to hold, player 2 on the arrows with , . to turn and / to hold; either can use a controller instead (or both, on two controllers), and every key can be remapped per player. Best of three rounds, with a round banner between them and a ceremony for the winner. Handicaps per player: how much mud their attacks send (×0.5 to ×2) and how many rows of rubble they start with. Hidden on phones.
- **Lingguhan (weekly event):** a twist for each ISO week (Manila time), the same for everyone, with no server: Bagyo Week, Lindol Week, Gamit Lang (every fourth piece banks a tool), Mabilis (20G: pieces fall at once) and Retro (no hold, no ghost, one next piece, no wall kicks). A banner on the title shows this week's event and counts down to the next. Each is three minutes for the most kita; finishing one earns its medal, and the first finish of a week banks a token (to spend in a later update).
- **Pagsasanay (training):** Kapatas's lessons: T-spin single, double and triple, the 4-wide combo, and finesse. Each has a set board, an instruction card, a gold ghost showing where the piece should go, a retry (R), and a pass check. The lessons teach what the hard contracts need, and the Diskarte, Sunod-sunod and Tatlong T-spin cards link to them.
- **Proyekto, Kabanata 2 (Sa Lungsod):** fifteen more contracts in Sta. Lucia, Maligaya and Bagumbayan, opened by finishing Ang Huling Bahay or by 30 stars. The new twists: **Brownout** (the well goes dark but for a flashlight cone on the piece, with the lights coming back now and then), **Hangin** (the piece drifts a column with the wind, and the gust turns), **Bitak** (every few pieces is cracked and crumbles a few placements later), **Lunes** (no kawayan at all), and **limited tools** (only the tools the contract hands you). The finale is the **City Inspector**: he walks in from the street, paces beside the well with his clipboard, stamps a REJECTED block on top of a column every few seconds, mud rises on a timer, and his inspection bar fills; finish three floors before it does. Clearing a stamp pushes his bar back three seconds.
- **Proyekto:** fifteen contracts across three barangays (San Roque, Malinta, Bagong Silang), each a job order from Kapatas with a goal and a twist: clear rows with only two holds, reach a floor against the clock, make T-spins, outlast the mud, clear a messy foundation in few pieces, earn ₱6,000 while a **lindol** (earthquake) slides the stack sideways every 30 seconds. Finishing earns a star, beating the par two or three; each contract opens the next, and 8 stars open the next barangay.

## Replays and the ghost

Every game is recorded as its seed and setup plus the input of each tick, stored as changes only and packed into a few kilobytes. Your best Deadline and Karera runs (per difficulty), your best Daily, and your last game are kept on the device. In Deadline and Karera, **Habulin ang multo** races your best run: a bar under the score shows you and the ghost, and how far ahead or behind you are. The replay viewer plays a run back at 1×, 2× or 4×, with pause; **Link** copies a URL whose hash is the replay (deflated and base64url), and opening that link plays it.

## Settings

Besides the graphics, sound, camera and ghost piece: how many next pieces show (1 to 6), DAS and ARR (by the difficulty unless you set them; ARR 0 goes straight to the wall), soft-drop speed, a 180° turn (V, with the SRS+ kicks), hold on or off, the finesse coach in every mode, and the ghost race. **Mga pindutan** remaps the keyboard (up to three keys per action) and the controller buttons, warns before taking a key another action uses, and resets to the defaults. Older saves carry over with the defaults filled in.

## Gamit (tools)

In Bahay, Karera and Proyekto, every 8 to 12 pieces one comes with a glowing **toolbox** in one cell. Clear the row it lands in (or make a Bayanihan) to bank a tool, up to three; **E**, the toolbox button or □ on a controller uses the oldest:
- **Martilyo** smashes the top block of each column under the piece.
- **Semento** pours into the covered holes in the bottom four rows.
- **Kreyn** swaps the piece for a kawayan, lowered on its hook.
- **Pison** rolls across and flattens every column to the median height.
- **Merienda** halves gravity for 15 seconds, with a clock over the well.

Three more open with rank:
- **Plumada** (plumb bob, from Kapatas): a blue ghost and a plumb bob show the best place for each of the next three pieces, chosen by the bot.
- **Barena** (drill, from Inhinyero): drills out the whole column under the middle of the piece.
- **Andamyo** (scaffolding, from Arkitekto): a hazard-striped scaffold floor goes up under the stack; it takes the next mud (a Bagyo row or a versus attack), or one top-out (the top of the stack comes down onto it), then breaks.

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
  - versus: the mud table, cancelling, armed mud coming up with one gap per attack, the ladder, the rivals getting harder, and a whole match replaying identically from its seed and your inputs (`test/versus.test.mjs`)
  - replays: Deadline, Karera and Daily runs (with rule options) replay to the exact final state and score, and the bytes and share text round-trip (`test/replay.test.mjs`)
  - training: each lesson's solution, played key by key, passes its check and a wrong move fails it; the finesse minimums for a sample of placements (`test/training.test.mjs`)
  - chapter 2: every twist, the Inspector's stamps, bar and relief, the unlock, and the bot earning a star on at least two of three seeds of every contract (`test/chapter2.test.mjs`)
  - the weekly event: the week to event mapping, ISO weeks, the countdown, and each event's rules (`test/weekly.test.mjs`)
  - the rank tools, and a game with the old toolset playing exactly as before (`test/tools2.test.mjs`)
  - Tapatan: keys routed to each player, each player's input reaching only their well, the handicaps, and a whole match replaying from both inputs (`test/tapatan.test.mjs`)
  - every module parses (`test/syntax.test.mjs`)
  - rule options: no options plays exactly as before; DAS, ARR, soft drop, hold off, the queue length, and the 180° turn with its kicks (`test/options.test.mjs`)
- **The offline cache:** every module, three.js and the sounds are precached.
- **Sanity floors:** from a bot (`src/bot.mjs`) that scores every placement with the classic El-Tetris weights. For versus it also finds T-spins (soft drop, then a last turn into a three-corner slot) and, in the T-spinner style, keeps T-slots open; the rivals are this bot, paced and given a mistake rate (`src/versus.mjs`).

**How v6 is built:** the rules stay pure. `src/versus.mjs` steps two games in lockstep and moves the mud; `src/replay.mjs` records, packs and plays back; `src/training.mjs` holds the lessons, a path finder for their solutions, and the finesse table (the fewest taps, holds and turns to each column and turn on an open board); `src/rival3d.mjs` builds the rival's scaffold, deck and mud sacks.

**v7:** chapter 2's twists, the Inspector, the weekly rulesets and the rank tools are all in the pure rules (`src/game.mjs`; events and toolsets in `src/progress.mjs`). `src/controls.mjs` routes keys to players. `src/inspector3d.mjs` is the Inspector, made in code like the neighbours. The view draws the brownout as a dark pane with a soft hole and a light cone, cracks as decals, and player 2's hold and next on a board beside their scaffold. In the wind the bot steers to its target instead of replaying keys, which is what sets chapter 2's pars.

The music is an original tune. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT. three.js is MIT licensed (`src/vendor/THREE-LICENSE`); the Kenney sounds and Poly Haven assets are CC0.
