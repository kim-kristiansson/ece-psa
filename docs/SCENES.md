# SHOT-BY-SHOT DIRECTION

Times are absolute seconds (see src/scenes/story.js; `lt` = time since the shot's start). Each scene module registers
`PSA.shots[id]` for its ids and pushes SFX events onto `PSA.timeline.byId(id).sfx` (t relative to the shot start).
Use `PSA.story.light(t)` for sky/lamp/tint (always apply `PSA.light.apply(ctx, light.state)` AFTER drawing the world and BEFORE
UI/captions), `PSA.story.clock(t)` for every clock, `PSA.story.plate(t)` for the plate location in room shots.
Room shots: `const L = PSA.LAYOUT; const cam = ...; PSA.room.drawBack(ctx, cam, env); [girl behind table]; PSA.room.drawTable(ctx,
cam, env); [girl in front]; PSA.room.drawFront(...)`. The girl is drawn with `PSA.girl.draw(ctx, x - cam, y, opts)` (world x minus
camera). Camera moves: ease with `PSA.gfx.smooth`, round to integers, keep pans slow (≤ 24 px/s) — this is a cozy film.
Walking: 4-frame cycle at 8 fps (`frame = Math.floor(lt*8) % 4`), speed ≈ 28 px/s; one `footstep` sfx per contact frame
(every 0.25 s) while moving. Idle breathing: `frame = Math.floor(t*2) % 2`. Blink: `blink = (t % 3.7) < 0.12`.
Transitions between shots are handled by the engine (story.js: cross/fade/cut) — don't fade inside shots except where noted.
Nothing in a shot may change abruptly without a visible cause (e.g. the lamp turns on with a click sfx and a 1-frame flash).

## SCENE 1 — COOKING (0:00–0:25) — warm, cozy. src/scenes/s1_cooking.js
**S1a 0.0–9.5 WIDE** cam = L.wideCam. env: sky sunset, lampOn, potOnStove, potBoiling 1, plateOnTable null, fridge closed.
Girl at L.marks.stove, dir right, pose 'stir' (2 frames at 3 fps), face smile, blink. Small steam from the pot.
Fade in from black over 0–1.5 s (draw `PSA.light.black(ctx, 1 - smooth(lt/1.5))` as the last thing). Title overlay: the words
`PSA.story.TITLE` centered near the top (y≈22) in scale-2 font with a 1px 'ink' shadow, appearing 1.2–1.6 s (fade via alpha),
holding, fading out 4.0–4.6 s. The engine draws the narration box at 5.2–9.3. SFX: `boil` {dur: 9.5, level: 0.5} at 0.
**S1b 9.5–13.0 CLOSE-UP POT** Fill the frame: props.drawTileWall across the top half, the cooktop/burner with flame below
(props.drawStoveCloseup), the big pot (props.drawPotLarge, boiling 1, pasta 0) centered around (192, 160 bottom), steam rising
to the top of the frame (props.drawSteam intensity 1), soft light from the upper-left. A corner of the counter/a jar may show at
the edge for context. Bubbles animate. SFX: `boil` {dur: 3.6, level: 1} at 0.
**S1c 13.0–16.5 CLOSE-UP PASTA IN** Same backdrop and pot (keep the pot in the same place so the cut feels continuous). Her hand
enters from the top-right holding a bundle of dry spaghetti (food.drawHandBundle), lowers it to the water 13.3–14.6, the bundle
spreads (spread 0→1) and the strands slide/fan into the water (food.drawDryPasta with sink 0→1, 14.6–15.8), pot.pasta 0→0.6.
Hand withdraws 15.8–16.5. SFX: `splash` at 1.6, `boil` {dur: 3.5, level: 0.8} at 0.
**S1d 16.5–20.0 CLOSE-UP STIR** Same pot, pasta 1, boiling 0.8; the wooden spoon (food.drawSpoonLarge) held by her hand enters from
the right and stirs: spoon handle angle oscillates, pot.stir follows (swirl), steam. SFX: `stir` {dur: 3.4} at 0.1, `boil` low.
**S1e 20.0–25.0 CLOSE-UP SERVE** New composition: counter top close-up (props.drawCounterCloseup) with tile wall above, the LARGE
plate (food.drawPlateLarge) centered-right (cx≈220, cy≈150); 20.0–22.3 the pasta amount grows 0→1 as a fork/tongs lifts strands
in from the left (use food.drawForkLarge with pasta, moving in twice) — keep it simple and readable; 22.5–24.0 the ladle
(props.drawSauceLadle, pour) adds sauce (sauce 0→1); 24.0–25.0 steam rises from the plate, finished dish. SFX: `serve` at 1.0 and
2.0, `ladle` at 2.8.

## SCENE 2 — EATING AND LEAVING THE LEFTOVERS (0:25–0:45). src/scenes/s2_eating.js
**S2a 25.0–30.0 MEDIUM TABLE** cam = 0 (shows world 0..384: table, window, part of the counter). env: sunset (phase from story),
lampOn, plateOnTable null until she sets it down. The girl enters from the right side of the frame carrying the full plate
(pose 'carry', dir 'left', walking) along y = L.marks.tableSide.y from x≈230 to L.marks.tableSide.x (152) during 25.0–27.3;
turns (dir front), sets the plate on the table at 27.3–28.0 (use opts.liftY to lower the plate, then switch env.plateOnTable
'full' + plateSteam 1 and item null) — `plateSet` at 27.8; then she walks behind the table to the chair (dir 'left' then 'back'
briefly) 28.0–29.3 and sits (pose 'sit' at L.marks.tableSeat, drawn BEFORE drawTable) at 29.3; `chair` at 29.3. Clock shows 7:00.
**S2b 30.0–34.0 CLOSE-UP FORK** Table-top close-up: table wood (big planks) as background, the LARGE plate (amount 1 → 0.85),
her hand with the fork (food.drawHandForkLarge) comes from the bottom-right, twirls (grip 'twirl', pasta 0→1 on the tines, small
circular motion 30.4–32.2) and lifts the fork up out of frame 32.4–33.6. SFX: `forkPick` at 0.4, `forkClink` at 1.2 and 1.9.
**S2c 34.0–39.5 MEDIUM TABLE** Same camera as S2a. Girl seated (pose 'sitEat' frames: 34.0–35.2 bite 1, 35.6–36.8 bite 2, with
face 'closed' on the chew frames), `eat` at 0.9 and 2.5; plate amount 'half' from 36.8 (env.plateOnTable 'half', steam fading
0.3→0); 36.8–39.5 pose 'sitBack' (content, eyes closed smile). The engine shows her thought box "I'll put it away later." at
36.8–39.5 (continues into S2d).
**S2d 39.5–45.0 WIDE** cam = L.wideCam. 39.5–40.3 she stands up (pose 'stand' dir 'front' behind the table, drawn before the
table), `chair` at 0.1; 40.3–41.0 steps out from behind the table on the LEFT side (walk dir 'left' along a short path to
x≈44,y≈166), then walks left out of frame 41.0–44.0 (`footstep` per contact frame, soft). The plate ('half', no steam) and the
fork stay on the table; the fridge is visible and closed. The window shows the sunset deepening (story.light). Keep 44–45 still:
an empty room with the plate — that's the point of the shot.

## SCENE 3 — TIME PASSES (0:45–1:09) — cozy → mysterious. src/scenes/s3_time.js
**S3a 45.0–50.0 CLOSE-UP TABLE (evening)** A new, larger-scale composition of the table corner: table top planks across the
lower 60% of the frame, the LARGE plate (amount 0.5, no steam, same seed as everywhere) at (150, 150) with the large fork beside
it (food.drawForkLarge 'flat'); behind: the wall with the LARGE window (props.drawWindowLarge, sky from story) at the right
(x≈250, y≈10, w≈110, h≈120) and the BIG clock (props.drawClock r 30, time from story: 7:10 PM) on the wall upper-left (cx≈70,
cy≈50). Lamp light pool on the table (dithered lampLight ellipse) while lampOn. Apply story light. SFX: `tick` {level 0.35}
every 1.0 s from 0.5 (accent on every 4th).
**S3b 50.0–56.0 CLOCK CLOSE-UP** The BIG clock (r≈60, centered (192, 100)) on the wallpaper, hands advancing from 7:10 to 9:00
(story.clock(t) is already defined to do this linearly over 50–56: the minute hand sweeps ~2 turns, hour hand moves 7→9),
second hand sweeping. Below the clock a small caption box: `PSA.story.clockLabel(t)` in a mini text frame (black box, border),
e.g. "7:40 PM" updating live, settling on "9:00 PM". SFX: `tick` every 0.5 s (level 0.5 → 0.7), accents every 4th. Lighting:
apply story light (it cools during this shot).
**S3c 56.0–61.5 WIDE (room, darker)** cam = L.wideCam, env from story (sky night, lampOn still true until 61.5, plateOnTable
'half', no steam, forkOnTable). Nobody in the room. The wall clock moves 9:00 → 11:00 (story). Optional: at 60.8 the lamp pool
flickers once? NO — keep it calm. SFX: `tick` every 1 s level 0.45. At 61.4 `lightSwitch` (the lamp goes off as the shot ends —
story.light has lampOn=false from 61.5).
**S3d 61.5–69.0 CLOSE-UP TABLE (night)** Same composition as S3a but now the lamp is off: moonlight from the window
(sky night, phase 1), stronger story tint; the plate is the SAME (amount 0.5, same seed). The big clock on the wall reaches
12:00 (story: 11:00 → 12:00 during 61.5–65.5, then holds). A faint mini caption "12:00 AM" may appear under the clock from 65.5.
The engine draws the narration "* Midnight. The pasta has been out for 5 hours." at 64.5–69.0. SFX: `tick` every 1 s, level
0.55; `swell` {dur: 6} at 1.0 (very quiet low pad under the ticks).

## SCENE 4 — SHE PUTS IT AWAY (1:09–1:21) — late night, cool. src/scenes/s4_fridge.js
**S4a 69.0–74.5 WIDE→MEDIUM** cam starts at L.wideCam. 69.0–69.6 dark room (story lampOn false); at 69.6 `lightSwitch` and the
lamp is on (story.light handles the tint; draw a 2-frame brighter flash by adding warm 0.3 at 69.6–69.7). The girl walks in from
the left (dir 'right', face 'sleepy', walk) from x=-24 to x≈60 along y=166 during 69.8–72.0 with one 'yawn' pose beat at 70.2–70.9
(stop walking, `yawn` sfx); at 70.8 she notices the plate: `PSA.textbox.emote(ctx, headX, headTopY, '!', lt-1.8)` + `notice` sfx,
face 'neutral'. 71.4–72.5 she steps to the table's right end (L.marks.tableSide) and picks up the plate: pose 'reachPlate'
(dir 'left') then 'carry' with item 'plateHalf' at 72.5 (env.plateOnTable → null; the fork stays). 72.8–74.5 she walks right with
the plate (dir 'right', 'carry' walking) along y=166 toward x≈300 while the camera pans from 32 to 64 (smooth).
**S4b 74.5–81.0 MEDIUM FRIDGE** cam = 64 (fridge at screen x 312..356). She continues walking to L.marks.fridge (arrives 75.3),
pose 'reach' (dir right) at 75.3–75.6 as the door opens: env.fridgeOpen 0→1 over 75.4–76.0 with `fridgeOpen` at 0.9 (shot-rel),
`fridgeHum` {dur 3.2} at 1.0, fridge light on. 76.2–77.0 pose 'reachPlate' and the plate moves from her hands into the fridge
(animate the plate position from her hand to L.plateInFridge over 76.4–77.0, then env.plateInFridge true, item null). 77.3–78.5
pose 'reach' then 'stand' as the door closes (fridgeOpen 1→0 over 77.8–78.5, `fridgeClose` at 4.0). 78.8–80.0 she walks left
(dir 'left') out toward the left edge; at 80.0 `lightSwitch` and the lamp is off (story.light handles it); 80.0–81.0 dark still
room (the engine fades to black into S5a). Clock 12:06.

## SCENE 5 — THE NEXT DAY (1:21–1:51) — quiet, pale. src/scenes/s5_nextday.js
**S5a 81.0–86.0 WIDE morning** cam = L.wideCam. env: sky morning, lampOn false, plateOnTable null, forkOnTable false (she
cleared the fork — or keep it; your choice, but consistent with S5b), fridge closed. Narration "* The next morning." (engine,
82–85.2). The girl walks in from the left 82.6–85.8 (dir 'right', face 'neutral') along y=166 toward the fridge (x≈300 by 85.8),
camera pans 32→64 during 84.0–86.0.
**S5b 86.0–92.0 MEDIUM FRIDGE** cam = 64. She arrives at L.marks.fridge at 86.4; door opens 86.6–87.2 (`fridgeOpen` at 0.8,
`fridgeHum` {dur 2.6} at 0.9); 87.4–88.2 'reach' then the plate (half) comes OUT: animate from L.plateInFridge to her hand,
'reachPlate' → 'carry' item 'plateHalf' at 88.2 (env.plateInFridge false); door closes 88.6–89.3 (`fridgeClose` at 3.2); she
turns and walks left with the plate 89.4–91.0 to L.marks.tableSide (camera pans 64→0 during 89.4–91.2, smooth), sets the plate
down at 91.0–91.4 (`plateSet` at 5.3; env.plateOnTable 'half'), stands looking at it (pose 'stand' dir 'front' or 'left', face
'neutral') to 92.0.
**S5c 92.0–96.0 CLOSE-UP PLATE (morning)** The table close-up composition from S3a (same plate, amount 0.5, same seed, no steam,
morning sky in the large window, big clock 8:08 AM) — it looks normal, just matte; cold. Slight slow push-in is NOT possible
(pixel art) — instead let the shot breathe: nothing moves except a 2 px parallax of the fork? No: keep it still; subtle only.
SFX: none (quiet) except a very soft `swell` {dur 4} at 0.5.
**S5d 96.0–101.0 CLOSE-UP PORTRAIT** portrait backdrop (PSA.portrait.drawBackdrop) + PSA.portrait.draw centered (cx 192, topY
≈ 30): expr 'look' with lookDown 96.0–97.6; 'sniff' frames 97.6–99.0 (frame toggles at 4 fps, 1 px lean); 'unsure' from 99.0;
`PSA.textbox.emote(ctx, 192+34, topY-2, '?', t-99.5)` with `question` sfx at 3.5. Blink once. Apply story light (morning).
**S5e 101.0–107.0 CLOSE-UP HAND + FORK** Composition: the plate (LARGE, amount 0.5→0.45) low in the frame (cy≈190, partly cut by
the bottom edge), the table wood behind, her hand with the fork (food.drawHandForkLarge, pasta 1 on the tines) rising from the
plate (y 150 at 101.6) toward the top of the frame (her mouth is above the frame): y 150→60 during 101.6–104.2 with easeOut,
decelerating, then it STOPS at 104.5 and holds completely still (a 1 px tremble every 0.5 s is allowed, nothing more). SFX:
`forkPick` at 0.6. The music ducks at 104.5 (music module does this). Keep the composition clean: hand, fork, pasta, plate edge.
**S5f 107.0–111.5 CHOICE MENU** Same composition held (hand + fork still at the top). At 107.0 a text box appears at the bottom
(PSA.textbox.choice, options ['Eat it', 'Throw it out'], alpha fade-in 0.2 s). Cursor: starts at index 0 (107.3), slides to 1 at
108.6 (`menuMove` at 1.6), back to 0 at 110.0 (`menuMove` at 3.0), then stays at 0.4 (between) from 110.8 — undecided. The shot
ends with a HARD CUT to black (engine 'cut'). Nothing else happens; the hold is the suspense.

## SCENE 6 — THE QUESTION (1:51–2:01). src/scenes/s6_question.js
**S6a 111.5–116.5 BLACK** Pure black. At 112.2 `PSA.story.QUESTION1` ("WOULD YOU EAT IT?") appears centered at y≈92, scale 2,
uiText, typed at 14 chars/s with `blip` sfx per char (schedule in shot.sfx: kind 'narr', one per non-space char) — or appear
with a 0.4 s alpha fade if you prefer; then holds. `sting` at 0.6 (quiet, slow).
**S6b 116.5–121.5** First line stays; at 116.8 `PSA.story.QUESTION2` ("IT LOOKS FINE. BUT IS IT SAFE?") appears at y≈118,
scale 1 (it is longer) or scale 2 if it fits in 364 px (measure!), uiText, same typing style with blips. Hold. `swell` {dur 5} at 0.2.

## SCENE 7 — FOOD SAFETY INFO (2:01–2:15). src/scenes/s7_info.js
**S7 121.5–135.5** Dark background: 'black' or a very dark pixel-art panel (e.g. a subtle dithered '#0c0c14' texture + a thin
uiBorder frame inset 12 px) — minimal. Layout (centered column, max width 320 px, scale 1 text, generous line spacing):
  - 122.0: heading "FOOD SAFETY" scale 2 at y≈30, uiAccent color, with a 1px 'ink' shadow; `reveal` sfx.
  - 123.5: line 1 (PSA.story.INFO.lines[0], wrapped to ≤ 320 px, left-aligned bullet or centered), uiText; `reveal`.
  - 126.5: line 2; `reveal`.   - 129.5: line 3; `reveal`.
  - 132.5: slogan "WHEN IN DOUBT, THROW IT OUT." scale 2 (fits? 28 chars * ~12 px = ~340 px at scale 2 — if it doesn't fit, use
    two lines: "WHEN IN DOUBT," / "THROW IT OUT.") centered near the bottom (y≈170), uiAccent or uiRed, with a short emphasis
    animation (appears, then a 1 px bounce once); `reveal` + `sting` quiet at 11.0.
  Each line appears with a 0.3 s alpha fade or a 1-frame pixel reveal. Hold everything; fade to black 134.2–135.5
  (`PSA.light.black`). NOTHING else: no sources, URLs, credits, extra text.
Use `PSA.story.INFO` strings verbatim (the degree sign is ° and exists in the font).
