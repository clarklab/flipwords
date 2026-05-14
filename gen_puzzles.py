import json
import random

words_list = [
    # TopLeft, TopRight, BotLeft, BotRight, TopHint, BotHint, LeftHint, RightHint
    ("AIR", "WAY", "PORT", "SIDE", "Place where airplanes land", "Edge of a road", "Route for planes", "Left side of a ship"),
    ("BED", "BUG", "TIME", "OUT", "When you sleep", "To leave quickly", "Pesky hotel insect", "A pause in a game"),
    ("WATER", "LOG", "FALL", "OUT", "A cascading stream", "Sign off from a computer", "To saturate with liquid", "Radioactive dust"),
    ("LIFE", "BOAT", "GUARD", "HOUSE", "Swimmer who saves you", "Structure on the water", "Vessel for emergencies", "Building for security"),
    ("HEAD", "LIGHT", "LINE", "UP", "Newspaper title", "Illuminate", "Car's front lamp", "A row of people"),
    ("SNOW", "MAN", "BALL", "ROOM", "Winter projectile", "Place to dance", "Frosty figure", "Male human"),
    ("FIRE", "FLY", "WOOD", "WORK", "Lumber", "Effort", "Glowing insect", "Carpentry"),
    ("SUN", "FLOWER", "GLASSES", "CASE", "Eye protection", "Container", "Yellow plant", "Lawsuit"),
    ("NOTE", "BOOK", "PAD", "LOCK", "Writing paper", "Secure closing", "Bound pages", "Arrest"),
    ("PASS", "WORD", "PORT", "HOLE", "Travel document", "Opening in a ship", "Secret phrase", "Verbal unit"),
    ("FOOT", "BALL", "PRINT", "OUT", "Shoe mark", "Produce paper copy", "Soccer", "Emerge"),
    ("CROSS", "BOW", "ROAD", "WAY", "Intersection", "Path", "Medieval weapon", "Method"),
    ("KEY", "BOARD", "HOLE", "PUNCH", "Opening for a lock", "Hit with a fist", "Computer input", "Drink"),
    ("EARTH", "QUAKE", "WORM", "HOLE", "Ground crawler", "Opening", "Seismic event", "Tremble"),
    ("WIND", "MILL", "PIPE", "LINE", "Air tube", "Sequence", "Rotary machine", "Grinder"),
    ("GOLD", "MINE", "RUSH", "HOUR", "Hurry", "60 minutes", "Precious metal excavation", "My own"),
    ("BATH", "ROOM", "TUB", "BEATER", "Washing basin", "Mixing tool", "Place for toilet", "Space"),
    ("WHEEL", "CHAIR", "BARROW", "BOY", "Pushcart", "Male child", "Seat with wheels", "Furniture"),
    ("BONE", "YARD", "MARROW", "FAT", "Core of a bone", "Grease", "Cemetery", "Lawn"),
    ("FISH", "BOWL", "HOOK", "UP", "Curved metal", "Above", "Aquarium", "Container"),
    ("TREE", "HOUSE", "TOP", "DOG", "Highest point", "Canine", "Arboreal dwelling", "Building"),
    ("BIRD", "CAGE", "SEED", "MONEY", "Avian food", "Currency", "Enclosure for pets", "Prison"),
    ("STAR", "LIGHT", "FISH", "NET", "Aquatic animal", "Catching mesh", "Stellar glow", "Illumination"),
    ("MOON", "BEAM", "LIGHT", "HOUSE", "Illumination", "Building", "Lunar ray", "Smile"),
    ("SEA", "SHELL", "WEED", "KILLER", "Unwanted plant", "Murderer", "Ocean casing", "Explosive"),
    ("CAR", "WASH", "PET", "DOG", "Animal companion", "Canine", "Vehicle cleaning", "Laundry"),
    ("DAY", "LIGHT", "TIME", "OUT", "Chronological measure", "Outside", "Sun illumination", "Weight"),
    ("NIGHT", "FALL", "CLUB", "HOUSE", "Gathering place", "Building", "Evening descent", "Drop"),
    ("BLACK", "BIRD", "BOARD", "WALK", "Wooden plank", "Stroll", "Dark avian", "Feathered creature"),
    ("WHITE", "HOUSE", "WASH", "OUT", "Clean with water", "Outside", "Presidential home", "Building"),
    ("BLUE", "BIRD", "BELL", "HOP", "Chime", "Jump", "Azure avian", "Animal"),
    ("RED", "WOOD", "COAT", "RACK", "Outerwear", "Shelf", "Tall tree", "Lumber"),
    ("GREEN", "HOUSE", "HORN", "PIPE", "Musical instrument", "Tube", "Glass building", "Home"),
    ("YELLOW", "TAIL", "JACK", "POT", "Male name", "Vessel", "Fish species", "Appendage"),
    ("BROWN", "BEAR", "OUT", "FIT", "Outside", "Healthy", "Grizzly", "Animal"),
    ("SWEET", "HEART", "PEA", "SOUP", "Green vegetable", "Broth", "Darling", "Organ"),
    ("SOUR", "DOUGH", "PUSS", "CAT", "Feline", "Pet", "Fermented bread", "Money"),
    ("HOT", "DOG", "POTATO", "CHIP", "Spud", "Snack", "Frankfurter", "Canine"),
    ("COLD", "WATER", "BLOOD", "HOUND", "Vital fluid", "Dog", "Chilly liquid", "Drink"),
    ("WARM", "UP", "HEART", "BEAT", "Organ", "Rhythm", "Preparation", "Above"),
    ("FREE", "DOM", "WAY", "WARD", "Path", "Direction", "Liberty", "Title"),
    ("WILD", "LIFE", "CAT", "NIP", "Feline", "Bite", "Untamed animals", "Existence"),
    ("SAFE", "TY", "GUARD", "DOG", "Protector", "Canine", "Security", "Letter"),
    ("HARD", "WOOD", "CORE", "APPLE", "Center", "Fruit", "Solid timber", "Lumber"),
    ("SOFT", "WARE", "BALL", "PARK", "Sphere", "Recreation area", "Computer program", "Goods"),
    ("RICH", "MAN", "LAND", "LORD", "Earth", "Ruler", "Wealthy male", "Human"),
    ("POOR", "HOUSE", "BOY", "HOOD", "Male child", "Covering", "Almshouse", "Building"),
    ("NEW", "YEAR", "AGE", "OLD", "Era", "Elderly", "Jan 1 celebration", "Time"),
    ("OLD", "MAN", "AGE", "LESS", "Era", "Minus", "Elderly male", "Human"),
    ("HIGH", "WAY", "LIGHT", "HOUSE", "Illumination", "Building", "Major road", "Path"),
]

extra_tiles = [
    ("ICE", "CREAM"), ("WIND", "MILL"), ("RAIN", "COAT"), ("EARTH", "WORM"),
    ("AIR", "PLANE"), ("MOON", "LIGHT"), ("STAR", "FISH"), ("SKY", "LARK"),
    ("PAPER", "CLIP"), ("PEN", "CIL"), ("DESK", "TOP"), ("LOCK", "SMITH"),
    ("CODE", "NAME"), ("FOOT", "NOTE"), ("HAND", "BOOK"), ("EAR", "RING"),
    ("CAT", "WALK"), ("DOG", "SLED"), ("FISH", "BOWL"), ("BIRD", "SEED"),
]

# Fix seed for reproducibility, so if run multiple times it gives consistent 30%
random.seed(42)

levels = []
for i, w in enumerate(words_list):
    tl, tr, bl, br, ht, hb, hl, hr = w
    
    requires_rotation = random.random() < 0.30
    
    if requires_rotation:
        # For rotated puzzles, tiles are built from (tl, bl) and (tr, br)
        t1_top, t1_bot = tl, bl
        t2_top, t2_bot = tr, br
        
        # In a rotated puzzle, the required state of the slots when rotated is:
        # s0_bot=tl, s0_top=bl
        # s1_bot=tr, s1_top=br
        # So expected slots:
        slot0Top = bl
        slot0Bottom = tl
        slot1Top = br
        slot1Bottom = tr
    else:
        t1_top, t1_bot = tl, tr
        t2_top, t2_bot = bl, br
        
        slot0Top = tl
        slot0Bottom = tr
        slot1Top = bl
        slot1Bottom = br
    
    # We need 3 more tiles
    extras = random.sample(extra_tiles, 3)
    
    tiles = [
        {"id": "t1", "top": t1_top, "bottom": t1_bot},
        {"id": "t2", "top": t2_top, "bottom": t2_bot},
        {"id": "t3", "top": extras[0][0], "bottom": extras[0][1]},
        {"id": "t4", "top": extras[1][0], "bottom": extras[1][1]},
        {"id": "t5", "top": extras[2][0], "bottom": extras[2][1]},
    ]
    random.shuffle(tiles)
    for j, t in enumerate(tiles):
        t["id"] = f"t{j+1}"
        
    level = {
        "id": i + 1,
        "requiresRotation": requires_rotation,
        "tiles": tiles,
        "hints": {
            "topRow": ht,
            "bottomRow": hb,
            "leftCol": hl,
            "rightCol": hr
        },
        "solution": {
            "slot0Top": slot0Top,
            "slot0Bottom": slot0Bottom,
            "slot1Top": slot1Top,
            "slot1Bottom": slot1Bottom
        }
    }
    levels.append(level)

with open('levels_generated.json', 'w') as f:
    json.dump(levels, f, indent=2)

print(f"Generated {len(levels)} levels. Rotated: {sum(1 for l in levels if l['requiresRotation'])}")
