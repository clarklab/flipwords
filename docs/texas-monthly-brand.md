# Texas Monthly brand system — The Texas Two-Step

Reference for the TM-branded edition of the game. Every hex here was sampled
programmatically from real pixels (Pillow) in `texas-monthly/`, not picked by
eye. Two values are derived; they are labelled as such.

Implementation lives in **`src/styles/texas-theme.css`**.

---

## 1. Palette

### 1.1 Site chrome — sampled from the three TM screenshots

Text colours were extracted by taking the modal colour of a patch (= the
background), then the median of the pixels furthest from it in RGB space —
anti-aliasing safe. Fills are straight modal values.

| Hex | Role | Where it was sampled |
|---|---|---|
| `#ffffff` | Page background | All three screenshots; 100% of 3,249-px patches. TM's page is pure white, not cream. |
| `#000000` | Wordmark, headlines, body, nav, heavy rules | Ink core of the `TexasMonthly` wordmark, "Games", "Word Wrangler" headline, deck body, section rules |
| `#e56545` | **Primary accent** | SUBSCRIBE link, hero headline "Why Is Texas Taking Over…", READ NEXT, GAMES eyebrow, SIGN UP button fill. Five independent sample sites across two screenshots returned the identical value. |
| `#a0a0a0` | Secondary text | "By Michael Hardy", "By Robert Downen", "By Texas Monthly", "July 30, 2026", share-icon strokes. Four independent samples, identical. |
| `#f5f5f2` | Tinted panel | Games newsletter promo panel; Word Wrangler bottom conversion bar. 100% of patch. |
| `#d7d7d7` | Hairline rule | 1-device-px dividers: games sub-nav rule, trending-rail separators |
| `#da5d27` | *(not ours)* | "Start" button in the embedded word-search widget — third-party vendor chrome, not TM's palette. Listed so nobody samples it by mistake. |

Rule weights, measured: hairlines are **1 device px** (0.5 CSS px, sub-pixel);
section rules under headings are **8 device px = 4 CSS px** solid `#000000`.

### 1.2 Folk-art palette — sampled inside TM's own illustrations

Extracted by hue-family masking over the full illustration crops (~300,000 px
each), so the values are aim-independent. Percentages are share of the crop.

| Hex | Share | Role |
|---|---|---|
| `#f9e261` | 76.8% / 75.0% | **Sunflower** — the field colour of both Games cards |
| `#dd8852` | 74.3% / 89.1% | **Card orange** — the crossword card field |
| `#a6cbd7` | 5.9% / 7.6% | **Sage-teal** — steer skull, horned lizard |
| `#f8f2df` | 5.4% / 4.2% | **Cream** — magnifier lens, highlights. Identical modal in both illustrations. |
| `#e57448` | 3.7% / 3.2% | **Terracotta** — rocks, warm accents |
| `#292927` | 4.0% | **Warm line ink** — outlines. Note: *not* pure black, unlike the site's type. |
| `#5da05e` | 1.7% / 1.4% | **Cactus green** |

### 1.3 `art.png` — the commissioned illustration (1448×1086)

| Hex | Share | Role |
|---|---|---|
| `#f58537` | 76.7% | **Background field** — the signature colour of this game |
| `#93c6c7` | 10.0% (39.7% of subject) | Tornado teal |
| `#f9f0dd` | 3.7% | Domino faces |
| `#2a2928` | 3.4% | Outline stroke |
| `#4c6060` | — | Funnel shadow / deep teal |
| `#e25934` | — | Cowboy-hat red |
| `#589d54` | — | Cactus |
| `#efca90` | — | Dust cloud |
| `#e89c37` | — | Desert ground ochre |
| `#b06e37` | — | Rocks |

### 1.4 Derived values (the only two)

| Hex | Token | How |
|---|---|---|
| `#55524e` | `--color-ink-muted` | Warm midpoint between sampled `#000000` and sampled `#a0a0a0`. TM's site only exposes two ink steps; the app needs three. |
| `#fbe3dc` | `--color-accent-soft` | Pale tint of the sampled coral. Used for washes and `::selection`. |

### 1.5 Usage guidance

- **Coral `#e56545` is a punctuation colour, never a field.** On TM it appears
  only as small type (eyebrows, links) and one button. Do not fill large areas
  with it — that reads as a generic startup orange, not as Texas Monthly.
- **Black type on white is the default.** TM does not soften its body colour.
  Resist the instinct to warm it.
- **Warmth comes from the illustrations, not the chrome.** Cream, sunflower and
  terracotta belong to drawn objects (tiles, cards, art), not to page furniture.
- **Line ink inside artwork is `#292927`/`#2a2928`, not `#000000`.** Keeping the
  drawn world fractionally warmer than the typography is what makes the
  illustrations sit *on* the page rather than being cut out of it.
- **Sunflower `#f9e261` is TM Games' signature.** It is the strongest available
  cue that this is a *Texas Monthly game* specifically. Worth using for a
  celebration/solve state.

---

## 2. Type

### 2.1 Measurement method and caveat

Screenshots are 2876×1640 with EXIF DPI 143.99 → **DPR exactly 2.0**; CSS px =
device px ÷ 2. Absolute sizes then come out uniformly ~⅔ of normal editorial
values (nav cap-height 6 CSS px, deck ink 13 CSS px), which means the capture
was almost certainly taken at **~67% browser zoom**. So:

- **Ratios below are exact and zoom-independent — trust these.**
- Absolute px are back-computed assuming 67% zoom, and are indicative only.

### 2.2 Scale (ink height, normalised to the deck)

| Element | ×deck | ≈ font-size |
|---|---|---|
| Article headline (didone) | 3.81 | ~78 px |
| "Games" section title (didone) | 3.04 | ~82 px (cap-height measure) |
| Hero headline (didone, coral) | 3.38 | ~69 px |
| `TexasMonthly` wordmark (didone) | 2.73 | ~56 px |
| Newsletter panel heading (serif) | 1.38 | ~28 px |
| Card title (serif) | 1.31 | ~26 px |
| Card headline (serif) | 1.12 | ~23 px |
| **Deck / body serif** | **1.00** | **~20 px** |
| Section heading, caps sans ("TRENDING") | 0.96 | ~18 px |
| Byline / date sans | 0.69 | ~14 px |
| Nav + eyebrow caps sans | 0.46 | ~12 px |

The jump that defines the brand is **deck → headline ≈ 3.4–3.8×**. TM has almost
nothing in between. Reproduce that gap and the page reads as a magazine; fill it
with intermediate sizes and it reads as a blog.

### 2.3 Uppercase tracking

Measured as ink-gap between adjacent uppercase glyphs, ÷ estimated font size:

| Element | Ink-gap | Applied `letter-spacing` |
|---|---|---|
| Nav ("NEWS & POLITICS") | 0.296 em | ~0.18 em |
| Sub-nav ("WORD WRANGLER") | 0.296 em | ~0.18 em |
| Eyebrow ("POLITICS & POLICY", "GAMES") | 0.22–0.24 em | ~0.14 em |
| Section head ("TRENDING", "READER FAVORITES") | 0.28–0.31 em | ~0.18 em |

Ink-gap includes the face's own sidebearings, so applied tracking is roughly
0.10 em less. **`0.18em` is the house value** — that is what `.tm-eyebrow` sets.

### 2.4 The display face: `GrifinitoTestL-Medium.otf`

Read from the file's own `name`/`OS/2`/`cmap` tables via fontTools:

| Field | Value |
|---|---|
| Family (nameID 1 / 16) | **`Grifinito Test L`** — use this exact string |
| Subfamily | `Medium` · PostScript `GrifinitoTestL-Medium` |
| Designer | Rui Abreu, R-Typography · version 2.003 |
| Weights available | **One.** `usWeightClass` 500, not variable (no `fvar`) |
| Metrics | 1000 upem · cap 600 · x-height 437 · asc 764 / desc −236 |
| Outlines | CFF (OpenType/PS), 66 glyphs |
| `fsType` | 8 — editable embedding permitted |

**Suitability: yes for display, and it is a genuinely good match.** It is a
high-contrast condensed didone in the same register as TM's masthead — rendered
side by side with the screenshots, the stroke contrast and narrow set width
read as the same family of voice. It is *only* suitable for display: at UI sizes
the hairlines vanish.

Two hard constraints:

1. **License.** nameID 13 reads: *"For testing purposes only. Commercial use
   requires licensing from r-typography.com."* This is a trial. It must be
   licensed from Rui Abreu before the pitch ships anywhere public.

2. **Charset — 65 characters, and that is all.**
   `space , . 0-9 A-Z a-z`. Verified in-browser by per-character width probe:
   `- ’ : ? ! & —` are all served by the fallback, not by Grifinito.

   Two strings the edition registry ships today are affected:
   - `wordmark: 'TWO-STEP'` → **the hyphen is a fallback glyph.** Visibly wrong
     weight, width and vertical position. Also affects `name`, `shortName`
     and `share.headline`.
   - `playLabel: 'Play Today’s Puzzle'` → the curly apostrophe falls back.

   `tagline: 'Two tiles, four answers, one state.'` is safe — comma, period and
   space are all present.

   Three ways out, best first:
   1. **License the retail font** (full charset). Correct answer for a real pitch.
   2. **Set the wordmark as SVG outlines.** Removes the font dependency from the
      one string that matters most, and lets the hyphen be drawn to match.
   3. **Avoid the characters.** "TEXAS TWO STEP" (no hyphen) renders perfectly —
      see the safe line in the sample. Cheapest fix, and it costs nothing but a
      copy decision.

   `texas-theme.css` declares an explicit `unicode-range` matching the font's
   real coverage, so unsupported characters fall back *predictably per
   character* rather than the browser making its own choice. That contains the
   damage; it does not fix it.

### 2.5 Recommended stack

```
Display   "Grifinito Test L", "Playfair Display", "Bodoni 72", Didot,
          "Times New Roman", Georgia, serif      → var(--font-display) / .font-display
UI + body "Mona Sans", "Inter", ui-sans-serif, system-ui, …  → var(--font-ui)
Editorial "Iowan Old Style", Palatino, Georgia, serif → var(--font-serif-text)
```

**Keep Mona Sans as the UI face.** Three reasons:

1. It is a neutral grotesque — the same register as TM's nav and eyebrow sans.
   Set in caps at `0.18em` it is a close read of their treatment.
2. The app's seven `.font-*` classes drive Mona Sans's `wdth`/`wght` **variable
   axes** across ~110 call sites. Any static replacement silently collapses that
   hierarchy, because `font-variation-settings` is ignored on a non-variable
   font. Verified: `.font-wide` still resolves to `"wdth" 125, "wght" 800` under
   `data-edition="texas"`.
3. Keeping it means no change to the Google Fonts `<link>` in `__root.tsx`.

The editorial serif is offered as a system stack so it costs no network request.
Upgrade to Source Serif 4 or Spectral only if a `<link>` is acceptable.

---

## 3. The illustration language

TM's game art and `art.png` share one grammar. Anything new must obey it.

- **Flat fills, no gradients.** Every colour area is one value. The only
  modelling is a second, darker flat shape (the tornado's funnel shadow
  `#4c6060` against `#93c6c7`).
- **Heavy black outlines on everything.** Warm near-black (`#292927`/`#2a2928`),
  never pure black, and a consistent weight regardless of shape size. This is
  the single most identifying feature.
- **Printed paper grain.** `art.png` is not flat: a "solid" 1448×40 strip of its
  orange field contains **1,371 distinct RGB values** with a p5–p95 luminance
  spread of **10.5/255**. The grain is baked into the artwork. UI chrome must
  carry equivalent texture or it looks cleaner than the art sitting in it —
  which is why `--paper-tex` becomes a two-layer halftone screen plus a weave.
- **Strictly limited palette.** Each illustration uses 5–7 colours total. The
  Games cards are: field + ink + cream + one teal + one terracotta + one green.
  Do not exceed this.
- **One saturated field per composition**, with the subject in the cool
  complement. Yellow field / blue-grey subject; orange field / teal subject.
- **Subjects are Texan and slightly deadpan.** Steer skull, horned lizard,
  cowboy, tornado of dominoes. Not cute, not photorealistic.

### Applying it to the game

- Tiles are the folk-art object: cream face (`#f8f2df`), heavy warm-black
  outline (`#292927`), sage-teal back (`#a6cbd7`). Because `border-tile-edge`
  has 28 call sites, switching that one token to near-black does most of the
  reskin's visual work with no component changes.
- Shadows are **hard offsets**, not ambient blur — screen-print register, not
  material elevation. That is what the Texas `--shadow-tile*` values encode.
- The chin is the orange field the whole composition sits on. A cream play
  surface floating on `#f58537` restates `art.png`'s own composition exactly.

---

## 4. How the token layer works

`src/styles/texas-theme.css` overrides the same custom-property names
`src/styles.css` already defines, scoped to `:root[data-edition="texas"]`.

**Verified against tailwindcss 4.2.2**, by compiling the real `src/styles.css`
plus the Texas layer with the actual Tailwind compiler, serving the result, and
reading `getComputedStyle` in a browser while toggling the attribute on `<html>`.
21 of 24 probed declarations flipped; the 3 that did not are correct-by-design
(a solid-colour `background-image: none`, and two deliberately
edition-agnostic classes).

Three mechanisms, none of which depend on source order:

1. **`@theme` tokens are overridable.** They compile to
   `@layer theme { :root, :host { --color-*: … } }`, and utilities emit
   `var(--color-*)` — e.g. `.bg-accent { background-color: var(--color-accent) }`.
   Because the theme block sits inside a cascade **layer** and the Texas file is
   **unlayered**, every rule in it wins outright: unlayered beats layered
   regardless of specificity.
2. **The plain `:root { --shadow-tile; --paper-tex; … }` block is unlayered**, so
   layers do not help there. `:root[data-edition="texas"]` is specificity (0,2,0)
   vs `:root` (0,1,0) — it wins on specificity.
3. **Hand-written classes** (`.bg-chin`, `.bg-tile-face`, `.shadow-play-lift`) are
   (0,1,0); the descendant overrides are (0,2,1).

Order-independence was tested explicitly: rebuilt with the Texas layer emitted
*before* every rule in `styles.css` and re-read the computed styles. All
overrides still won, including `.bg-chin` beating a later-in-source
`background: #1f9c93`.

> A bare `[data-edition="texas"]` selector would be specificity (0,1,0) — a
> **tie** with `:root`, resolved by source order. Always use the `:root[…]` form.

### Caveats worth knowing

- **Opacity modifiers.** `bg-accent/50` compiles to a literal-value
  `color-mix()` fallback plus an `@supports (color: color-mix(in lab, …))` block
  that uses the var. Every evergreen browser takes the `@supports` branch, so
  these do follow the override — but the legacy fallback is frozen at the
  flipwords value.
- **New colours cannot become new utilities from an attribute block.** The
  extended folk-art properties (`--color-sunflower`, `--color-terracotta`, …) are
  usable as `var(…)` only. Utility generation is compile-time; only `@theme` can
  do it. To get `bg-sunflower` etc., these must be added to the `@theme` block in
  `styles.css` (owned elsewhere):

  ```css
  --color-sunflower: #f9e261;
  --color-terracotta: #e57448;
  --color-card-orange: #dd8852;
  --color-cactus: #5da05e;
  ```
- **`--breakpoint-*` / `--container-*` are compile-time** (they become media
  queries) and can never be overridden at runtime. Not used here, but worth
  knowing before anyone tries.

---

## 5. Still needs wiring (not doable from CSS)

1. **`src/edition/editions.ts` → `texas.themeColor`.** Currently `#1a1a1a`;
   must become **`#f58537`** to match `--chin`. The file's own invariant says
   `themeColor` matches `--chin`, and Chrome uses `theme-color` as a literal
   URL-bar fill — any drift shows as a seam against the chin.
   *Conservative alternative:* `#000000` (TM's real masthead-rule and
   newsletter-bar black, also sampled) if a chrome-coloured chin is preferred
   over an art-coloured one. Change both values together, or neither.
2. **`src/styles.css` `.bg-chin`** is hardcoded `#1f9c93`. The Texas layer
   overrides it by rule, so nothing is broken today — but refactoring it to
   `background: var(--chin)` (with a flipwords default of `#1f9c93`) is cleaner
   and the Texas layer already writes it that way.
3. **Hardcoded colours in components** survive a token reskin untouched:
   - `src/components/FlipWords.tsx:182` — confetti palette
     `["#1f9c93","#f7c454","#e07a5f","#3d405b","#f4f1de"]`. Texas equivalent:
     `["#f58537","#e56545","#f9e261","#a6cbd7","#f9f0dd"]`.
   - `src/components/FlipWords.tsx:250, 1214` — `rgba(31,156,147,…)` teal glows
   - `src/components/TutorialModal.tsx:61, 63` — `rgba(31,156,147,0)`
   - `src/components/Scorecard.tsx:124` — `rgba(31,156,147,0.55)`
   - `src/components/Scorecard.tsx:99` — `rgba(247,196,84,…)` gold
   - `src/components/Scorecard.tsx:147, 165` and
     `src/components/TitleScreen.tsx:310` — `oklch(64% 0.16 38)` golds
   - `src/components/Archive.tsx:157, 171, 245, 253` — `oklch(… 180)` teals
   - `src/components/Tile.tsx:222`, `TutorialModal.tsx:27, 122, 150` —
     `rgba(120,90,40,0.03)` paper wash (warm, reads fine on Texas; low priority)
4. **Grifinito must actually be applied.** Nothing uses `.font-display` yet.
   Wordmark, big numerals and any headline should adopt it — subject to the
   charset constraint in §2.4.
5. **Optional:** add `<link rel="preload" as="font" type="font/otf" crossorigin
   href="/fonts/GrifinitoTestL-Medium.otf">` to `__root.tsx` to avoid a display
   -type flash. `font-display: swap` already prevents invisible text.
