# SOLMARINA — an open-world crime game

[![MakeFun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Hantone-liu/makefun-gta6-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Hantone-liu/makefun-gta6-entry/reward.svg)](https://make.fun/bounty/gta6-01)

**SOLMARINA** is an original sun-soaked coastal-city crime game, built for the
[MakeFun GTA 6 bounty](https://make.fun/bounty/gta6-01) with three.js. You are
Marco Vela, a courier in the city of Solmarina: drive, steal cars, dodge the
police, fight, and run three story missions — a timed delivery, a stolen
sports car, and a five-star escape across the whole city.

- **Open world:** a procedural low-poly coastal city — grid streets, traffic,
  pedestrians, a beachfront, a marina, palms and sunsets — explored on foot
  and by car.
- **Systems:** wanted level (0–5 stars) with police cars and foot cops,
  car stealing, melee + pistol combat, pickups, cash and reputation, save
  games in localStorage.
- **Presentation:** third-person camera, HUD with live minimap, WebAudio
  synth sounds, particles and effects — all art drawn in code, no external
  assets, no network requests.

## Play it

Serve `game/` with any static server and open `index.html` in desktop
Chrome, or run `node serve.ts` and open http://localhost:8080.

- **On foot:** WASD move, mouse drag orbits the camera, Shift sprint,
  E enter a car, F punch, click to shoot (once you have the pistol), M mute.
- **Driving:** W/S accelerate and brake, A/D steer, Space handbrake,
  E get out, R restart the mission, Esc pause.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library (`vendor/makefun-game.ts`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game's own code.
License: MIT.
