# STYLE GUIDE — "Small Mistakes, Big Risks" (pixel-art RPG food-safety PSA)

Read this fully before drawing anything. Every asset in the video must look like it belongs to ONE game.

## 0. The flat, Undertale-inspired look (style pass)
The film is drawn in an Undertale-inspired style: flat colors, a small palette, hard black outlines, no soft shading.
Assets are still drawn with the palette keys below, then `src/engine/style.js` turns every shot into the final look:
* every pixel snaps to `PSA.style.PALETTE` (one or two tones per material, plus black and white), with no dithering;
* lone pixels and checkerboard dither collapse into the surrounding color;
* where two clearly different colors meet, the darker side gets a 1px black outline.
`PSA.light.apply` runs the pass itself before tinting, so night/morning tints land on already-flat colors.
`PSA.FLAT` (src/engine/const.js) switches off the soft extras at the source: dither patterns become solid or vanish,
light pools, the vignette and wood-grain/speckle textures are not drawn. Set it to `false` and `PSA.style.enabled = false`
to get the previous soft look back. Nothing of Undertale itself is used: the palette, art, font and sounds are all original.

## 1. Canvas and pixel rules
* Native resolution **384 x 216** (16:9). The exporter upscales x5 with nearest-neighbour to 1920x1080. One native pixel = one
  5x5 block on screen. **Never** draw at sub-pixel positions, never use `ctx.arc`, gradients, shadows, `ctx.scale`, rotation,
  or anti-aliased primitives. Use `PSA.gfx` helpers (`rect`, `hline`, `vline`, `line`, `circle`, `ellipse`, `ring`, `dither`,
  `ditherCircle`, `box`) and `PSA.sprite.draw`. All coordinates integers (`| 0`).
* Transparency is only for engine-level transitions (crossfade / fade to black) and lighting tints. Art itself is opaque
  pixels on a transparent sprite background.
* **Colors come from `PSA.PAL`** (src/assets/palette.js) — use palette KEYS (`'skin'`, `'wood2'`, ...). Do not invent new
  hex colors unless unavoidable; if you must, pick something in the same warm, slightly desaturated register.
* Outlines: 1px, color `ink` (warm near-black) around characters and important props; furniture can use a darker shade of
  its own color (`wood4`, `cabinet3`, `fridge4`) instead of `ink` for a softer look. No pure black in artwork (UI boxes only).
* Shading: 2–3 tones per material (highlight / base / shade), light comes from the upper-left (and from the lamp when it is on).
* Dithering only for soft things: steam, light pools, dusk sky, vignette. Never dither skin or clothing.
* Everything must be deterministic: **never `Math.random()`** — use `PSA.gfx.hash(a,b,c)` or `PSA.gfx.rng(seed)` with
  seeds derived from time/frame indices so a frame rendered twice is identical.

## 2. Mood and palette use over time (see PSA.story.light)
* **Evening (0:00–0:45)**: warm — cream walls, warm wood, soft yellow pendant lamp, sunset in the window.
* **Dusk → night (0:45–1:10)**: engine applies a cooling multiply tint and vignette; the window goes purple → deep blue
  with a moon and a few stars; the lamp is switched off for the midnight shot (room lit only by moonlight).
* **Late night (1:10–1:20)**: the lamp is on again but the tint stays cool/dim.
* **Morning (1:20–1:50)**: pale, slightly cold daylight, quiet. No lamp.
Don't bake lighting into sprites: draw assets in neutral "evening" colors; the engine tints the whole frame.
Exception: the window sky and the fridge interior light, which are drawn by the asset with a `sky`/`light` parameter.

## 3. The girl (main character) — OFFICIAL DESIGN
She is an original character; keep her identical in every scene.
* **Height 52 px standing** (noticeably taller than a 16x24 chibi RPG sprite), width ~20 px (up to 26 with extended arms).
  Natural proportions ≈ 4.3 heads: head (incl. hair) 12 px, neck 2, torso 17, legs 18, shoes 3. Do NOT stretch a small sprite;
  draw her tall with slim limbs and a real neck.
* **Hair**: chestnut (`hair2` base, `hair1` highlight on the upper-left, `hair3` shade underneath), a chin-length bob with a
  side fringe, and a small teal hair clip (`clip`) on the left side of her head (screen-left when she faces the camera).
* **Face**: `skin` with `skinShade` under the chin/fringe; eyes 2 px wide x 2 px tall `eye` with a 1px `eyeWhite` highlight is
  optional; small `cheek` dot; mouth 1–3 px `mouth`. Expressions: relaxed smile (default), neutral, eyes-closed content smile,
  sleepy (half-closed eyes), unsure (one eyebrow raised, flat/wavy mouth).
* **Outfit** (never changes): mustard knitted sweater (`sweater2`, highlight `sweater1`, shade `sweater3`) with a folded cuff at
  the wrists and a rounded collar; dark blue jeans (`jeans2`, highlight `jeans1`, shade `jeans3`); brown shoes (`shoe1`/`shoe2`).
* **Anchor**: all poses are drawn relative to the FEET position (bottom-center). In every direction the head top is 52 px above
  the feet, the shoulder line is 38 px above the feet, the hands hang at ~22 px above the feet. Keep these constant across
  poses so she never changes height.
* **Movement**: 4-frame walk cycles (contact / pass / contact / pass) at 8 fps, 1 px vertical bob on the pass frames.
  Idle: 2-frame breathing (torso 1 px). Hands must visibly align with objects: a held plate sits in both hands in front of
  the torso; the stirring spoon goes from her forward hand into the pot; the fork goes from her hand to her mouth.

### Large close-up art of the girl (portrait, hand + fork)
Close-ups are separate, larger drawings at the SAME pixel size (1 native px) — they are "camera moved closer", drawn with
more detail, never an upscaled sprite. Keep the same hair shape, clip, sweater color/cuffs, skin tones, eye color.
Portrait (face + shoulders) ≈ 110 px tall. Hand + fork close-up: hand ≈ 40 px wide with the sweater cuff.

## 4. Props, food and the room
* The **plate of pasta** must be recognizably the same plate every time: round off-white plate (`plate1`, shadow `plate2`/
  `plate3`, a thin `plateRim` stripe), a mound of spaghetti (`pasta1..4`) with tomato sauce (`sauce1..3`) and two basil leaves.
  Small version for the room (≈ 18x8 px on the table), large version for close-ups (≈ 150 px wide). "Amount" 1.0 at serving,
  ≈ 0.5 after dinner (leftovers) — and that 0.5 state must look the SAME on the table at 7 PM, 9 PM, midnight, and next morning:
  no mold, no color change, no flies; the only difference is lighting and that steam stops after a few minutes.
* The **pot**: dark steel with a lighter rim and two handles; boiling water with foam and bubbles; steam puffs rising.
* Kitchen = sage-green cabinets, cream counter, teal tile backsplash, a white fridge with a handle, a pendant lamp with a warm
  dithered light pool, a round wall clock, a window with curtains, a shelf with a plant. Cozy, lived-in, tidy. No clutter.
* The **clock** is important: readable hands, 12/3/6/9 marks; the big close-up version has all hour marks and the hands are
  thick enough to read. Hands come from `PSA.story.clock(t)`.

## 5. Text and UI
* Bitmap font `PSA.FONT` (8 px, variable width). Text boxes: black fill, solid 3px white border, white text, every line
  starts with `* `. Spoken lines (`face:` in the story text spec) show a crop of her portrait at the left of the box.
  Typewriter at 30 letters/s, a short pause after `. , ! ?`, and one chip blip per letter (narrator low, her voice high).
  The choice menu highlights the option under the cursor in yellow; the cursor is a small red heart.
* Keep text short. The engine draws the story lines from `src/scenes/story.js`; scenes only draw extra UI (title, captions,
  the choice menu, the question and info screens).

## 6. What to avoid (from the brief)
blurry/scaled pixels, proportion changes between scenes, backgrounds that don't match the shot, floating or cut-off objects,
unnecessary characters/objects, bright flashy effects, horror effects, sudden unexplained visual changes, long text.
