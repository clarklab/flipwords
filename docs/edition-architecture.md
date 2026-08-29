# Edition architecture

The app ships two editions of the same game:

| Edition | Name | Puzzles | Audience |
|---|---|---|---|
| `flipwords` | FlipWords | `levels_generated.json` | The original |
| `texas` | The Texas Two-Step | `levels_texas.json` | Texas Monthly |

They share **all** game logic, animation, and layout. They share **no** puzzles,
progress, or palette.

## The one rule

> No component, hook, or daily function may hardcode an edition-specific
> string, key, color, or puzzle source.

Everything that differs lives in `src/edition/editions.ts`. Adding a third
edition should mean adding one entry to `EDITIONS` and one `[data-edition]`
block in CSS — nothing else.

## How it fits together

```
src/edition/
  types.ts      EditionConfig — the contract for what can differ
  editions.ts   EDITIONS registry — the two configs, and the JSON imports
  context.tsx   EditionProvider + useEdition() + pre-paint boot script
  index.ts      barrel
```

**Theme** is applied by writing `data-edition` onto `<html>`. CSS scopes its
overrides to `[data-edition='texas']`, so flipping the attribute retextures the
entire app without a single component re-render for styling purposes.

**Resolution order** is URL param → remembered choice → play history → host
pin → default:

```
/play?edition=flipwords       pins an edition (useful for demos and QA)
localStorage game_edition_v1  remembers the last choice
editionsWithPlay()            a play history naming exactly ONE edition
EDITION_BY_HOST               host-pinned origins (flipwords.superfun.games)
DEFAULT_EDITION               falls back
```

`editionBootScript()` runs in `<head>` before first paint and applies the same
precedence, so a remembered edition never flashes the default palette. It
mirrors `resolveEdition()` — **change one, change the other.**

## The fork in the road (`/choose`) — the default front door

**The chooser is where every full page load of `/` lands, always** — first
visit or five-hundredth. The boot script redirects pre-paint, so the title
screen never flashes first. The chooser explains that the game ships under
two names and offers one card per registry entry; picking one persists the
edition and lands on `/`. The one exception: a valid `?edition=` deep link
pins an edition and lands directly, so demo and QA links skip the fork.

Resolution still matters on the way in — the first three entries above are
*choices* (two explicit, one implicit), the last two *fallbacks*:

- The resolved edition themes the chooser (palette, `data-edition`) and, when
  it comes from an actual choice, backs the card's **"Now playing"** badge —
  a returning player's daily tap-through is a no-thought gesture. A resolved
  *fallback* is never badged: it isn't the visitor's answer.
- **Play history counts as an implicit choice.** Completed sessions in
  exactly one edition (a non-empty `sessions` map under that edition's
  `storageKey` — key existence alone doesn't count, since glancing at a title
  screen writes an empty blob) resolve to that edition and get persisted, so
  players who predate the chooser see their game badged without ever having
  touched the choice key. A history in both editions is ambiguous — no
  inference, no badge.
- The title screen links back to `/choose` ("Also published as … — switch
  games", plus a masthead-menu entry) — that link replaced the old inline
  segmented toggle, which read as a settings control and confused people.
- If storage is blocked (private mode), the choice can't persist — harmless:
  in-app navigation is client-side routing and the boot script only runs on
  document loads, so choosing always lands on the title screen and nobody
  loops.

`GAME_SELECT_PATH` in `src/edition/context.tsx` and the file route
`src/routes/choose.tsx` both spell the path — rename both or neither.
`tests/edition/boot-script.test.ts` executes the generated script and pins
this behavior down.

## Why the daily functions take an explicit config

`loadStorage`, `saveStorage`, `getSessionForDate`, `poolForDate`,
`formatShareString`, `shareSession`, and `dayNumber` all take the edition (or
its launch date) as a required argument. There is deliberately **no default**.

A default would compile fine at every call site and silently write one
edition's progress into the other's streak. Making it required turns that bug
into a type error.

## Per-edition invariants

Enforced by convention; worth checking in review:

- **`storageKey` unique** — else streaks and in-progress sessions bleed from
  one edition into the other when the player switches.
- **`seedPrefix` unique** — else the two editions deal correlated sessions.
- **`themeColor` matches `--chin`** for that edition. Chrome paints the URL bar
  with `theme-color` literally, so any drift shows as a visible seam.
- **`poolReleases` sorted by `from`, never back-dated.** The daily picker is
  deterministic only for a fixed pool; adding levels without a new release
  entry silently rewrites the sessions of days people already played.

## Adding puzzles to an edition

1. Append to that edition's matrices file with ids **above** the previous max.
   Never renumber shipped levels.
2. Rebuild and verify (see `tools/`).
3. Add one `poolReleases` entry dated **tomorrow or later**.

## Known follow-ups

**Blocking a public launch**

- **The display font is an unlicensed trial.** `public/fonts/GrifinitoTestL-Medium.otf`
  nameID 13 reads *"For testing purposes only. Commercial use requires licensing
  from r-typography.com."* It is bundled into `dist/client/fonts/` and publicly
  fetchable, and it is the defining typeface of the Texas edition. License it
  from R-Typography before this ships anywhere public.
- **The trial carries 65 glyphs**: `space , . 0-9 A-Z a-z`. No hyphen,
  apostrophe, colon, em dash, or ampersand. Anything set in `.font-display` /
  `.display-headline` / `.tm-display` must stay inside that set or it renders
  mid-word from a fallback face at the wrong weight. This is why the masthead
  reads "TEXAS TWO STEP" while prose reads "The Texas Two-Step". Licensing the
  retail font removes the constraint and the spelling split with it.

**Correctness / product**

- SSR head metadata describes `DEFAULT_EDITION` only. `editionForHost()` keeps
  the FlipWords origin on FlipWords at runtime, but crawlers hitting a shared
  origin still see the default. Per-edition routes (or per-host SSR) would be
  needed for both to be independently indexable.
- **The base FlipWords library ships words that fail the standalone-half
  standard applied to the Texas set.** Because the mechanic splits a compound
  across two tiles, each half appears alone on screen. `tools/matrices.json`
  uses FIREWATER (ids 78, 106), OUTBACK (74, 113), OUTLAND (61, 109) and
  OVERSEA (68). `tests/edition/tile-halves.test.ts` guards the *halves* in both
  editions and passes, but does not judge whole answers. Fixing these would
  change levels players have already archived, so it needs a deliberate product
  decision about the daily-determinism guarantee — see the pool-release rules
  above.
- **FlipWords `/play` clips a clue at viewport heights ~700–760px.** The bottom
  clue renders underneath the tile rail and cannot be read. Pre-existing
  (verified against `git show HEAD`); the Texas edition avoids it by dropping
  the fixed `100dvh` cage, which FlipWords still uses.
- Copy that used to be FlipWords-specific ("TILES IN HAND", "First"/"Second",
  "Avg stars") now renders in both editions, because the components share one
  markup tree. If the two need to diverge, add a `copy` block to
  `EditionConfig` rather than branching in a component.

**Tidiness**

- `pickSessionLevels` / `pickLevels` in `src/game/levels.ts` are unreferenced —
  the unseeded twin of the seeded picker, free to drift.
- `--chin` is a dead token under Texas now that the chin is gone; it is
  retained only because `.bg-chin` in `styles.css` still resolves it.
- `tools/` duplicates `load_compounds()` and `CLUE_CHAR_CAP` across three
  scripts, and `find_texas_matrices.py` silently disables its dictionary filter
  when `/usr/share/dict/words` is absent — different results on CI.
