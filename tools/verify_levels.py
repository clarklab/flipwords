#!/usr/bin/env python3
"""Verify levels_generated.json: each level must have EXACTLY ONE valid configuration.

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


def load_levels() -> list[dict]:
    with LEVELS_FILE.open() as f:
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

    valid_configs: list[str] = []
    matching = 0

    for i in range(len(tiles)):
        for j in range(len(tiles)):
            if i == j:
                continue
            t0, t1 = tiles[i], tiles[j]
            for flip0, flip1, rot in product((False, True), (False, True), (0, 90)):
                edges, state = edge_compounds(t0, t1, flip0, flip1, rot)
                if not all(e in compounds for e in edges):
                    continue

                rot_matches = (rot == 90) == exp_rot
                edges_match = edges == exp_edges
                state_match = state == exp_soln

                desc = (
                    f"  tiles=({t0['id']},{t1['id']}) flip=({flip0},{flip1}) rot={rot} "
                    f"-> top={edges[0]} bot={edges[1]} left={edges[2]} right={edges[3]} "
                    f"state={state} rotMatch={rot_matches} edgesMatch={edges_match} stateMatch={state_match}"
                )
                valid_configs.append(desc)

                if rot_matches and edges_match and state_match:
                    matching += 1

    if matching == 0:
        return False, (
            f"level {level['id']}: NO config matches expected solution.\n"
            + "\n".join(valid_configs[:15])
        )
    if matching > 1:
        return False, (
            f"level {level['id']}: {matching} configs match expected solution — ambiguous"
        )

    # Now check: is there any OTHER config (i.e. all 4 in compound list AND matches level
    # rotation flag, even if state doesn't match) that the player could ALSO win with?
    # That counts as ambiguity from the player's perspective.
    alt = 0
    alt_descs: list[str] = []
    for i in range(len(tiles)):
        for j in range(len(tiles)):
            if i == j:
                continue
            t0, t1 = tiles[i], tiles[j]
            for flip0, flip1, rot in product((False, True), (False, True), (0, 90)):
                edges, state = edge_compounds(t0, t1, flip0, flip1, rot)
                if not all(e in compounds for e in edges):
                    continue
                rot_matches = (rot == 90) == exp_rot
                if not rot_matches:
                    continue
                # All 4 valid + rotation matches the level's requirement.
                # If edges differ from expected_edges OR state differs from expected_soln,
                # that's an alternate winning path.
                if edges != exp_edges or state != exp_soln:
                    alt += 1
                    alt_descs.append(
                        f"  ALT tiles=({t0['id']},{t1['id']}) flip=({flip0},{flip1}) rot={rot} "
                        f"-> top={edges[0]} bot={edges[1]} left={edges[2]} right={edges[3]}"
                    )

    if alt > 0:
        return False, (
            f"level {level['id']}: {alt} alternate winning configs (same rotation flag, all 4 compounds)\n"
            + "\n".join(alt_descs[:8])
        )

    return True, ""


def main() -> int:
    compounds = load_compounds()
    levels = load_levels()

    failures = []
    for level in levels:
        ok, err = verify_level(level, compounds)
        if not ok:
            failures.append(err)

    if failures:
        print(f"FAILED: {len(failures)}/{len(levels)} levels failed verification")
        for f in failures:
            print(f)
        return 1
    print(f"OK: all {len(levels)} levels verified (exactly one valid config each).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
