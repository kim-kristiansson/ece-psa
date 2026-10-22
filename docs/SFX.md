# SFX NAMES (PSA.sfx[name](ctx, bus, when, args)) — every name here must exist in src/audio/sfx.js

All are short, soft, retro-RPG flavoured (synthesized, chiptune-ish but not harsh). `when` is the context time to start.
| name | args | description |
|---|---|---|
| blip | {kind:'narr'|'voice'} | typewriter text blip (very short, soft square/triangle tick; 'voice' slightly higher) |
| boil | {dur, level:0..1} | gentle boiling water loop: low filtered noise rumble + small random bubble pops for `dur` seconds, fades in/out |
| sizzle | {dur} | faint stove hiss (optional under the cooking close-ups) |
| splash | {} | pasta going into the water: soft plop + short watery noise |
| stir | {dur} | soft periodic swishing of a spoon in water for `dur` seconds |
| serve | {} | soft "plop" of pasta landing on a plate |
| ladle | {} | sauce ladled: a short wet dollop |
| plateSet | {} | ceramic plate set on a wooden table: short clink/thud |
| forkPick | {} | fork lifted from the plate: light metallic tick |
| forkClink | {} | fork touching the plate while twirling |
| eat | {} | soft, cute munching (2–3 muted ticks) — not gross |
| chair | {} | chair scrape on wood (short, muted) |
| footstep | {soft:bool} | one footstep on wood; scenes schedule one per walk frame |
| notice | {} | RPG "!" alert: short rising two-note blip |
| question | {} | RPG "?" soft wobble |
| menuMove | {} | menu cursor move tick |
| fridgeOpen | {} | fridge door open: soft suction/seal + hinge |
| fridgeClose | {} | fridge door close: muted thud + rattle |
| fridgeHum | {dur} | faint fridge hum while the door is open |
| lightSwitch | {} | lamp click |
| tick | {accent:bool, level:0..1} | one clock tick (used in the time-passing sequence; level scales with tension) |
| yawn | {} | soft sleepy "yawn" vocal-ish sweep (optional, subtle) |
| sting | {} | a quiet low, unsettling sting/drone swell for the question screen (no jump-scare, slow attack) |
| reveal | {} | soft pixel "appear" sound for lines of the final info screen |
| swell | {dur} | quiet low pad swell (used under WOULD YOU EAT IT?) |
