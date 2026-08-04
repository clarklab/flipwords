#!/usr/bin/env python3
"""Search for Texas-flavored 2x2 matrices for "The Texas Two-Step".

A candidate matrix [A, B, C, D] lays out visually as

    A B
    C D

and must satisfy the same constraints build_levels.py/verify_levels.py enforce:

  1. A+B, C+D, A+C, B+D are all in the compound universe.
  2. None of A+D, D+A, B+C, C+B, B+A, D+C, C+A, D+B is in the universe
     (the anti-ambiguity net).

This script does NOT write clues — it surfaces ranked candidates so a human
(or an editor) can write the clue copy. Ranking is by "Texas density": how many
of the four edge compounds are genuinely Texan.

Usage:
    python3 tools/find_texas_matrices.py            # ranked candidate dump
    python3 tools/find_texas_matrices.py --word OAK # only matrices touching OAK
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
COMPOUND_FILE = TOOLS_DIR / "compound_words.txt"
MATRICES_FILE = TOOLS_DIR / "matrices.json"
DECOYS_FILE = TOOLS_DIR / "decoys.json"

# ---------------------------------------------------------------------------
# CANDIDATE ADDITIONS
#
# Compounds not yet in compound_words.txt that the Texas edition wants. Each is
# stored with its canonical split so the solver knows both halves are real tile
# words. The game renders the two halves on adjacent tiles, so OPEN compounds
# ("HILL COUNTRY", "BLACK GOLD") read correctly on screen and are fair game --
# but every entry here must be a real, recognizable English compound or an
# established proper phrase. No coinages.
#
# NOTHING here is committed to compound_words.txt automatically. Only the
# entries actually used by a shipped matrix get added, because every addition
# widens the anti-ambiguity net and can invalidate existing puzzles.
#
# THE STANDALONE-HALF RULE. Every entry here is split across two tiles, and each
# half is rendered ALONE on screen -- flipping a tile puts the bottom half on
# top. So a compound is only admissible if BOTH halves are safe standing by
# themselves. Deliberately absent, and not to be re-added:
#
#   HONKY/TONK   -- surfaces HONKY
#   BACK/HOE     -- surfaces HOE (M-W: US slang, disparaging + offensive)
#   HILL/BILLY   -- hillbilly is M-W "often disparaging + offensive", and the
#   BILLY/CLUB      grid it formed surfaced BILLY on its own tile
#
# Same rule killed FIREWATER (Dictionary.com "Often Offensive") and OUTBACK
# ("especially of Australia") for this edition; both are still reachable
# through compound_words.txt because the base FlipWords set uses them, so a
# candidate touching either is a reject, not a find. See
# tests/edition/tile-halves.test.ts for the shipped guard.
# ---------------------------------------------------------------------------
CANDIDATE_ADDITIONS: list[tuple[str, str]] = [
    # --- Ranch & cattle -----------------------------------------------------
    ("COW", "TOWN"),        # Cow Town -- Fort Worth's long-standing nickname
    ("COW", "HAND"),        # cowhand
    ("BUNK", "HOUSE"),      # bunkhouse
    ("RANCH", "HOUSE"),     # ranch house
    ("CATTLE", "GUARD"),    # cattle guard
    ("CATTLE", "DRIVE"),    # cattle drive
    ("STOCK", "TANK"),      # stock tank
    ("FEED", "LOT"),        # feedlot
    ("FEED", "STORE"),      # feed store
    ("WAGON", "WHEEL"),     # wagon wheel
    ("BARBED", "WIRE"),     # barbed wire
    ("QUARTER", "HORSE"),   # quarter horse
    ("KING", "RANCH"),      # King Ranch
    ("LONE", "STAR"),       # Lone Star
    ("LONG", "HAND"),       # longhand
    # --- Oil ----------------------------------------------------------------
    ("OIL", "MAN"),         # oilman
    ("OIL", "WELL"),        # oil well
    ("OIL", "PATCH"),       # the Oil Patch
    ("OIL", "RIG"),         # oil rig
    ("WELL", "HEAD"),       # wellhead
    ("PUMP", "JACK"),       # pumpjack
    ("BOOM", "TOWN"),       # boomtown
    ("BLACK", "GOLD"),      # black gold
    ("CRUDE", "OIL"),       # crude oil
    ("GOLD", "RUSH"),       # gold rush
    ("WILD", "CATTER"),     # wildcatter
    ("DRILL", "BIT"),       # drill bit
    # --- Music & dance ------------------------------------------------------
    ("TWO", "STEP"),        # two-step
    ("DANCE", "HALL"),      # dance hall
    ("DANCE", "FLOOR"),     # dance floor
    ("BAND", "STAND"),      # bandstand
    ("BAND", "LEADER"),     # bandleader
    ("BACK", "BEAT"),       # backbeat
    ("BLUE", "GRASS"),      # bluegrass
    ("JUKE", "BOX"),        # jukebox
    ("BAR", "ROOM"),        # barroom
    ("STAR", "DUST"),       # stardust
    ("RED", "DIRT"),        # red dirt (the Texas/Oklahoma music scene)
    ("HALL", "MARK"),       # hallmark
    ("STEEL", "GUITAR"),    # steel guitar
    ("RAIN", "DANCE"),      # rain dance
    ("SONG", "WRITING"),    # songwriting
    # --- Barbecue & food ----------------------------------------------------
    ("PIT", "MASTER"),      # pitmaster
    ("POST", "OAK"),        # post oak
    ("LIVE", "OAK"),        # live oak
    ("BUTCHER", "PAPER"),   # butcher paper
    ("MEAT", "MARKET"),     # meat market
    ("CHUCK", "WAGON"),     # chuck wagon
    ("HOT", "LINK"),        # hot link
    ("CORN", "DOG"),        # corn dog
    ("SWEET", "TEA"),       # sweet tea
    ("FOOD", "TRUCK"),      # food truck
    ("STEAK", "HOUSE"),     # steakhouse
    ("PIT", "STOP"),        # pit stop
    ("FIRE", "PIT"),        # fire pit
    ("SAND", "PIT"),        # sandpit
    ("PECAN", "PIE"),       # pecan pie
    ("HOT", "PLATE"),       # hot plate
    ("HOT", "SAUCE"),       # hot sauce
    ("SIDE", "DISH"),       # side dish
    ("MEAT", "LOAF"),       # meatloaf
    # --- Land, weather, wildlife -------------------------------------------
    ("BLUE", "BONNET"),     # bluebonnet -- the state flower
    ("MOCKING", "BIRD"),    # mockingbird -- the state bird
    ("PRAIRIE", "DOG"),     # prairie dog
    ("BOB", "CAT"),         # bobcat
    ("HILL", "COUNTRY"),    # Hill Country
    ("COUNTRY", "SIDE"),    # countryside
    ("COUNTRY", "CLUB"),    # country club
    ("BIG", "BEND"),        # Big Bend
    ("GULF", "COAST"),      # Gulf Coast
    ("RIVER", "WALK"),      # the River Walk
    ("CAP", "ROCK"),        # the Caprock
    ("ROCK", "SALT"),       # rock salt
    ("SALT", "LICK"),       # salt lick
    ("SALT", "BOX"),        # saltbox
    ("RANGE", "LAND"),      # rangeland
    ("BAD", "LANDS"),       # badlands
    ("DUST", "STORM"),      # dust storm
    ("DUST", "BOWL"),       # the Dust Bowl
    ("BARN", "STORM"),      # barnstorm
    ("FLASH", "FLOOD"),     # flash flood
    ("HEAT", "WAVE"),       # heat wave
    ("SWIMMING", "HOLE"),   # swimming hole
    ("BORDER", "TOWN"),     # border town
    ("BORDER", "LINE"),     # borderline
    ("GHOST", "TOWN"),      # ghost town
    ("PRICKLY", "PEAR"),    # prickly pear
    # --- Space --------------------------------------------------------------
    ("SPACE", "CITY"),      # Space City -- Houston
    ("MISSION", "CONTROL"), # Mission Control
    ("ASTRO", "DOME"),      # the Astrodome
    ("ASTRO", "TURF"),      # AstroTurf
    ("LIFT", "OFF"),        # liftoff
    ("SPACE", "SUIT"),      # spacesuit
    ("FLIGHT", "DECK"),     # flight deck
    ("CITY", "LIMITS"),     # city limits
    ("CITY", "HALL"),       # city hall
    # --- Friday nights ------------------------------------------------------
    ("QUARTER", "BACK"),    # quarterback
    ("GOAL", "POST"),       # goalpost
    ("END", "ZONE"),        # end zone
    ("PRESS", "BOX"),       # press box
    ("SCORE", "BOARD"),     # scoreboard
    ("FIELD", "HOUSE"),     # field house
    ("FIELD", "GOAL"),      # field goal
    ("FIELD", "TRIP"),      # field trip
    ("BACK", "FIELD"),      # backfield
    ("MID", "FIELD"),       # midfield
    ("BATTLE", "FIELD"),    # battlefield
    ("PEP", "TALK"),        # pep talk
    ("SPRING", "BREAK"),    # spring break
    ("STATE", "FAIR"),      # state fair
    ("SIX", "FLAGS"),       # Six Flags
    # --- Frontier -----------------------------------------------------------
    ("SIX", "SHOOTER"),     # six-shooter
    ("HIGH", "NOON"),       # high noon
    ("GUN", "SLINGER"),     # gunslinger
    ("BACK", "ROAD"),       # back road
    ("POST", "MASTER"),     # postmaster
    ("FENCE", "POST"),      # fence post
    ("LONE", "SOME"),       # lonesome
    ("BIG", "HORN"),        # bighorn
    ("BIG", "TIME"),        # big time
    ("LONG", "TIME"),       # longtime
    ("TWO", "SOME"),        # twosome
    ("SIDE", "MAN"),        # sideman
    ("PIT", "BULL"),        # pit bull
    ("GAS", "PUMP"),        # gas pump
    ("HEAT", "PUMP"),       # heat pump
]


def load_compounds() -> set[str]:
    with COMPOUND_FILE.open() as f:
        return {line.strip().upper() for line in f if line.strip()}


def load_json(p: Path):
    with p.open() as f:
        return json.load(f)


def build_half_vocab(matrices: list[dict], decoys: list[dict]) -> set[str]:
    """Words the game already treats as atomic tile halves, plus Texas halves.

    Restricting splits to this vocabulary is what keeps the solver from
    proposing garbage halves ("PORCU"/"PINE"). Everything in here is either
    already shipped as a tile word or is a curated Texas half.
    """
    vocab: set[str] = set()
    for m in matrices:
        vocab.update(m["matrix"])
    for d in decoys:
        vocab.add(d["top"])
        vocab.add(d["bottom"])
    for head, tail in CANDIDATE_ADDITIONS:
        vocab.add(head)
        vocab.add(tail)
    return vocab


WORDS_FILE = Path("/usr/share/dict/words")


def english_words() -> set[str]:
    """Uppercased dictionary words, for validating candidate tile halves."""
    if not WORDS_FILE.exists():
        return set()
    with WORDS_FILE.open() as f:
        return {line.strip().upper() for line in f if line.strip()}


def expand_vocab(compounds: set[str], seed: set[str], min_srcs: int, gens: int) -> set[str]:
    """Grow the half vocabulary generation by generation.

    Any word W in the compound list that splits cleanly as (seed word + X) or
    (X + seed word) makes X a plausible tile half -- provided X is a real
    English word and shows up as a split-part of at least `min_srcs` distinct
    compounds. The dictionary check keeps out junk fragments; the source count
    keeps out real-but-unproductive words, which would only bloat the search.
    """
    lex = english_words()
    vocab = set(seed)
    for _ in range(gens):
        counts: dict[str, set[str]] = defaultdict(set)
        for w in compounds:
            for i in range(3, len(w) - 2):
                head, tail = w[:i], w[i:]
                if head in vocab:
                    counts[tail].add(w)
                if tail in vocab:
                    counts[head].add(w)
        grown = {
            x
            for x, srcs in counts.items()
            if len(srcs) >= min_srcs and len(x) >= 3 and (not lex or x in lex)
        }
        if grown <= vocab:
            break
        vocab |= grown
    return vocab


def build_edges(compounds: set[str], vocab: set[str]) -> dict[str, set[str]]:
    """right[X] = {Y : X+Y is a compound, and both X and Y are tile words}."""
    right: dict[str, set[str]] = defaultdict(set)
    for w in compounds:
        for i in range(2, len(w) - 1):
            head, tail = w[:i], w[i:]
            if head in vocab and tail in vocab:
                right[head].add(tail)
    return right


# Compounds that carry real Texas weight. Used only for ranking.
TEXAS_WEIGHT = {
    3: {
        "LONGHORN", "BLUEBONNET", "PITMASTER", "RIVERWALK", "STOCKYARD", "TWOSTEP",
        "DANCEHALL", "ROUGHNECK", "PUMPJACK", "WILDCAT", "BOOMTOWN", "BLACKGOLD",
        "OILFIELD", "PANHANDLE", "BIGBEND", "GULFCOAST", "LIVEOAK", "MOCKINGBIRD",
        "PRAIRIEDOG", "RATTLESNAKE", "ROADRUNNER", "TUMBLEWEED", "DUSTBOWL",
        "SALTLICK", "SMOKEHOUSE", "POSTOAK", "BUTCHERPAPER", "MEATMARKET",
        "CHUCKWAGON", "CORNBREAD", "CORNDOG", "STATEFAIR", "ICEHOUSE", "SPACECITY",
        "MISSIONCONTROL", "ASTRODOME", "ASTROTURF", "LAUNCHPAD", "MOONSHOT",
        "COUNTDOWN", "LIFTOFF", "TOUCHDOWN", "TAILGATE", "QUARTERBACK",
        "SIXSHOOTER", "HORSEBACK", "GHOSTTOWN", "OUTLAW", "REDDIRT", "LONESTAR",
        "SIXFLAGS", "CITYLIMITS", "BLUEBELL", "KINGRANCH", "FOODTRUCK",
        "WILDFLOWER", "COTTONWOOD", "HILLCOUNTRY", "QUARTERHORSE", "STOCKTANK",
        "CATTLEDRIVE", "CATTLEGUARD", "CAPROCK", "OILPATCH", "OILMAN", "OILWELL",
        "OILRIG", "WILDCATTER", "COWTOWN", "BARBEDWIRE", "SWEETTEA", "HOTLINK",
        "JACKRABBIT", "SEAWALL", "HOMECOMING", "SPRINGBREAK", "BLUEGRASS",
        "SONGWRITER", "SADDLEBAG", "DUSTSTORM", "SANDSTORM", "HIGHNOON",
    },
    2: {
        "COWBOY", "COWHAND", "COWHIDE", "COWPOKE", "RANCHHAND", "RANCHHOUSE",
        "BUNKHOUSE", "ROADHOUSE", "HORSESHOE", "WINDMILL", "HAYRIDE", "HAYLOFT",
        "HAYSTACK", "BARNYARD", "BARNSTORM", "STAGECOACH", "GUNFIGHT",
        "GUNSLINGER", "SHOWDOWN", "HOEDOWN", "ROUNDUP", "PIPELINE", "WELLHEAD",
        "CRUDEOIL", "DRILLBIT", "GOLDRUSH", "BANDSTAND", "DANCEFLOOR", "JUKEBOX",
        "BACKBEAT", "STARDUST", "SUNDOWN", "SUNRISE", "SUNSET", "SUNFLOWER",
        "HOMESTEAD", "FLATLAND", "RANGELAND", "GRASSLAND", "WATERHOLE",
        "SWIMMINGHOLE", "BORDERTOWN", "BACKROAD", "BACKWOODS", "FENCEPOST",
        "SPACEWALK", "SPACESHIP", "SPACECRAFT", "SPACESUIT", "MOONWALK",
        "SPLASHDOWN", "FLIGHTDECK", "GOALPOST", "ENDZONE", "PRESSBOX",
        "SCOREBOARD", "FIELDHOUSE", "FIELDGOAL", "HALFTIME", "KICKOFF",
        "SIDELINE", "FOOTBALL", "PEPTALK", "STEAKHOUSE", "PITSTOP", "FIREPIT",
        "PECANPIE", "HOTSAUCE", "MEATLOAF", "FOOTHILL", "HILLTOP", "HILLSIDE",
        "COUNTRYSIDE", "COUNTRYCLUB", "SALTWATER", "SANDBAR", "FLASHFLOOD",
        "HEATWAVE", "THUNDERSTORM", "WINDSTORM", "LIMESTONE", "SANDSTONE",
        "BEDROCK", "PRICKLYPEAR", "BOBCAT", "CATFISH", "RACEHORSE", "WORKHORSE",
        "HORSEPOWER", "HORSEMAN", "BLACKLAND", "BLUEBIRD", "STEELGUITAR",
        "TWOSOME", "LONESOME", "BIGHORN", "BIGTIME", "WAGONWHEEL", "FEEDLOT",
        "FEEDSTORE", "CATTLECALL", "BARROOM", "REDNECK",
    },
}


def texas_score(edges: tuple[str, ...]) -> int:
    return sum(3 if e in TEXAS_WEIGHT[3] else 2 if e in TEXAS_WEIGHT[2] else 0 for e in edges)


EMPTY: frozenset[str] = frozenset()

BAD_PAIRS = (
    ("A", "D"), ("D", "A"), ("B", "C"), ("C", "B"),
    ("B", "A"), ("D", "C"), ("C", "A"), ("D", "B"),
)


def search(compounds: set[str], right: dict[str, set[str]], focus: str | None):
    """Yield (score, [A,B,C,D], (top, bottom, left, right)) for every legal matrix."""
    heads = sorted(right)
    seen: set[tuple[str, ...]] = set()
    for a in heads:
        outs = right[a]
        if len(outs) < 2:
            continue
        for b in outs:
            for c in outs:
                if c == b or c == a:
                    continue
                for d in right.get(c, EMPTY) & right.get(b, EMPTY):
                    if d in (a, b, c):
                        continue
                    cells = {"A": a, "B": b, "C": c, "D": d}
                    if any(cells[x] + cells[y] in compounds for x, y in BAD_PAIRS):
                        continue
                    edges = (a + b, c + d, a + c, b + d)
                    if len(set(edges)) != 4:
                        continue
                    key = (a, b, c, d)
                    if key in seen:
                        continue
                    seen.add(key)
                    if focus and focus not in (a, b, c, d):
                        continue
                    yield texas_score(edges), [a, b, c, d], edges


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--word", help="only show matrices that use this half word")
    ap.add_argument("--top", type=int, default=400, help="how many candidates to print")
    ap.add_argument("--min-score", type=int, default=3)
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    ap.add_argument("--vocab-min", type=int, default=2, help="min compounds a grown half must appear in")
    ap.add_argument("--vocab-gens", type=int, default=2, help="vocabulary growth generations")
    ap.add_argument("--show-vocab", action="store_true")
    args = ap.parse_args()

    base = load_compounds()
    universe = set(base)
    for head, tail in CANDIDATE_ADDITIONS:
        universe.add(head + tail)

    matrices = load_json(MATRICES_FILE)
    decoys = load_json(DECOYS_FILE)
    seed = build_half_vocab(matrices, decoys)
    vocab = expand_vocab(universe, seed, args.vocab_min, args.vocab_gens)
    right = build_edges(universe, vocab)

    if args.show_vocab:
        print(f"{len(vocab)} halves")
        print(" ".join(sorted(vocab)))
        return 0

    results = [r for r in search(universe, right, args.word) if r[0] >= args.min_score]
    results.sort(key=lambda r: (-r[0], r[1]))

    if args.json:
        json.dump(
            [{"score": s, "matrix": m, "edges": list(e)} for s, m, e in results[: args.top]],
            sys.stdout,
            indent=1,
        )
        print()
        return 0

    print(f"vocab={len(vocab)} halves, universe={len(universe)} compounds")
    print(f"{len(results)} candidates at score >= {args.min_score}\n")
    for s, m, e in results[: args.top]:
        new = [w for w in e if w not in base]
        tag = f"  NEW:{','.join(new)}" if new else ""
        print(f"[{s:>2}] {m[0]:<9}{m[1]:<9} | top={e[0]:<16} left={e[2]:<16}{tag}")
        print(f"     {m[2]:<9}{m[3]:<9} | bot={e[1]:<16} right={e[3]:<16}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
