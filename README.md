# Cat Soccer

A 3v3 soccer game played with cats, built for children of roughly 5 to 10.
Installable as a PWA and playable offline.

**Live:** https://cats.dusty.games

## How it plays

Each side has two outfield cats and a keeper. The player never drives a cat
directly. Their cats find their own positions, and the only control is a
finger:

1. Your cats chase the ball on their own.
2. When one of them gets it, touch the screen. Everything drops into slow
   motion.
3. Drag toward a teammate or the goal and let go to kick.
4. First to three goals wins. There is no clock.

Three difficulty settings: Kitten, Cat and Big Cat.

## The bits that make it work for young children

These are deliberate, and worth understanding before changing them.

- **Colours belong to the team, not to each cat.** The player picks one
  pattern and up to three colours, and every cat on the side wears them, so
  the two teams are always tellable apart. The keeper wears a white variant
  of the same palette. The computer side is chosen to contrast with whatever
  the player picked, so the game is never black against black.
- **Aim assist.** A drag snaps onto a teammate or onto the side of the goal
  the keeper has left open. Without it a five year old almost never completes
  a pass. The computer uses the same open-goal targeting, so neither side has
  a hidden advantage.
- **Slow motion while aiming**, so there is time to look before committing.
- **A mercy rule.** Keep the ball near the goal you are attacking for three
  seconds and it goes in. A filling ring around the cat shows it coming, so
  it never feels random. The charge belongs to the team and decays rather
  than resetting, so being briefly tackled does not waste the pressure.
- **Ball carriers hold up short of the net** instead of dribbling the ball
  over the line, so a goal is always the result of a deliberate act.
- **Reach is not tied to body size.** Collect and tackle distances are set
  generously and on purpose: they are an assist, so making the cats smaller
  on screen must not quietly make the game harder.

## Developing

```bash
npm install
npm run dev
```

Note that editing any source file makes Vite reload the page, which drops you
back to the title screen mid-match. Test gameplay against a build, or against
the deployed site.

```bash
npm run build      # typecheck and bundle
npm run preview    # serve the build, no hot reload
npm run icons      # regenerate app icons from the inline SVG in scripts/
```

## Simulation

The browser shows whether the game looks right. `scripts/sim.ts` checks
whether it behaves right, by playing whole matches headlessly with the real
physics and AI over a spread of seeds.

```bash
npm run sim                     # run the checks
npm run sim -- --sweep bigcat   # tune one difficulty
```

It asserts the things that actually matter: the ball is never dead, play
stays a contest, the cats stay spread out rather than forming a scrum, the
mercy rule rescues a child who cannot aim yet, and the three settings form a
real ladder where each step concedes more and is won less often.

Two cautions when tuning:

- Opponent `speed` is by far the strongest lever and is sharply non-linear
  around the player's 1.0, because whichever side is quicker reaches every
  loose ball first.
- `CAT_RADIUS` feeds into the balance too, since larger cats block more shots
  and cover more ground. Changing the cat size shifts the whole ladder, so
  re-run the sim and expect to move speeds in steps of about 0.03.

## Deploying

```bash
npm run build
npx wrangler deploy
```

Cloudflare Workers static assets, on the `cats` Worker, served at
`cats.dusty.games`.

If a deploy ever reports the wrong Worker name, check for a stale
`.wrangler/deploy/config.json`, which redirects the config to a snapshot in
`dist/` and silently overrides `wrangler.jsonc`.

## Privacy

There is no backend, no accounts, no analytics and no network calls. The team
a child builds is kept in their own browser's local storage and goes nowhere
else. All sound is synthesised with WebAudio and all artwork is drawn in
code, so there are no third party assets.
