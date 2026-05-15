#!/usr/bin/env python3
"""Build levels_generated.json from matrices + decoys, validating against compound word list."""

import json
import random
import sys
from itertools import product
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TOOLS_DIR.parent
COMPOUND_FILE = TOOLS_DIR / "compound_words.txt"
MATRICES_FILE = TOOLS_DIR / "matrices.json"
DECOYS_FILE = TOOLS_DIR / "decoys.json"
OUTPUT_FILE = PROJECT_DIR / "levels_generated.json"


def load_compounds() -> set[str]:
    with COMPOUND_FILE.open() as f:
        return {line.strip().upper() for line in f if line.strip()}


def load_matrices() -> list[dict]:
    with MATRICES_FILE.open() as f:
        return json.load(f)


def load_decoys() -> list[dict]:
    with DECOYS_FILE.open() as f:
        return json.load(f)


def validate_matrix(m: dict, compounds: set[str]) -> tuple[bool, str]:
    """Verify all 4 edge concatenations are real compounds and there's no diagonal ambiguity."""
    a, b, c, d = m["matrix"]

    top = a + b
    bottom = c + d
    left = a + c
    right = b + d

    declared = m["compounds"]
    if declared["top"] != top:
        return False, f"matrix[{m['id']}] declared top {declared['top']!r} != computed {top!r}"
    if declared["bottom"] != bottom:
        return False, f"matrix[{m['id']}] declared bottom {declared['bottom']!r} != computed {bottom!r}"
    if declared["left"] != left:
        return False, f"matrix[{m['id']}] declared left {declared['left']!r} != computed {left!r}"
    if declared["right"] != right:
        return False, f"matrix[{m['id']}] declared right {declared['right']!r} != computed {right!r}"

    for label, word in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        if word not in compounds:
            return False, f"matrix[{m['id']}] {label} word {word!r} is not in compound list"

    # Diagonal ambiguity check. If the diagonal/reverse compounds also exist, the puzzle could
    # have an alternate solution if a player put the tile in the "wrong" slot. We reject any
    # matrix where A+D or D+A or B+C or C+B (the diagonals) form a known compound.
    for label, word in (
        ("A+D", a + d),
        ("D+A", d + a),
        ("B+C", b + c),
        ("C+B", c + b),
        # Reverse edges (right-to-left readings) too:
        ("B+A", b + a),
        ("D+C", d + c),
        ("C+A", c + a),
        ("D+B", d + b),
    ):
        if word in compounds:
            return False, f"matrix[{m['id']}] diagonal/reverse {label}={word!r} is also a compound"

    return True, ""


def edge_compounds_for_config(
    tile0: dict, tile1: dict, flip0: bool, flip1: bool, rotation: int
) -> tuple[str, str, str, str]:
    """Compute (top, bottom, left, right) edge compounds for a config.

    The 'stored' matrix is laid out as:
       [t0_top][t1_top]
       [t0_bot][t1_bot]
    with flip0/flip1 swapping the top/bottom on each tile before placement.

    For rotation=90 the player rotates the board 90deg clockwise; per the spec the
    visual layout becomes:
       visual top-left    = stored bottom-left
       visual top-right   = stored top-left
       visual bottom-right= stored top-right
       visual bottom-left = stored bottom-right
    """
    t0_top = tile0["bottom"] if flip0 else tile0["top"]
    t0_bot = tile0["top"] if flip0 else tile0["bottom"]
    t1_top = tile1["bottom"] if flip1 else tile1["top"]
    t1_bot = tile1["top"] if flip1 else tile1["bottom"]

    if rotation == 0:
        # Visual matrix is the stored matrix
        a, b, c, d = t0_top, t1_top, t0_bot, t1_bot
    else:
        # rotation == 90, clockwise
        # visual TL = stored BL = t0_bot
        # visual TR = stored TL = t0_top
        # visual BR = stored TR = t1_top
        # visual BL = stored BR = t1_bot
        a, b, c, d = t0_bot, t0_top, t1_bot, t1_top

    return a + b, c + d, a + c, b + d


def decoy_is_safe(
    decoy: dict, t1: dict, t2: dict, compounds: set[str], expected_edges: tuple[str, str, str, str]
) -> bool:
    """Check that injecting this decoy into any (tiles-choose-2 x flips x rotation) combo doesn't
    produce a complete-but-wrong solution.

    We consider hypothetical 5-tile sets where decoy is one of them, and check whether any pair
    of tiles using the decoy yields 4 valid compounds (regardless of whether they match the
    expected solution). If so, this decoy creates an alternate path -- reject it.
    """
    all_pairs = [(decoy, t1), (decoy, t2), (t1, decoy), (t2, decoy)]
    # We also need to check that the decoy combined with another decoy might create an alt
    # path; but we don't know other decoys yet. We'll cover that during pair-of-decoys checks.
    for pair_tile0, pair_tile1 in all_pairs:
        for flip0, flip1, rot in product((False, True), (False, True), (0, 90)):
            top_w, bot_w, left_w, right_w = edge_compounds_for_config(
                pair_tile0, pair_tile1, flip0, flip1, rot
            )
            if (
                top_w in compounds
                and bot_w in compounds
                and left_w in compounds
                and right_w in compounds
            ):
                # A complete solution exists using this decoy. If it doesn't match the expected
                # edges, that's an alternate solution -> reject decoy. If it DOES match, that's
                # weird but harmless -- but it means the decoy duplicates a solution tile, which
                # we reject anyway.
                cfg = (top_w, bot_w, left_w, right_w)
                if cfg != expected_edges:
                    return False
                # Even if matching, it's an extra valid path: reject (player could pick this).
                return False
    return True


def pair_is_safe(
    d1: dict, d2: dict, compounds: set[str], expected_edges: tuple[str, str, str, str]
) -> bool:
    """Two decoys placed together must not yield a valid 4-compound config."""
    for tile0, tile1 in ((d1, d2), (d2, d1)):
        for flip0, flip1, rot in product((False, True), (False, True), (0, 90)):
            top_w, bot_w, left_w, right_w = edge_compounds_for_config(
                tile0, tile1, flip0, flip1, rot
            )
            if (
                top_w in compounds
                and bot_w in compounds
                and left_w in compounds
                and right_w in compounds
            ):
                cfg = (top_w, bot_w, left_w, right_w)
                if cfg != expected_edges:
                    return False
                return False
    return True


def build_solution_tiles(matrix: list[str], rotation: bool) -> tuple[dict, dict]:
    a, b, c, d = matrix
    if not rotation:
        # t1 = top row, t2 = bottom row -- BUT spec says:
        # "For non-rotated, t1 = {top: matrix[0], bottom: matrix[2]}, t2 = {top: matrix[1], bottom: matrix[3]}"
        # That is: t1 is the LEFT column, t2 is the RIGHT column.
        t1 = {"top": a, "bottom": c}
        t2 = {"top": b, "bottom": d}
    else:
        # "For rotated, t1 = {top: matrix[0], bottom: matrix[1]}, t2 = {top: matrix[2], bottom: matrix[3]}"
        # i.e. tiles built from rows of the unrotated matrix.
        t1 = {"top": a, "bottom": b}
        t2 = {"top": c, "bottom": d}
    return t1, t2


def expected_solution(matrix: list[str], rotation: bool) -> dict:
    """Compute the slot state that produces the visual matrix.

    matrix = [topLeft, topRight, bottomLeft, bottomRight] in VISUAL order.

    For non-rotated puzzles, slot0 is the left column of the visual board:
        slot0 = (top=matrix[0], bottom=matrix[2])
        slot1 = (top=matrix[1], bottom=matrix[3])

    For rotated puzzles, the player builds the stored layout which is the 90-degree
    counter-rotation of the visual. To produce visual [A,B,C,D] via 90 CW rotation,
    stored must be [B, D, A, C] (per the spec's rotation transform). Slot0 is the
    left column of the STORED layout = (top=B=matrix[1], bottom=A=matrix[0]).
    """
    a, b, c, d = matrix
    if not rotation:
        return {
            "slot0Top": a,
            "slot0Bottom": c,
            "slot1Top": b,
            "slot1Bottom": d,
        }
    return {
        "slot0Top": b,
        "slot0Bottom": a,
        "slot1Top": d,
        "slot1Bottom": c,
    }


def expected_edges(matrix: list[str]) -> tuple[str, str, str, str]:
    a, b, c, d = matrix
    return a + b, c + d, a + c, b + d


def pick_decoys(
    rng: random.Random,
    decoys_pool: list[dict],
    t1: dict,
    t2: dict,
    compounds: set[str],
    expected: tuple[str, str, str, str],
) -> list[dict] | None:
    """Pick 3 decoys that are individually safe AND pairwise safe with each other AND with t1/t2."""
    # Filter out decoys that share a word with the solution tiles.
    soln_words = {t1["top"], t1["bottom"], t2["top"], t2["bottom"]}
    candidates = [
        d for d in decoys_pool if d["top"] not in soln_words and d["bottom"] not in soln_words
    ]
    # Filter to individually-safe decoys first.
    candidates = [d for d in candidates if decoy_is_safe(d, t1, t2, compounds, expected)]

    # Shuffle and try to find a triple that is pairwise safe.
    shuffled = candidates[:]
    rng.shuffle(shuffled)

    # Brute force: try combinations.
    for i in range(len(shuffled)):
        for j in range(i + 1, len(shuffled)):
            if not pair_is_safe(shuffled[i], shuffled[j], compounds, expected):
                continue
            for k in range(j + 1, len(shuffled)):
                if not pair_is_safe(shuffled[i], shuffled[k], compounds, expected):
                    continue
                if not pair_is_safe(shuffled[j], shuffled[k], compounds, expected):
                    continue
                return [shuffled[i], shuffled[j], shuffled[k]]
    return None


def main() -> int:
    compounds = load_compounds()
    matrices = load_matrices()
    decoys = load_decoys()

    rng = random.Random(42)

    levels = []
    skipped = []
    for m in matrices:
        ok, err = validate_matrix(m, compounds)
        if not ok:
            skipped.append((m.get("id"), err))
            continue

        rotation = bool(m.get("requires_rotation", False))
        t1, t2 = build_solution_tiles(m["matrix"], rotation)
        expected = expected_edges(m["matrix"])

        chosen = pick_decoys(rng, decoys, t1, t2, compounds, expected)
        if chosen is None:
            skipped.append((m.get("id"), "could not pick safe decoys"))
            continue

        tiles = [
            {"id": "t1", "top": t1["top"], "bottom": t1["bottom"]},
            {"id": "t2", "top": t2["top"], "bottom": t2["bottom"]},
            {"id": "t3", "top": chosen[0]["top"], "bottom": chosen[0]["bottom"]},
            {"id": "t4", "top": chosen[1]["top"], "bottom": chosen[1]["bottom"]},
            {"id": "t5", "top": chosen[2]["top"], "bottom": chosen[2]["bottom"]},
        ]
        rng.shuffle(tiles)
        for idx, t in enumerate(tiles):
            t["id"] = f"t{idx + 1}"

        clues = m["clues"]
        soln = expected_solution(m["matrix"], rotation)

        # Tier is curated in matrices.json (1=easy, 2=medium, 3=hard) and
        # drives the session picker's difficulty escalation. Default to 1 if
        # a matrix entry forgets to set it.
        tier = int(m.get("tier", 1))
        levels.append(
            {
                "id": len(levels) + 1,
                "tier": tier,
                "requiresRotation": rotation,
                "tiles": tiles,
                "hints": {
                    "topRow": clues["top"],
                    "bottomRow": clues["bottom"],
                    "leftCol": clues["left"],
                    "rightCol": clues["right"],
                },
                "solution": soln,
            }
        )

    OUTPUT_FILE.write_text(json.dumps(levels, indent=2) + "\n")

    print(f"Built {len(levels)} levels -> {OUTPUT_FILE}")
    if skipped:
        print(f"Skipped {len(skipped)} matrices:")
        for sid, err in skipped:
            print(f"  id={sid}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
