#!/usr/bin/env python3
"""Verify a built levels file: each level must have EXACTLY ONE valid configuration.

Defaults to the base FlipWords library:

    python3 tools/verify_levels.py

Alternate editions pass their own build product:

    python3 tools/verify_levels.py --levels levels_texas.json


A configuration is (pair-of-tiles, flip0, flip1, rotation). For each level we enumerate
all 5*4*2*2*2 = 160 configurations. A configuration is "valid" if:
  1. All 4 edge concatenations are in the compound word list, AND
  2. The edge labels (top/bot/left/right) and the rotation flag both match what the
     level expects.

This second condition is what makes the puzzle unambiguous: the player has clues for
TOP/BOT/LEFT/RIGHT, so a configuration is only a true solution if its top edge matches
the level's top-edge clue (i.e. the level's expected edge), the rotation matches the
level's requiresRotation, and the slot state matches the level's solution.
"""

import argparse
import json
import re
import sys
from itertools import product
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TOOLS_DIR.parent
COMPOUND_FILE = TOOLS_DIR / "compound_words.txt"
LEVELS_FILE = PROJECT_DIR / "levels_generated.json"

# Clue pill ceiling — see build_levels.py for the rationale.
CLUE_CHAR_CAP = 32


def load_compounds() -> set[str]:
    with COMPOUND_FILE.open() as f:
        return {line.strip().upper() for line in f if line.strip()}


def load_levels(path: Path) -> list[dict]:
    with path.open() as f:
        return json.load(f)


def edge_compounds(
    tile0: dict, tile1: dict, flip0: bool, flip1: bool, rotation: int
) -> tuple[tuple[str, str, str, str], dict]:
    """Return ((top, bot, left, right), slot_state)."""
    t0_top = tile0["bottom"] if flip0 else tile0["top"]
    t0_bot = tile0["top"] if flip0 else tile0["bottom"]
    t1_top = tile1["bottom"] if flip1 else tile1["top"]
    t1_bot = tile1["top"] if flip1 else tile1["bottom"]

    if rotation == 0:
        a, b, c, d = t0_top, t1_top, t0_bot, t1_bot
    else:
        # rotation == 90 clockwise; the visual layout becomes:
        # visual TL = stored BL, TR = stored TL, BR = stored TR, BL = stored BR
        a, b, c, d = t0_bot, t0_top, t1_bot, t1_top

    edges = (a + b, c + d, a + c, b + d)
    slot_state = {
        "slot0Top": t0_top,
        "slot0Bottom": t0_bot,
        "slot1Top": t1_top,
        "slot1Bottom": t1_bot,
    }
    return edges, slot_state


def expected_edges(level: dict) -> tuple[str, str, str, str]:
    """Reconstruct the expected visual (top, bot, left, right) edges from the level's
    solution slot state.

    Visual matrix is [topLeft, topRight, bottomLeft, bottomRight] = [a, b, c, d].

    For non-rotated levels, slot0 is the LEFT VISUAL column:
        slot0Top=a, slot0Bottom=c, slot1Top=b, slot1Bottom=d
        -> a=slot0Top, b=slot1Top, c=slot0Bottom, d=slot1Bottom

    For rotated levels, the player constructs the stored (pre-rotation) layout. The
    stored layout = visual rotated 90 CCW: stored_TL = visual_TR = b, stored_TR =
    visual_BR = d, stored_BL = visual_TL = a, stored_BR = visual_BL = c. So stored
    columns are left=(b, a), right=(d, c) which become slot0=(top=b, bottom=a) and
    slot1=(top=d, bottom=c). Inverting:
        a = slot0Bottom, b = slot0Top, c = slot1Bottom, d = slot1Top
    """
    s = level["solution"]
    if not level["requiresRotation"]:
        a, b = s["slot0Top"], s["slot1Top"]
        c, d = s["slot0Bottom"], s["slot1Bottom"]
    else:
        a = s["slot0Bottom"]
        b = s["slot0Top"]
        c = s["slot1Bottom"]
        d = s["slot1Top"]
    return a + b, c + d, a + c, b + d


def verify_clue_hygiene(level: dict, edges: tuple[str, str, str, str]) -> tuple[bool, str]:
    """Check the cosmetic/quality rules on the four clues:

      - <= CLUE_CHAR_CAP characters so the screen pills don't overflow.
      - Clue text must not contain any of the puzzle's own 4 compounds.
      - Clue text must not contain BOTH halves of its own answer as words.
    """
    top, bot, left, right = edges
    compound_by_side = {"topRow": top, "bottomRow": bot, "leftCol": left, "rightCol": right}
    # Recover the 4 storage half-words from the visible edges so the half-leakage
    # check can run on the built level without re-reading matrices.json. For a
    # non-rotated visual [a,b,c,d] = [TL,TR,BL,BR], top=a+b -> a, b; bottom=c+d -> c, d.
    # For rotated visual the same a,b,c,d definitions still hold because we already
    # produced the visual matrix in expected_edges().
    s = level["solution"]
    if not level["requiresRotation"]:
        a, b = s["slot0Top"], s["slot1Top"]
        c, d = s["slot0Bottom"], s["slot1Bottom"]
    else:
        a = s["slot0Bottom"]
        b = s["slot0Top"]
        c = s["slot1Bottom"]
        d = s["slot1Top"]
    halves_by_side = {
        "topRow": (a, b),
        "bottomRow": (c, d),
        "leftCol": (a, c),
        "rightCol": (b, d),
    }
    for side, clue in level["hints"].items():
        if len(clue) > CLUE_CHAR_CAP:
            return False, (
                f"level {level['id']} {side}: length {len(clue)} > {CLUE_CHAR_CAP}: {clue!r}"
            )
        low = clue.lower()
        for other_side, word in compound_by_side.items():
            if word.lower() in low:
                tag = "OWN" if other_side == side else f"OTHER {other_side}"
                return False, (
                    f"level {level['id']} {side}={compound_by_side[side]} contains {tag}={word}: {clue!r}"
                )
        h1, h2 = (h.lower() for h in halves_by_side[side])
        words = set(re.findall(r"[a-zA-Z]+", low))
        if h1 in words and h2 in words:
            return False, (
                f"level {level['id']} {side}={compound_by_side[side]} contains BOTH halves "
                f"{h1.upper()}+{h2.upper()}: {clue!r}"
            )
    return True, ""


def verify_overlap_shape(level: dict) -> tuple[bool, str]:
    """THE OVERLAP RULE — every level's 3 decoys must visibly reuse solution words:

      - 2 single-overlap decoys: one solution word + one dead-end filler each
      - 1 double-overlap decoy: two solution words paired in a way that isn't
        either solution tile

    This is a core game-feel mechanic (tiles look like they could work in
    multiple places). Introduced in commit adb7df6; enforced here so no future
    generation path can quietly drop it. Mirrored in
    tests/game/levels-fidelity.test.ts on the TypeScript side.
    """
    s = level["solution"]
    soln_pairs = [
        {s["slot0Top"], s["slot0Bottom"]},
        {s["slot1Top"], s["slot1Bottom"]},
    ]
    soln_words = soln_pairs[0] | soln_pairs[1]

    matched = [False, False]
    decoys = []
    for t in level["tiles"]:
        pair = {t["top"], t["bottom"]}
        for i, sp in enumerate(soln_pairs):
            if not matched[i] and pair == sp:
                matched[i] = True
                break
        else:
            decoys.append(t)

    if not all(matched) or len(decoys) != 3:
        return False, f"level {level['id']}: solution tiles not identifiable among the 5"

    singles = sum(
        1 for t in decoys if (t["top"] in soln_words) + (t["bottom"] in soln_words) == 1
    )
    doubles = sum(
        1 for t in decoys if (t["top"] in soln_words) + (t["bottom"] in soln_words) == 2
    )
    if (singles, doubles) != (2, 1):
        return False, (
            f"level {level['id']}: decoy overlap shape is {singles} singles + {doubles} doubles"
            " — must be exactly 2 single-overlap + 1 double-overlap"
        )
    return True, ""


def verify_level(level: dict, compounds: set[str]) -> tuple[bool, str]:
    tiles = level["tiles"]
    exp_rot = bool(level["requiresRotation"])
    exp_soln = level["solution"]
    exp_edges = expected_edges(level)
    exp_top, exp_bot, exp_left, exp_right = exp_edges

    # Sanity: expected edges should all be in the compound list
    for label, w in (("top", exp_top), ("bot", exp_bot), ("left", exp_left), ("right", exp_right)):
        if w not in compounds:
            return False, (
                f"level {level['id']}: expected {label} edge {w!r} is NOT in compound list"
            )

    ok, err = verify_clue_hygiene(level, exp_edges)
    if not ok:
        return False, err

    ok, err = verify_overlap_shape(level)
    if not ok:
        return False, err

    # The game judges a win purely by VISIBLE edges (isLevelSolved compares the
    # rotated screen reading against the expected edges), and the board rotates
    # freely through 0/90/180/270. Two raw configs are therefore expected to
    # win: the canonical solution at the level's required rotation, and its
    # 180° dual (both tiles swapped and flipped, board turned an extra 180°),
    # which paints the identical screen. Anything beyond those two is a real
    # ambiguity.
    canonical_rot = 90 if exp_rot else 0
    dual_rot = (canonical_rot + 180) % 360
    wins: list[tuple] = []
    canonical_seen = 0

    for i in range(len(tiles)):
        for j in range(len(tiles)):
            if i == j:
                continue
            t0, t1 = tiles[i], tiles[j]
            for flip0, flip1, rot in product((False, True), (False, True), (0, 90, 180, 270)):
                edges, state = edge_compounds(t0, t1, flip0, flip1, rot)
                # NOTE: edge_compounds only distinguishes rot 0 vs 90; extend to
                # 180/270 by applying the quarter-turn transform repeatedly.
                a, b = (t0["bottom"] if flip0 else t0["top"]), (t1["bottom"] if flip1 else t1["top"])
                c, d = (t0["top"] if flip0 else t0["bottom"]), (t1["top"] if flip1 else t1["bottom"])
                st = {"tl": a, "tr": b, "bl": c, "br": d}
                for _ in range(rot // 90):
                    st = {"tl": st["bl"], "tr": st["tl"], "bl": st["br"], "br": st["tr"]}
                edges = (
                    st["tl"] + st["tr"],
                    st["bl"] + st["br"],
                    st["tl"] + st["bl"],
                    st["tr"] + st["br"],
                )

                if edges == exp_edges:
                    wins.append((t0["id"], t1["id"], flip0, flip1, rot))
                    if rot == canonical_rot and state == exp_soln:
                        canonical_seen += 1
                    continue

                # Confusion guard: at the canonical or dual rotation, no other
                # config may form 4 valid compounds — a player could assemble
                # it and reasonably believe they've won.
                if rot in (canonical_rot, dual_rot) and all(e in compounds for e in edges):
                    return False, (
                        f"level {level['id']}: alternate 4-compound config "
                        f"tiles=({t0['id']},{t1['id']}) flip=({flip0},{flip1}) rot={rot} "
                        f"-> top={edges[0]} bot={edges[1]} left={edges[2]} right={edges[3]}"
                    )

    if canonical_seen != 1:
        return False, (
            f"level {level['id']}: canonical solution matched {canonical_seen} times (want 1)"
        )
    if len(wins) != 2:
        return False, (
            f"level {level['id']}: {len(wins)} winning configs (want canonical + 180° dual): {wins}"
        )
    rots = sorted(w[4] for w in wins)
    if rots != sorted([canonical_rot, dual_rot]):
        return False, (
            f"level {level['id']}: winning rotations {rots} != [{canonical_rot}, {dual_rot}]"
        )

    return True, ""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--levels",
        type=Path,
        default=LEVELS_FILE,
        help=f"built levels JSON to verify (default: {LEVELS_FILE.name})",
    )
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    compounds = load_compounds()
    levels = load_levels(args.levels)

    failures = []
    for level in levels:
        ok, err = verify_level(level, compounds)
        if not ok:
            failures.append(err)

    if failures:
        print(f"FAILED: {len(failures)}/{len(levels)} levels failed verification ({args.levels})")
        for f in failures:
            print(f)
        return 1
    print(f"OK: all {len(levels)} levels verified (exactly one valid config each). [{args.levels.name}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
