# ENGINE API AND MODULE CONTRACTS

Everything lives on the global `PSA` object; files are classic scripts loaded in the order given in `index.html`.
Native canvas 384x216 (`PSA.W`, `PSA.H`). Times are seconds. Render functions must be pure functions of time.

## Tools (run from the repo root; they launch headless Chromium)
```
node tools/check.mjs                                    # page errors, missing shot renderers, render errors per shot, missing sfx
node tools/shot.mjs --t 12.5 --t 30                     # frames -> out/shots/t012.50.png (3x upscale). add --crop x,y,w,h --scale N
node tools/shot.mjs --shot S1b --n 6                    # contact sheet of a shot;  --sheet 45 70 --n 12 --cols 4 for a time range
node tools/shot.mjs --expr "<js using ctx,PSA,G,W,H,f>" --w 120 --h 80 --scale 5 --bg "#777" [--frames 4] --out out/shots/x.png
node tools/audio.mjs                                    # full soundtrack -> out/audio.wav + RMS report + spectrogram/waveform PNGs
node tools/audio.mjs --sfx clink --dur 2                # one sfx -> out/sfx_clink.wav (+ pngs);  --events lists scheduled sfx
node tools/render.mjs [--start 40 --end 70] [--out out/clip.mp4]   # MP4 export (frames + audio)
```
View PNGs with the Read tool. In `--expr`, `ctx` is a fresh native-style canvas of size W x H, `G = PSA.gfx`, `f` = frame index
when `--frames N` is given (the expression is evaluated once per frame, horizontally tiled).

## PSA.gfx (src/engine/gfx.js)
`px rect hline vline box line circle ellipse ring dither(ctx,x,y,w,h,c,density,phase) ditherCircle` — colors are palette keys
or css colors. `hash(a,b,c)`→[0,1) deterministic, `rng(seed)`→function, `clamp lerp span(t,a,b) smooth easeIn easeOut easeInOut
mix(c1,c2,t) shade(c,k) hexToRgb rgbToHex makeCanvas(w,h)`.

## PSA.sprite (src/engine/sprite.js)
Sprite def `{ pal: {char: colorKey}, rows: ['..##..', ...], ox?, oy? }` ('.'/' ' transparent). `PSA.sprite.make(rows, pal)` validates.
`PSA.sprite.draw(ctx, def, x, y, {flip, alpha})` top-left at (x,y); `PSA.sprite.drawFeet(ctx, def, cx, feetY, opts)` bottom-center.
`PSA.sprite.recolor(def, {char: color})`. Rasterized once and cached (also flipped).

## PSA.font / PSA.textbox
`PSA.font.text(ctx, str, x, y, {color, scale, align:'left'|'center'|'right', shadow, alpha})` → x after text.
`PSA.font.measure(str, scale)`, `PSA.font.lineHeight(scale)`, `PSA.font.wrap(str, maxWidth, scale)`,
`PSA.font.block(ctx, str, x, y, {maxWidth, scale, color, chars})` (word-wrapped, typewriter via chars).
`PSA.textbox.draw(ctx, {x,y,w,h,pad,text,chars,bullet,color,scale,alpha})`, `PSA.textbox.frame(ctx,x,y,w,h)`,
`PSA.textbox.charsAt(lt, cps)`, `PSA.textbox.emote(ctx, x, y, '!'|'?', lt)` (popup above a head; y = top of head),
`PSA.textbox.choice(ctx, {x,y,w,h,options:[..], cursor (fractional ok), alpha})`.

## PSA.light
`PSA.light.apply(ctx, state)` where state = `{tint, strength, vignette, warm}` (multiply tint + dithered vignette + warm wash).
`PSA.light.black(ctx, alpha)` fade overlay. `PSA.light.mix(a, b, t)`.

## PSA.story (src/scenes/story.js) — single source of truth
`PSA.story.shots` (list with id/start/end/in/note/text), `PSA.story.clock(t)` → `{h, m, minutes}` (24h, fractional minutes),
`PSA.story.clockLabel(t)` → '9:00 PM', `PSA.story.light(t)` → `{sky:'sunset'|'dusk'|'night'|'morning', phase:0..1, lampOn, state}`
(pass `.state` to `PSA.light.apply`, `.sky/.phase/.lampOn` to the room), `PSA.story.plate(t)` → where the plate is,
`PSA.story.INFO`, `QUESTION1`, `QUESTION2`, `TITLE`.

## PSA.timeline — shots
Scene modules register `PSA.shots['S1b'] = function (ctx, t, lt, shot) {...}` for each id in story.js and may add
`shot.sfx = [{t, name, args}]` (t relative to the shot start) by mutating `PSA.timeline.byId('S1b').sfx`.
During a 'cross' transition both neighbouring shots are rendered for ±dur/2 around the boundary, so renderers must tolerate
`lt` slightly < 0 or > (end-start). The engine draws the shot's story text boxes on top; it also crossfades them.

## PSA.LAYOUT (src/assets/layout.js) — world coordinates of the room
See the file: floorY=140 seam, table/plate/chair/clock/window/counter/stove/pot/fridge boxes, and `marks` (feet positions).
World width 448; a shot draws the room with `ctx.translate(-camX, 0)` (camX 0..64; wide shot = `PSA.LAYOUT.wideCam`).

## Asset module contracts (each in its own file, each sets one namespace)

### src/assets/girl.js → `PSA.girl`
```
PSA.girl.H = 52; PSA.girl.W = 20;
PSA.girl.draw(ctx, feetX, feetY, opts)
  opts.dir   : 'right' | 'left' | 'front' | 'back'             (left = mirrored right)
  opts.pose  : 'stand' | 'walk' | 'stir' | 'carry' | 'reach' | 'reachPlate' | 'sit' | 'sitEat' | 'sitBack' | 'sitHold' | 'yawn'
  opts.frame : integer animation frame (walk: 0..3, stir: 0..1, sitEat: 0..3, idle breathing: 0..1); default 0
  opts.face  : 'smile' (default) | 'neutral' | 'closed' | 'sleepy' | 'unsure'
  opts.blink : boolean (eyes closed for a blink frame)
  opts.item  : null | 'plate' | 'plateHalf' | 'spoon' | 'fork'   (drawn in her hands, aligned)
  opts.liftY : optional px offset of the carried item (for setting a plate down smoothly)
Poses: stand(all dirs), walk(all dirs, 4 frames), carry(all dirs: both hands in front holding a plate, walk 4 frames when
frame>=0 and opts.walking), stir(side: forward arm raised toward the pot, 2 frames), reach(side: forward arm extended up to a
shelf), reachPlate(side: like reach but holding the plate out), sit* (front view, seated upper body for behind the table:
drawn with its BASE (lap line) at feetY; sit = hands on the table edge, sitEat frames 0..3 = fork on the plate, lifting, at the
mouth, chewing (eyes closed), sitBack = leaning back content with hands down, sitHold = holding the fork up at chest, unsure),
yawn (front/side: hand to mouth, eyes closed).
PSA.girl.hand(opts) -> {x, y} offset (relative to feet) of the forward/right hand for the given pose/dir/frame, so scenes can
attach items. PSA.girl.headTop(opts) -> y offset of the top of the head (-52 normally, -30 for sit poses).
```

### src/assets/portrait.js → `PSA.portrait`
```
PSA.portrait.draw(ctx, cx, topY, { expr: 'smile'|'content'|'neutral'|'look'|'sniff'|'unsure'|'worried', frame, blink, lookDown })
Large head-and-shoulders view (~110 px tall, ~96 wide) of the girl, centered at cx, top of hair at topY. 'sniff' has 2 frames
(nose/brow motion); 'unsure' = furrowed brow, wavy mouth; eyes can look down at the plate (lookDown). Same design as the sprite.
PSA.portrait.H, PSA.portrait.W.
```

### src/assets/room.js → `PSA.room`
```
PSA.room.drawBack(ctx, camX, env)   // wall, wallpaper, baseboard, floor, rug, shelf+plant, lamp, clock (uses PSA.props.drawClock),
                                    // window (PSA.props.drawWindow with env.sky/phase), upper cabinets + hood, counter + stove + knobs,
                                    // small pot on the burner (PSA.props.drawPotSmall with env.potBoiling/steam), fridge
                                    // (PSA.props.drawFridge with env.fridgeOpen 0..1 and env.platesInFridge), chair back.
                                    // env = { sky, phase, lampOn, t, potOnStove:true, potBoiling:0..1, fridgeOpen:0..1,
                                    //         plateInFridge:false, lampLightPool:true }
PSA.room.drawTable(ctx, camX, env)  // the table (legs + top), and the plate on it if env.plateOnTable ('full'|'half'|null) with
                                    // optional steam (env.plateSteam 0..1) + the fork beside it (env.forkOnTable). Draw AFTER a
                                    // girl seated behind the table and BEFORE a girl standing in front of it.
PSA.room.drawFront(ctx, camX, env)  // anything that must be in front of everything (currently nothing / optional foreground)
PSA.room.lampPool(ctx, camX, env)   // the dithered warm light pool under the lamp (called by drawBack when env.lampOn)
```
Use `PSA.LAYOUT` for every position. The room must look good at camX = 0, 32 and 64.

### src/assets/props.js → `PSA.props` (kitchen & room props, small and LARGE close-up versions)
```
drawClock(ctx, cx, cy, r, h, m, {big:false})          // analog clock; r 11 (wall) or ~40 (close-up: all 12 marks, numerals optional)
drawWindow(ctx, x, y, w, h, {sky, phase, t, big})      // frame, curtains, sill; sky bands for 'sunset'|'dusk'|'night'(moon, stars)|'morning'
drawFridge(ctx, x, y, w, h, {open:0..1, light:true, plateInside:false, t})   // closed/opening/open; interior shelves + light when open
drawLamp(ctx, cx, {on:true})
drawPlant(ctx, x, y)                                  // small potted plant for the shelf/sill
drawPotSmall(ctx, cx, bottomY, {boiling:0..1, t, lid:false})
drawPotLarge(ctx, cx, bottomY, {boiling:0..1, t, pasta:0..1, stir:0..1, spoon:{x,y,angle}|null})   // ~160 px wide close-up pot with water/foam/bubbles/pasta
drawSteam(ctx, cx, baseY, t, {intensity:0..1, width, height, seed})          // deterministic dithered puffs rising
drawStoveCloseup(ctx, {t, flame:0..1})                // backsplash tiles, cooktop, burner ring + flame for close-ups (fills the frame region below the pot)
drawTileWall(ctx, x, y, w, h)                         // teal tile backsplash fill
```

### src/assets/food.js → `PSA.food` (the plate, pasta, fork, hand+fork, spoon, dry pasta bundle)
```
drawPlateSmall(ctx, cx, cy, {amount:1|0.5|0, steam:0..1, t})          // on the table (~18x8), seen from the room's oblique angle
drawPlateLarge(ctx, cx, cy, {amount:0..1, sauce:0..1, steam:0..1, t, fork:null|{x,y,angle}})   // ~150 px wide close-up, slight top-down 3/4 view
drawPastaMound(ctx, cx, cy, w, h, {amount, sauce, seed})             // used by the plate; strands with highlights, sauce patches, basil
drawForkLarge(ctx, x, y, {angle:'up'|'diag', pasta:0..1, t})          // close-up fork (~60 px) with optional twirled pasta on the tines
drawHandForkLarge(ctx, x, y, {pasta:0..1, t, frame})                  // the girl's hand (skin + sweater cuff) holding the fork, for the hesitation close-up
drawHandLarge(ctx, x, y, {pose:'holdBundle'|'open', frame})          // hand holding a bundle of dry spaghetti (for the pasta-into-pot close-up)
drawDryPasta(ctx, x, y, {spread:0..1, len})                           // dry spaghetti bundle, fanning out
drawSpoonLarge(ctx, x, y, {angle})                                     // wooden spoon for the stirring close-up
drawForkSmall(ctx, x, y)                                               // fork on the table, room scale
drawSauceLadle(ctx, x, y, {pour:0..1, t})                              // optional for the serving shot
```

### src/audio/synth.js + music.js → `PSA.synth`, `PSA.music.schedule(ctx, bus, t0)`
### src/audio/sfx.js → `PSA.sfx[name](ctx, bus, when, args)` — see docs in the files; names used by scenes are listed in
docs/SFX.md.
