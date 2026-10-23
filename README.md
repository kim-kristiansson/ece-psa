# Small Mistakes, Big Risks — a pixel-art RPG food safety PSA

A ~2 minute, 1920×1080 animated public service announcement about leaving cooked food at room temperature, told as a tiny
retro-RPG story in an Undertale-inspired style (flat original pixel art with hard outlines, an original chiptune score and
chip sound effects, typed RPG text boxes with a blip per letter). The animation is a linear film:
it plays automatically from beginning to end; the RPG "choice menu" near the end is part of the animation, not interactive.

## Watch the finished video
**`dist/psa.mp4`** — the finished PSA (H.264 + AAC, 1920×1080, 30 fps, 2:22). It is produced by the exporter below
(`npm run render` writes `out/psa.mp4`; copy it to `dist/` to update the committed version).

## Play it in a browser
The project is plain HTML5 canvas + Web Audio, no dependencies:

```
npm run dev            # or: node tools/server.mjs 8080
# open http://localhost:8080/
```
Browsers only allow sound after a click, so the page shows one "click to play with sound" prompt; after that the whole story
plays through on its own. (Opening `index.html` directly from disk also works in most browsers.)

## Export the MP4 (frames + synchronized audio)
Requires Node 18+, ffmpeg, and Playwright's Chromium (`npm install` once, which installs Playwright; if Chromium is missing run
`npx playwright install chromium`).
If you already have a Chromium build, point the tools at it with `PSA_CHROMIUM=/path/to/chrome` instead.
```
npm run render                               # -> out/psa.mp4
node tools/render.mjs --start 40 --end 70    # a clip, for checking a section
node tools/audio.mjs                         # soundtrack only -> out/audio.wav (+ level report, spectrogram)
node tools/shot.mjs --t 12.5                 # a single frame -> out/shots/
node tools/shot.mjs --sheet 0 135 --n 24     # contact sheet of the whole film
node tools/check.mjs                         # sanity check (page errors, missing shots/sfx)
```
Frames are rendered at the native 384×216 pixel grid and upscaled ×5 with nearest-neighbour, so the pixels stay crisp.
The audio is rendered offline with the same scheduling code the browser uses, so it stays in sync with the frames.

## Project layout
```
index.html               page + script load order
src/engine/              pixel drawing helpers, sprite maps, bitmap font renderer, text boxes, lighting, timeline/transitions
src/assets/              palette, room layout, bitmap font, the girl (sprite), portrait, room, close-up props, food art
src/scenes/story.js      THE timeline: shot list with times, story clock, lighting over the day, all text lines
src/scenes/s1..s7_*.js   the shots (camera compositions + animation) for each scene
src/audio/               synth helpers, the original score, sound effects, audio director (live + offline)
tools/                   headless-Chromium tools: frame/contact-sheet inspection, audio render, MP4 export, checks
docs/                    style guide, API/module contracts, SFX list, shot-by-shot direction
```

## Story
Told through short second-person "*" thought boxes (Ece's own lines), typed letter by letter.
1. Cooking pasta (wide shot + close-ups of the pot, the pasta going in, stirring, serving): "* You cooked some pasta."
2. Dinner at the table; half a plate is left: "* You are too tired to clean up." "* You decide to do it later."
3. Time passes (a faster timelapse, see `PSA.WARP` in src/engine/const.js): the clock goes 7 PM → 9 PM → midnight; the plate stays on the table.
4. She finally puts it in the fridge at midnight.
5. Next morning it looks normal, but something doesn't feel right. A battle screen: the leftover plate vs. the
   Eat it / Throw it out menu; she throws it out ("* You decided not to take the risk.").
6. WOULD YOU EAT IT? — IT LOOKS FINE. BUT IS IT SAFE?
7. The numbers (WHO, June 2026): an estimated 866 million fall ill after eating contaminated food and 1.5 million die
   every year. Then Ece's end cards: LOOKS CAN BE DECEIVING. / Refrigerate perishable food within 2 hours. /
   Above 32°C? Refrigerate within 1 hour. / Never rely on smell or appearance alone. / WHEN IN DOUBT, THROW IT OUT.
   (source: USDA), which stays up as the finish frame with a REPLAY button.
