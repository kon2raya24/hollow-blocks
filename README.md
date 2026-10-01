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
- **Deadline:** clear forty rows as fast as you can, at noon, ## How it's made

- **The rules:** `src/game.mjs` is the pure, seeded, fixed 60 Hz simulation, unchanged by the 3D view: it only reads the state and the events.
- **The 3D view:** `src/view3d.mjs` is [three.js](https://threejs.org) (r186, bundled into `src/vendor/`, so it works offline; no build step).
  - **The well** is a steel-and-bamboo scaffold on a concrete slab (`src/site.mjs`). Behind the pieces hangs a dark shade net with chalk lines on each cell, and through it you can just make out the half-built wall the scaffold is for. On a wide screen the hold, the queue and a chalk tally hang on plywood boards beside it; on a phone, hold and next stand in a strip on the platform above it, so the well fills the screen.
  - **Every block is its material** (`src/blocks.mjs`), a bevelled block with colour, relief and roughness painted in code: kawayan culms (lying or standing, the way the piece fell), hollow blocks with their cores, courses of ladrilyo, painted corrugated yero, plywood veneer, a glossy baldosa under a clear coat, porous adobe, and wet mud. The ghost is a glowing outline.
  - **The site:** cement sacks on pallets, stacked hollow blocks, sand and gravel, rebar, a turning mixer, a wheelbarrow, a drum of water, and floodlights. Next door a house rises floor by floor, its top floor laid course by real course of hollow blocks as you clear rows. Behind it is the street: houses, Aling Nena's sari-sari store, electric poles, coconut trees.
  - **The light:** a sun with soft shadows and a photographed sky for image-based light, graded for golden hour, dusk, night, noon and a storm. `src/post.mjs` gives the film look: ambient occlusion, bloom, a grade per time of day, vignette and grain, heat haze at noon (never over the board), SMAA. It steps down on slow devices; `?gfx=0|1|2` pins the level.
  - **The juice** (`src/fx.mjs`): a cleared row bursts into chunks of its own materials that bounce on the slab, with dust and sparks; hard drops leave a streak; callouts for T-spins, back-to-backs and combos pop up in the world in gold, and a back-to-back sends a streak of sparks along the rows; a lost game brings the whole wall down. The results show the house you built, with its floor count.
  - **Kapatas** watches from the slab and talks: T-spins, back-to-backs, a long wait for a kawayan (and its arrival), a wall about to fall. On the Vercel deploy he's a motion-captured Mixamo man in a yellow hard hat (`src/foreman.mjs`): he idles, follows the falling piece with his head, cheers, throws his arms up for a Bayanihan, points at a new floor, frets when the wall gets high and slumps when it falls. Elsewhere he's made in code (`src/folk.mjs`), in a vest and hard hat, with procedural motion. The neighbours at the sari-sari store (`src/crowd.mjs`, Mixamo, Vercel only) jump up for a Bayanihan.
- **The camera** never moves while a piece is in play: it frames the well to fit the screen and only kicks a few centimetres on impacts. The cinematic shots play only while no piece is live, and the page stretches the rules' short pauses to fit them: a swoop in from the whole site as each game begins, a cut to the neighbours carrying a bahay kubo past the scaffold for a **Bayanihan**, and a look at the house when a floor is finished. Reduced motion (or the settings) turns them, the shake and the flashes off.
- **Sound:** Web Audio, through a limiter, with every recording brought to the same loudness and the tune mixed about 10 dB under the effects. Real recordings (CC0, [Kenney](https://kenney.nl)'s Impact Sounds) for each material landing and for a row breaking; the tune, the fanfare, the neighbours' cheer, rain, wind, thunder and the noon cicadas are synthesized.
- **Assets:** the scanned skies, surfaces and props are CC0 from [Poly Haven](https://polyhaven.com), converted with the tools in the Bakbakan repo, in `assets/env/`. The Mixamo foreman and neighbours (`assets/people/`) aren't in this repo (Mixamo's terms); they ship only in the Vercel deploy. Without any of them, the site is painted in code and plays the same.
- **No WebGL?** The game falls back to the original 2D board (`src/render.mjs`); `?flat=1` shows it.

in the heat haze.
- **Bagyo:** a storm, with rain, wind and lightning, and the flood pushes rows of wet, dripping mud up from below with a squelch, faster as you go, while brown water creeps over the site. Hold it off as long as you can.
- **Ayos (settings):** the ghost piece, the cutscenes, the camera angle (angled or straight), camera shake (full or reduced), music and effects volume, and graphics (auto, high, medium, low).

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
- **The offline cache:** every module, three.js and the sounds are precached.
- **Sanity floors:** from a bot (`src/bot.mjs`) that scores every placement with the classic El-Tetris weights.

The music is an original tune. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT. three.js is MIT licensed (`src/vendor/THREE-LICENSE`); the Kenney sounds and Poly Haven assets are CC0.
