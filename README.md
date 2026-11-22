# The Picture That Tastes of One

[![make.fun · the-picture-that-tastes-of-one-20261122-2047](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/adzinsyariif/picture-that-tastes/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/adzinsyariif/picture-that-tastes/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)

One ingredient, one picture. This program paints a single halved fig, drizzled
with honey, against a dark warm backdrop — and nothing else. No hands, no
plates, no cutlery, no words in the frame: just the fruit, big and centred, so
it still looks delicious shrunk down to a thumbnail.

Everything is drawn in code. There are no image assets, no libraries and no
network calls: `main.ts` builds the picture pixel by pixel with a seeded
random generator, then writes out its own PNG encoder. Run it twice and you
get the exact same bytes.

## How to run it

```sh
node main.ts
```

That writes `/output/entry.png` — a 1024×1024 PNG under 1 MiB. To save it
somewhere else instead, set `OUTPUT_PATH`:

```sh
OUTPUT_PATH=./fig.png node main.ts
```

## What is in the picture

- **The fig** — deep plum skin with a warm rim light, a pale pith ring, and a
  juicy rose interior with radial fibres, tiny seeds and juice droplets.
- **The honey** — glossy ribbons with bright highlights, a small pool where
  the drizzle gathers, and three slow drips running down the flesh.
- **The mood** — a dark ember glow behind the fruit, a soft contact shadow
  underneath, and a gentle vignette to keep the eye on the centre.

Requires Node.js 22 or newer. No install step, no dependencies.
