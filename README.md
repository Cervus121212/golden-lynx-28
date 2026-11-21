[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Cervus121212/golden-lynx-28/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Cervus121212/golden-lynx-28/reward.svg)](https://make.fun/bounty/gta6-01)

# VELA BAY — One Last Summer in Leonida Bay

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01)
($1,666, top 100 paid). Built from scratch in three.js 0.160 (WebGL2), offline,
no network requests — everything is vendored under `game/`.

Dante Reyes is back in Vela Bay — broke, hunted, and one job away from king.
Eight story missions against Mara Voss's jobs and Det. Rook's VBPD, $19,000 on
the table, one yacht at the end of it all.

## Play

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

WASD drive / walk · mouse drag camera · click / Space shoot · E interact /
enter car · F exit car · 1/2 weapons · Q radio · P save · M mute · Enter start.

## Systems

- **City** — 9×9 blocks, beach, docks, marina, yacht *La Sirena*, sunset that
  slides to dusk over the day, district signs, billboards, palms.
- **VBPD dispatch** — named units, roadblocks at 4★, **Air One** helicopter at
  3★, wanted decay by distance (the heli never counts).
- **Traffic AI** — 14 cars follow the road grid and turn at intersections;
  12 pedestrians, who flee when a car gets within 6 m.
- **Combat** — pistol + SMG weapon slots with ammo, tracers, armour-first damage.
- **Missions** — 8 chapters (First Wheels → King of Vela), $19,000 total,
  with portrait dialog, mission panel (chapter / stage / NEXT) and a live marker.
- **Radio** — 3 stations (COSTA 88 / LA VOZ 104 / ONDA 97), synth kick + bass.
- **HUD** — wanted stars, cash, clock, minimap with S/G/Y/! markers, health +
  armour, weapon slots, speed, **respect ranks** (ROOKIE → DRIVER → KING OF VELA).
- **Save** — localStorage save on every mission pass + P to save any time.

## Shots

`?shot=cover|chase|mission|title` stages a frozen frame (title `SHOT-READY`).
`?autopilot=1` runs the built-in 58-check self-test (title
`AUTOPILOT-PASS`/`AUTOPILOT-FAIL`, results in `#test-results`).
`?seed=N` fixes the RNG. `?lowfx=1` lowers the pixel ratio.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/dossier.json
```

## License

MIT — see [LICENSE](LICENSE).
