---
name: FlipWords rebuild
description: Design spec for the FlipWords overhaul — puzzle library regen, game logic audit, tactile visual pass with Mona Sans, and GSAP/canvas-confetti animations.
date: 2026-05-14
---

# FlipWords Rebuild

## Goal

The current FlipWords game is functional but the puzzle library has high error rate (most 2×2 word matrices contain at least one invalid compound word, and several clues describe the wrong cell). Game logic is mostly correct but the puzzle ambiguity makes it feel broken. The visual treatment is unfinished.

This rebuild produces a shipped version where every puzzle is provably solvable and unambiguous, the game logic has a single source of truth for board state, the visual treatment is tactile/premium, and hero animations are hardware-accelerated.

## Scope

In scope:
- Regenerate the entire puzzle library (`levels_generated.json`) from a verified compound-word source
- Refactor game state into a single `getBoardFaces(slots, rotation)` abstraction; win check and hint engine both read from it
- Visual redesign: Mona Sans (ExtraExpanded for branding, Normal for gameplay), tactile cream palette, paper-feel tile cards
- GSAP for tile flip / board rotation / slot snap animations
- canvas-confetti for win celebration
- Programmatic verification: every level must have exactly one valid configuration

Out of scope:
- Changing the game's underlying rules (5 tiles, 2 slots, flip/rotate mechanic)
- Backend / multiplayer / accounts
- Dark mode (light/cream only for v1)

## Puzzle Library

### Approach

Hand-curate ~40-50 verified 2×2 compound matrices. A matrix is valid only if:

1. All 4 row+col concatenations are recognized English compound words
2. No diagonal or alternate concatenation accidentally forms a 5th valid compound (would cause false-pair ambiguity)
3. None of the 3 decoy tiles, when substituted for a solution tile in any flip/slot/rotation combo, produces all-4-valid edge compounds (would let a wrong answer validate)

### Validation Pipeline

A Python script `tools/build_levels.py` will:

1. Load `tools/compound_words.txt` — a curated list of common English compound words (~600+ entries seeded by me, hand-vetted)
2. For each candidate 2×2 matrix from `tools/matrices.json`, verify all 4 concatenations are in the compound list
3. Pick 3 decoy tiles from `tools/decoys.json`, verify no decoy substitution produces an alternate valid solution
4. Output `levels_generated.json` with: tiles (5), hints (4 clue strings), solution (4 cells), requiresRotation flag, difficulty tier (1-3)

A separate `tools/verify_levels.py` runs against the output JSON as a CI gate.

### Clue Style

**Fun and quizzical** — playful for easy levels, light wordplay for harder ones.

Examples:
- HEADLINE: "Front-page tease" (playful) or "Lead story?" (wordplay)
- BEDBUG: "Hotel hitchhiker" (playful)
- FALLOUT: "Bad aftertaste" (wordplay — both literal radioactive dust and disagreement consequence)

Each clue must unambiguously point at one cell and not accidentally describe a different edge.

### Difficulty Curve (~45 puzzles)

- **Tier 1 — Puzzles 1-15** (non-rotated, very common compounds): AIRPORT, BEDTIME, RAINCOAT, SUNFLOWER, etc. Clues are direct-playful.
- **Tier 2 — Puzzles 16-32** (non-rotated, mid-difficulty compounds): WATERFALL, BOATHOUSE, MOONLIGHT. Clues lean playful with some wordplay.
- **Tier 3 — Puzzles 33-45** (rotation introduced + harder vocabulary): rotation is the advanced twist, paired with less common compounds. Clue wordplay intensifies.

## Game Logic

### Single Source of Truth

```ts
function getBoardFaces(
  slots: [Tile | null, Tile | null],
  rotation: 0 | 90 | 180 | 270
): { topLeft: string | null, topRight: string | null, bottomLeft: string | null, bottomRight: string | null }
```

Every consumer (win check, hint engine, edge label renderer, animation targets) reads from this single function. No other code performs rotation math.

### Derived Functions

- `getEdges(faces)` — returns the 4 candidate edge compounds (top, right, bottom, left concatenations)
- `getExpectedEdges(level)` — computes the 4 target compounds from the level solution, accounting for `requiresRotation`
- `isLevelSolved(slots, rotation, level)` — `getEdges(getBoardFaces(...))` equals `getExpectedEdges(level)`
- `getNextHint(state, level)` — plans toward the expected-edge-strings, suggests next legal move

### Verification

- Unit tests for `getBoardFaces` covering all 8 combinations of (slot0 flip × slot1 flip × rotation 0/90)
- Build-time verifier: for each level, enumerate all 5×5×2×2×2 = 200 configurations of (tile1, tile2, flip1, flip2, rotation) and assert exactly one validates

### Refactor

Split `FlipWords.tsx` (3,041 lines) into:

- `src/game/types.ts` — Level, Tile, GameState, Slots
- `src/game/transforms.ts` — `getBoardFaces`, `getEdges`, `getExpectedEdges`, `isLevelSolved`
- `src/game/hint.ts` — `getNextHint`, `getLevelHintPattern`
- `src/game/levels.ts` — loads `levels_generated.json`, validates at runtime in dev
- `src/components/FlipWords.tsx` — composition + state hook
- `src/components/Tile.tsx`, `Slot.tsx`, `ClueStrip.tsx`, `BoardFrame.tsx`, `WinOverlay.tsx`

The component layer should be ~500 lines after the split.

## Visual Design

### Palette (light/cream mode only)

| Token | Value | Use |
|---|---|---|
| `--surface` | `oklch(96% 0.015 80)` | page background (cream paper) |
| `--ink` | `oklch(20% 0.02 240)` | primary text |
| `--ink-muted` | `oklch(40% 0.02 240)` | hints, labels |
| `--tile-face` | `oklch(99% 0.01 80)` | tile background |
| `--tile-edge` | `oklch(88% 0.01 80)` | tile inner stroke |
| `--accent` | `oklch(60% 0.15 180)` | correct/win/glow |
| `--warn` | `oklch(55% 0.12 30)` | soft wrong indicator |
| `--shadow-tile` | `0 1px 0 rgba(0,0,0,.04), 0 8px 24px -8px rgba(0,0,0,.18)` | tile elevation |
| `--inset-slot` | `inset 0 2px 6px -2px rgba(0,0,0,.15)` | slot well |

### Typography (Mona Sans variable)

| Use | Variation | Weight |
|---|---|---|
| Wordmark `FLIPWORDS` | width 125% (ExtraExpanded) | 800 |
| Level title (`Puzzle 3`) | width 115% (Expanded) | 700 |
| Win headline | width 125% | 800 |
| Clue text | width 100% (Normal) | 500 |
| Tile letters | width 100% | 700 |
| UI buttons | width 100% | 600 |
| Body / hint panel | width 100% | 400 |

Google Fonts URL: `https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wdth,wght@0,75..125,200..900&display=swap`

### Tile Component

- `14px` rounded corners
- Multi-layer shadow for depth: `var(--shadow-tile)` + inset highlight
- 3% opacity diagonal paper-texture CSS gradient overlay
- Hover: `scale(1.02)`, slightly deeper shadow
- Drag pickup: `scale(1.08)`, deepest shadow
- Slot-snap: GSAP `back.out(1.7)` ease

### Layout

- Mobile-first, single column, max-width 640px desktop
- Vertical stack: Header / wordmark → Level title + clue rotator → Board frame (4 clues + 2 slots) → Tile bank → Hint button → Footer

### States

- Empty slot: dotted inset outline, "Slot 1" / "Slot 2" muted label
- Filled wrong: no warning (player figures from clue mismatch)
- All 4 edges valid: teal glow on edges, GSAP celebration, confetti burst, "Next puzzle" CTA

## Animations

### GSAP

- **Tile flip:** 3D `rotateX(180deg)`, `transformStyle: preserve-3d`, GSAP timeline, 350ms `power2.inOut`
- **Board rotation:** 90° rotate on the board frame, GSAP `power3.inOut`, 600ms; clue strips rotate with the frame so clue-to-edge mapping is visually consistent
- **Slot snap:** when tile is dragged into a slot, GSAP `back.out(1.7)` snap, 250ms
- **Win sequence:** sequential edge-glow pulse (top→right→bottom→left), 200ms stagger, then confetti

### canvas-confetti

- Win celebration only — 2 bursts from corners of board frame
- Color array uses accent + cream + ink palette so it doesn't clash

### Reduced motion

- `@media (prefers-reduced-motion: reduce)` collapses all flips to instant state changes, skips confetti, replaces win sequence with a static teal border

## Out of Scope (Punt to Later)

- Dark mode
- Daily puzzle / leaderboard
- Sound design
- Tutorial onboarding (existing modal stays; redesigned to match visual style)
- Admin page redesign (existing functionality retained, palette updated)

## Verification Plan

1. `tools/verify_levels.py` exits 0 on every level
2. Unit tests for `getBoardFaces` pass
3. `npm run build` exits 0
4. Manual smoke test: levels 1, 5, 21, 38 (rotation), 45 are solvable on dev server; hint button advances toward solution; win state triggers confetti
5. Reduced motion respected
6. No console errors on dev server load
