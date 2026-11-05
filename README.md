# THE HOLLOW ARRAY

**Chapter One: Static in the Pines** is an original first-person survival horror game set inside Halcyon Ridge, a deserted mountain observatory. Restore its machinery, recover three field tools and learn how to defeat three different creatures. The chapter ends with a descent into the observatory beneath the observatory and a cliffhanger for the next update.

## Play

[▶ CLICK ME TO PLAY](https://tuffm82-pixel.github.io/The-Hollow-Array/) · [Download for offline desktop play](https://raw.githubusercontent.com/tuffm82-pixel/The-Hollow-Array/main/downloads/THE-HOLLOW-ARRAY.zip)

[Creature animation preview](https://tuffm82-pixel.github.io/The-Hollow-Array/animation-lab.html) lets you inspect the authored movement and action clips separately from the campaign.

On iPad, open the browser link in Safari, turn sideways and tap **ENTER STATION**. This first tap enables sound. No account or app installation is needed. Use **Audio & Display → Battery saver** if the detailed setting runs slowly. The game requires WebGL 2. Landscape is recommended; touch controls also rearrange for portrait.

| Action | iPad | Desktop |
| --- | --- | --- |
| Walk | Left thumbstick | W A S D |
| Turn and look | Swipe the right side | Drag the right side or arrow keys |
| Use a nearby station | USE | E |
| Run | RUN toggle | Shift |
| Hide near a locker | HIDE | H |
| Switch tool | ARC / ECHO / CRYO | 1 / 2 / 3 |
| Use selected tool | Hold FIRE, then release | Hold F, then release |
| Pause | Ⅱ | Escape |

The **Arc Spool** charges while FIRE is held. Wait for an enemy's opening before releasing it. **ECHO** is the Resonance Fork; it exposes hidden tissue. **CRYO** is the Cryo Lantern; it freezes a creature briefly. Tools are found through the campaign, so their buttons start locked.

## Chapter One

Fifteen operations take you through the lodge, Engineering, infirmary, observation records, workshop, conservatory and telescope dome. You must physically travel between objectives, solve circuit, pressure, frequency, code and memory puzzles, and survive the three encounters. Each creature has a different opening: watch its wind-up, break its sight behind solid walls, and use the appropriate tool. Hiding works best after you lose the creature's line of sight.

Completed operations save a checkpoint on this device. **Continue Transmission** resumes from it; **Retry Checkpoint** restores the last completed operation after death. The storm and preparation countdowns stop while paused. The ending completes Chapter One; Chapter Two is a future update, not an included second chapter.

Mission radio lines are spoken with the browser's available device voices and also displayed as subtitles. **REPLAY RADIO** repeats the most recent line. Voice availability differs by device; the complete campaign remains playable with subtitles. Ambience, creature sounds, footsteps and other effects are included. Headphones are recommended. Settings include sound, brightness, look sensitivity, reduced camera movement and graphics quality.

## Download edition

Download and extract the ZIP, then open **THE HOLLOW ARRAY.html** in a desktop browser. The game and models are embedded in that HTML; it does not need a running game server. Speech may depend on voices available on your device. On iPad, use the hosted Safari link because opening downloaded HTML from Files does not behave like a normal browser page.

The [latest GitHub build](https://github.com/tuffm82-pixel/The-Hollow-Array/actions/workflows/pages.yml) also keeps the desktop ZIP under **Artifacts → hollow-array-offline-desktop**.

## Development

The standalone repository uses Three.js and Vite. No extra model or animation software is required to run the game.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm dev
pnpm build
pnpm run package
```

The standalone build is written to `dist/`, including the downloadable ZIP after packaging. Campaign progression lives in `campaign.js` and `layout.js`; combat, navigation, perception, puzzles, world rendering and creature animation have separate owners. In the original multi-game workspace, the source lives in `glasshouse/` and builds to `dist/glasshouse/`.

Creature source meshes are CC0 assets from 3DAssets.dev, with custom skeletal rigs and six authored animation clips per creature. Source links, file hashes and clip durations are recorded in `assets/creatures/manifest.json` and included in the download's **MODEL SOURCES.txt**. The environments and tools are authored in the game; no paid assets or external model service is needed at runtime.
