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


def _build_atomic_vocab(matrices: list[dict], decoys_pool: list[dict]) -> set[str]:
    """All words the game treats as atomic tile halves — pooled from matrices + decoys.

    Anything outside this set is not a candidate decoy half: we want every word a
    player sees to look like a real tile-word, not a random substring.
    """
    vocab: set[str] = set()
    for m in matrices:
        vocab.update(m["matrix"])
    for d in decoys_pool:
        vocab.add(d["top"])
        vocab.add(d["bottom"])
    return vocab


def _filler_pool(
    atomic: set[str], soln_words: set[str], compounds: set[str]
) -> list[str]:
    """Words from the atomic vocab that are 'unused' for this puzzle:
    not a solution word, and not forming a compound with any solution word.
    These are safe to pair with a solution word on a decoy tile — the player sees
    the solution word duplicated but the other half is a dead end.
    """
    return [
        w
        for w in atomic
        if w not in soln_words
        and not any((s + w) in compounds or (w + s) in compounds for s in soln_words)
    ]


def pick_decoys(
    rng: random.Random,
    decoys_pool: list[dict],
    atomic_vocab: set[str],
    t1: dict,
    t2: dict,
    compounds: set[str],
    expected: tuple[str, str, str, str],
) -> tuple[list[dict] | None, str]:
    """Pick 3 decoys that DUPLICATE solution words on extra tiles for confounding overlap.

    Target shape (using level 1 — AIR/PORT + MAN/HOLE — as the example):
      2× single decoys: e.g. HOLE/HOG and AIR/FAIR — each tile contains one of the
          four solution words and one filler word that is genuinely unused.
      1× double decoy:  e.g. PORT/HOLE — two solution words paired in a way that
          isn't either solution tile, so the player sees both words on one tile but
          the vertical can't slot into the puzzle.

    Falls back to 3 singles → legacy decoys if a safe double-overlap pairing
    can't be found. Returns the picked tiles plus a short shape label.
    """
    soln_pair_t1 = (t1["top"], t1["bottom"])
    soln_pair_t2 = (t2["top"], t2["bottom"])
    soln_words = list(soln_pair_t1) + list(soln_pair_t2)
    soln_set = set(soln_words)
    soln_pair_set_t1 = set(soln_pair_t1)
    soln_pair_set_t2 = set(soln_pair_t2)

    fillers = _filler_pool(atomic_vocab, soln_set, compounds)
    rng.shuffle(fillers)
    # Cap fillers — anything past ~40 just slows the search without helping.
    fillers = fillers[:40]

    def _bare(top: str, bot: str) -> dict:
        return {"top": top, "bottom": bot}

    def _safe_against_solution(tile: dict) -> bool:
        return decoy_is_safe(tile, t1, t2, compounds, expected)

    # Build per-solution-word lists of safe single-decoy tiles. For each solution
    # word S, try every filler F in both orientations (S/F and F/S) and keep
    # those that don't create an alternate solution alongside t1/t2.
    singles_by_word: dict[str, list[dict]] = {s: [] for s in soln_set}
    for s in soln_set:
        for f in fillers:
            for top, bot in ((s, f), (f, s)):
                tile = _bare(top, bot)
                if _safe_against_solution(tile):
                    singles_by_word[s].append(tile)
        rng.shuffle(singles_by_word[s])

    # Build double-decoy candidates: pairs of solution words that aren't either
    # solution tile (so they're a genuine mismatch).
    double_candidates: list[dict] = []
    for i, a in enumerate(soln_words):
        for b in soln_words[i + 1 :]:
            if a == b:
                continue
            pair = {a, b}
            if pair == soln_pair_set_t1 or pair == soln_pair_set_t2:
                continue
            for top, bot in ((a, b), (b, a)):
                tile = _bare(top, bot)
                if _safe_against_solution(tile):
                    double_candidates.append(tile)
    rng.shuffle(double_candidates)

    def _triple_safe(tiles: list[dict]) -> bool:
        for i in range(3):
            for j in range(i + 1, 3):
                if not pair_is_safe(tiles[i], tiles[j], compounds, expected):
                    return False
        return True

    def _distinct(tiles: list[dict]) -> bool:
        seen: set[tuple[str, str]] = set()
        for t in tiles:
            key = tuple(sorted([t["top"], t["bottom"]]))
            if key in seen:
                return False
            seen.add(key)
        return True

    # Preferred shape: 2 singles (covering 2 different solution words) + 1 double.
    soln_word_order = list(soln_set)
    rng.shuffle(soln_word_order)
    for i, wa in enumerate(soln_word_order):
        for wb in soln_word_order[i + 1 :]:
            for s1 in singles_by_word[wa]:
                for s2 in singles_by_word[wb]:
                    # Different fillers on the two singles so they look distinct.
                    f1 = s1["top"] if s1["bottom"] == wa else s1["bottom"]
                    f2 = s2["top"] if s2["bottom"] == wb else s2["bottom"]
                    if f1 == f2:
                        continue
                    for d in double_candidates:
                        triple = [s1, s2, d]
                        if not _distinct(triple):
                            continue
                        if _triple_safe(triple):
                            return triple, "2-single-1-double"

    # Fallback A: 3 singles covering 3 different solution words.
    avail: list[tuple[str, dict]] = [
        (s, t) for s in soln_word_order for t in singles_by_word[s]
    ]
    rng.shuffle(avail)
    for i in range(len(avail)):
        wi, ti = avail[i]
        for j in range(i + 1, len(avail)):
            wj, tj = avail[j]
            if wj == wi:
                continue
            for k in range(j + 1, len(avail)):
                wk, tk = avail[k]
                if wk in (wi, wj):
                    continue
                triple = [ti, tj, tk]
                if not _distinct(triple):
                    continue
                if _triple_safe(triple):
                    return triple, "3-singles"

    # Fallback B: legacy pool — neutral decoys with no required overlap.
    legacy = [
        d for d in decoys_pool
        if d["top"] not in soln_set and d["bottom"] not in soln_set
    ]
    legacy = [d for d in legacy if decoy_is_safe(d, t1, t2, compounds, expected)]
    rng.shuffle(legacy)
    for i in range(len(legacy)):
        for j in range(i + 1, len(legacy)):
            if not pair_is_safe(legacy[i], legacy[j], compounds, expected):
                continue
            for k in range(j + 1, len(legacy)):
                if not pair_is_safe(legacy[i], legacy[k], compounds, expected):
                    continue
                if not pair_is_safe(legacy[j], legacy[k], compounds, expected):
                    continue
                return [legacy[i], legacy[j], legacy[k]], "legacy-fallback"
    return None, "no-valid-triple"


def main() -> int:
    compounds = load_compounds()
    matrices = load_matrices()
    decoys = load_decoys()

    rng = random.Random(42)

    # Build atomic vocab once — pooled words from matrices + decoys.
    atomic_vocab = _build_atomic_vocab(matrices, decoys)

    levels = []
    skipped = []
    shape_counts: dict[str, int] = {}
    for m in matrices:
        ok, err = validate_matrix(m, compounds)
        if not ok:
            skipped.append((m.get("id"), err))
            continue

        rotation = bool(m.get("requires_rotation", False))
        t1, t2 = build_solution_tiles(m["matrix"], rotation)
        expected = expected_edges(m["matrix"])

        chosen, shape = pick_decoys(rng, decoys, atomic_vocab, t1, t2, compounds, expected)
        shape_counts[shape] = shape_counts.get(shape, 0) + 1
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
    if shape_counts:
        print("Decoy shape breakdown:")
        for shape, n in sorted(shape_counts.items(), key=lambda kv: -kv[1]):
            print(f"  {shape}: {n}")
    if skipped:
        print(f"Skipped {len(skipped)} matrices:")
        for sid, err in skipped:
            print(f"  id={sid}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
