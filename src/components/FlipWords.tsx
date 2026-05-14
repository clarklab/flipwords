import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import TutorialModal from "./TutorialModal";

type TileData = { id: string; top: string; bottom: string; isFlipped: boolean };
type SlotsState = [TileData | null, TileData | null];

export type Level = {
  id: number;
  requiresRotation?: boolean;
  tiles: { id: string; top: string; bottom: string }[];
  hints: {
    topRow: string;
    bottomRow: string;
    leftCol: string;
    rightCol: string;
  };
  solution: {
    slot0Top: string;
    slot0Bottom: string;
    slot1Top: string;
    slot1Bottom: string;
  };
};

export type HintActionKind = "addTile" | "removeTile" | "rotateTile" | "rotateBoard";

export type HintStep = {
  action: HintActionKind;
  text: string;
};

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

const getTileFaceInSlot = (tile: TileData) => {
  if (tile.isFlipped) {
    return { top: tile.bottom, bottom: tile.top };
  }
  return { top: tile.top, bottom: tile.bottom };
};

const getTargetRotation = (level: Level) => (level.requiresRotation ? 90 : 0);

const getExpectedFacesForSlot = (level: Level, slotIdx: 0 | 1) => {
  if (slotIdx === 0) {
    return { top: level.solution.slot0Top, bottom: level.solution.slot0Bottom };
  }
  return { top: level.solution.slot1Top, bottom: level.solution.slot1Bottom };
};

const findSolutionTileForSlot = (level: Level, slotIdx: 0 | 1) => {
  const expected = getExpectedFacesForSlot(level, slotIdx);
  const tile = level.tiles.find(
    (candidate) =>
      (candidate.top === expected.top && candidate.bottom === expected.bottom) ||
      (candidate.top === expected.bottom && candidate.bottom === expected.top)
  );

  if (!tile) {
    return null;
  }

  return {
    tile,
    shouldFlip: tile.top !== expected.top,
    expected,
  };
};

const sanitizeState = (level: Level, slotsInput: SlotsState, bankInput: TileData[]) => {
  const canonicalById = new Map(level.tiles.map((tile) => [tile.id, tile]));
  const validIdSet = new Set(level.tiles.map((tile) => tile.id));
  const orientationById = new Map<string, boolean>();
  const occupied = new Set<string>();

  const normalizedSlots: SlotsState = [null, null];
  for (let idx = 0; idx < 2; idx++) {
    const tile = slotsInput[idx];
    if (!tile || !validIdSet.has(tile.id) || occupied.has(tile.id)) {
      normalizedSlots[idx as 0 | 1] = null;
      continue;
    }
    orientationById.set(tile.id, tile.isFlipped);
    occupied.add(tile.id);
    const canonical = canonicalById.get(tile.id)!;
    normalizedSlots[idx as 0 | 1] = { ...canonical, isFlipped: tile.isFlipped };
  }

  const bankOrder: string[] = [];
  for (const tile of bankInput) {
    if (!validIdSet.has(tile.id) || occupied.has(tile.id)) {
      continue;
    }
    if (!orientationById.has(tile.id)) {
      orientationById.set(tile.id, tile.isFlipped);
    }
    if (!bankOrder.includes(tile.id)) {
      bankOrder.push(tile.id);
    }
  }

  for (const tile of level.tiles) {
    if (!occupied.has(tile.id) && !bankOrder.includes(tile.id)) {
      bankOrder.push(tile.id);
    }
  }

  const normalizedBank = bankOrder
    .filter((id) => !occupied.has(id))
    .map((id) => {
      const canonical = canonicalById.get(id)!;
      return {
        ...canonical,
        isFlipped: orientationById.get(id) ?? false,
      };
    });

  return { slots: normalizedSlots, bank: normalizedBank };
};

const getNextHintAction = (
  level: Level,
  slotsInput: SlotsState,
  bankInput: TileData[],
  boardRotation: number
) => {
  const { slots } = sanitizeState(level, slotsInput, bankInput);

  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (current && current.id !== target.tile.id) {
      return {
        action: "removeTile" as const,
        text: `Remove the wrong tile from Slot ${slotIdx + 1}.`,
      };
    }
  }

  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (!current) {
      return {
        action: "addTile" as const,
        text: `Add ${target.tile.top}/${target.tile.bottom} to Slot ${slotIdx + 1}.`,
      };
    }
  }

  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (!current || current.id !== target.tile.id) continue;
    if (current.isFlipped !== target.shouldFlip) {
      return {
        action: "rotateTile" as const,
        text: `Rotate the tile in Slot ${slotIdx + 1}.`,
      };
    }
  }

  if (normalizeRotation(boardRotation) !== getTargetRotation(level)) {
    return {
      action: "rotateBoard" as const,
      text: "Rotate the board 90 degrees.",
    };
  }

  return {
    action: null,
    text: "Everything is already aligned.",
  };
};

export const getLevelHintPattern = (level: Level): HintStep[] => {
  const steps: HintStep[] = [];

  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    steps.push({
      action: "removeTile",
      text: `If Slot ${slotIdx + 1} has a wrong tile, remove it back to the bank.`,
    });
    steps.push({
      action: "addTile",
      text: `Add ${target.tile.top}/${target.tile.bottom} to Slot ${slotIdx + 1}.`,
    });
    steps.push({
      action: "rotateTile",
      text: `If Slot ${slotIdx + 1} reads backwards, rotate that tile once.`,
    });
  }

  if (level.requiresRotation) {
    steps.push({
      action: "rotateBoard",
      text: "Rotate the board clockwise once to match the clue orientation.",
    });
  } else {
    steps.push({
      action: "rotateBoard",
      text: "If the board is rotated, rotate it back to upright.",
    });
  }

  return steps;
};

export const getSolvedEdgeAnswers = (level: Level) => {
  const a = level.solution.slot0Top;
  const b = level.solution.slot1Top;
  const c = level.solution.slot0Bottom;
  const d = level.solution.slot1Bottom;

  if (level.requiresRotation) {
    return {
      top: `${c}${a}`,
      bottom: `${d}${b}`,
      left: `${c}${d}`,
      right: `${a}${b}`,
    };
  }

  return {
    top: `${a}${b}`,
    bottom: `${c}${d}`,
    left: `${a}${c}`,
    right: `${b}${d}`,
  };
};

export const allLevels: Level[] = [
  {
    "id": 1,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t2",
        "top": "AIR",
        "bottom": "WAY"
      },
      {
        "id": "t3",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t4",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t5",
        "top": "PORT",
        "bottom": "SIDE"
      }
    ],
    "hints": {
      "topRow": "Place where airplanes land",
      "bottomRow": "Edge of a road",
      "leftCol": "Route for planes",
      "rightCol": "Left side of a ship"
    },
    "solution": {
      "slot0Top": "AIR",
      "slot0Bottom": "WAY",
      "slot1Top": "PORT",
      "slot1Bottom": "SIDE"
    }
  },
  {
    "id": 2,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "TIME",
        "bottom": "OUT"
      },
      {
        "id": "t2",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t3",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t4",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t5",
        "top": "BED",
        "bottom": "BUG"
      }
    ],
    "hints": {
      "topRow": "When you sleep",
      "bottomRow": "To leave quickly",
      "leftCol": "Pesky hotel insect",
      "rightCol": "A pause in a game"
    },
    "solution": {
      "slot0Top": "BED",
      "slot0Bottom": "BUG",
      "slot1Top": "TIME",
      "slot1Bottom": "OUT"
    }
  },
  {
    "id": 3,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t2",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t3",
        "top": "WATER",
        "bottom": "FALL"
      },
      {
        "id": "t4",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t5",
        "top": "LOG",
        "bottom": "OUT"
      }
    ],
    "hints": {
      "topRow": "A cascading stream",
      "bottomRow": "Sign off from a computer",
      "leftCol": "To saturate with liquid",
      "rightCol": "Radioactive dust"
    },
    "solution": {
      "slot0Top": "FALL",
      "slot0Bottom": "WATER",
      "slot1Top": "OUT",
      "slot1Bottom": "LOG"
    }
  },
  {
    "id": 4,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "GUARD",
        "bottom": "HOUSE"
      },
      {
        "id": "t2",
        "top": "MOON",
        "bottom": "LIGHT"
      },
      {
        "id": "t3",
        "top": "LIFE",
        "bottom": "BOAT"
      },
      {
        "id": "t4",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t5",
        "top": "ICE",
        "bottom": "CREAM"
      }
    ],
    "hints": {
      "topRow": "Swimmer who saves you",
      "bottomRow": "Structure on the water",
      "leftCol": "Vessel for emergencies",
      "rightCol": "Building for security"
    },
    "solution": {
      "slot0Top": "LIFE",
      "slot0Bottom": "BOAT",
      "slot1Top": "GUARD",
      "slot1Bottom": "HOUSE"
    }
  },
  {
    "id": 5,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t2",
        "top": "DESK",
        "bottom": "TOP"
      },
      {
        "id": "t3",
        "top": "LINE",
        "bottom": "UP"
      },
      {
        "id": "t4",
        "top": "HEAD",
        "bottom": "LIGHT"
      },
      {
        "id": "t5",
        "top": "EARTH",
        "bottom": "WORM"
      }
    ],
    "hints": {
      "topRow": "Newspaper title",
      "bottomRow": "Illuminate",
      "leftCol": "Car's front lamp",
      "rightCol": "A row of people"
    },
    "solution": {
      "slot0Top": "HEAD",
      "slot0Bottom": "LIGHT",
      "slot1Top": "LINE",
      "slot1Bottom": "UP"
    }
  },
  {
    "id": 6,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t2",
        "top": "BALL",
        "bottom": "ROOM"
      },
      {
        "id": "t3",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t4",
        "top": "HAND",
        "bottom": "BOOK"
      },
      {
        "id": "t5",
        "top": "SNOW",
        "bottom": "MAN"
      }
    ],
    "hints": {
      "topRow": "Winter projectile",
      "bottomRow": "Place to dance",
      "leftCol": "Frosty figure",
      "rightCol": "Male human"
    },
    "solution": {
      "slot0Top": "SNOW",
      "slot0Bottom": "MAN",
      "slot1Top": "BALL",
      "slot1Bottom": "ROOM"
    }
  },
  {
    "id": 7,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WOOD",
        "bottom": "WORK"
      },
      {
        "id": "t2",
        "top": "LOCK",
        "bottom": "SMITH"
      },
      {
        "id": "t3",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t4",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t5",
        "top": "FIRE",
        "bottom": "FLY"
      }
    ],
    "hints": {
      "topRow": "Lumber",
      "bottomRow": "Effort",
      "leftCol": "Glowing insect",
      "rightCol": "Carpentry"
    },
    "solution": {
      "slot0Top": "FIRE",
      "slot0Bottom": "FLY",
      "slot1Top": "WOOD",
      "slot1Bottom": "WORK"
    }
  },
  {
    "id": 8,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "SUN",
        "bottom": "FLOWER"
      },
      {
        "id": "t2",
        "top": "EARTH",
        "bottom": "WORM"
      },
      {
        "id": "t3",
        "top": "GLASSES",
        "bottom": "CASE"
      },
      {
        "id": "t4",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t5",
        "top": "SKY",
        "bottom": "LARK"
      }
    ],
    "hints": {
      "topRow": "Eye protection",
      "bottomRow": "Container",
      "leftCol": "Yellow plant",
      "rightCol": "Lawsuit"
    },
    "solution": {
      "slot0Top": "SUN",
      "slot0Bottom": "FLOWER",
      "slot1Top": "GLASSES",
      "slot1Bottom": "CASE"
    }
  },
  {
    "id": 9,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t2",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t3",
        "top": "LOCK",
        "bottom": "SMITH"
      },
      {
        "id": "t4",
        "top": "BOOK",
        "bottom": "LOCK"
      },
      {
        "id": "t5",
        "top": "NOTE",
        "bottom": "PAD"
      }
    ],
    "hints": {
      "topRow": "Writing paper",
      "bottomRow": "Secure closing",
      "leftCol": "Bound pages",
      "rightCol": "Arrest"
    },
    "solution": {
      "slot0Top": "PAD",
      "slot0Bottom": "NOTE",
      "slot1Top": "LOCK",
      "slot1Bottom": "BOOK"
    }
  },
  {
    "id": 10,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t2",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t3",
        "top": "PASS",
        "bottom": "PORT"
      },
      {
        "id": "t4",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t5",
        "top": "WORD",
        "bottom": "HOLE"
      }
    ],
    "hints": {
      "topRow": "Travel document",
      "bottomRow": "Opening in a ship",
      "leftCol": "Secret phrase",
      "rightCol": "Verbal unit"
    },
    "solution": {
      "slot0Top": "PORT",
      "slot0Bottom": "PASS",
      "slot1Top": "HOLE",
      "slot1Bottom": "WORD"
    }
  },
  {
    "id": 11,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t2",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t3",
        "top": "DESK",
        "bottom": "TOP"
      },
      {
        "id": "t4",
        "top": "PRINT",
        "bottom": "OUT"
      },
      {
        "id": "t5",
        "top": "FOOT",
        "bottom": "BALL"
      }
    ],
    "hints": {
      "topRow": "Shoe mark",
      "bottomRow": "Produce paper copy",
      "leftCol": "Soccer",
      "rightCol": "Emerge"
    },
    "solution": {
      "slot0Top": "FOOT",
      "slot0Bottom": "BALL",
      "slot1Top": "PRINT",
      "slot1Bottom": "OUT"
    }
  },
  {
    "id": 12,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "HAND",
        "bottom": "BOOK"
      },
      {
        "id": "t2",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t3",
        "top": "CROSS",
        "bottom": "ROAD"
      },
      {
        "id": "t4",
        "top": "EAR",
        "bottom": "RING"
      },
      {
        "id": "t5",
        "top": "BOW",
        "bottom": "WAY"
      }
    ],
    "hints": {
      "topRow": "Intersection",
      "bottomRow": "Path",
      "leftCol": "Medieval weapon",
      "rightCol": "Method"
    },
    "solution": {
      "slot0Top": "ROAD",
      "slot0Bottom": "CROSS",
      "slot1Top": "WAY",
      "slot1Bottom": "BOW"
    }
  },
  {
    "id": 13,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t2",
        "top": "KEY",
        "bottom": "BOARD"
      },
      {
        "id": "t3",
        "top": "HOLE",
        "bottom": "PUNCH"
      },
      {
        "id": "t4",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t5",
        "top": "FOOT",
        "bottom": "NOTE"
      }
    ],
    "hints": {
      "topRow": "Opening for a lock",
      "bottomRow": "Hit with a fist",
      "leftCol": "Computer input",
      "rightCol": "Drink"
    },
    "solution": {
      "slot0Top": "KEY",
      "slot0Bottom": "BOARD",
      "slot1Top": "HOLE",
      "slot1Bottom": "PUNCH"
    }
  },
  {
    "id": 14,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WORM",
        "bottom": "HOLE"
      },
      {
        "id": "t2",
        "top": "AIR",
        "bottom": "PLANE"
      },
      {
        "id": "t3",
        "top": "CAT",
        "bottom": "WALK"
      },
      {
        "id": "t4",
        "top": "EAR",
        "bottom": "RING"
      },
      {
        "id": "t5",
        "top": "EARTH",
        "bottom": "QUAKE"
      }
    ],
    "hints": {
      "topRow": "Ground crawler",
      "bottomRow": "Opening",
      "leftCol": "Seismic event",
      "rightCol": "Tremble"
    },
    "solution": {
      "slot0Top": "EARTH",
      "slot0Bottom": "QUAKE",
      "slot1Top": "WORM",
      "slot1Bottom": "HOLE"
    }
  },
  {
    "id": 15,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t2",
        "top": "PIPE",
        "bottom": "LINE"
      },
      {
        "id": "t3",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t4",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t5",
        "top": "RAIN",
        "bottom": "COAT"
      }
    ],
    "hints": {
      "topRow": "Air tube",
      "bottomRow": "Sequence",
      "leftCol": "Rotary machine",
      "rightCol": "Grinder"
    },
    "solution": {
      "slot0Top": "WIND",
      "slot0Bottom": "MILL",
      "slot1Top": "PIPE",
      "slot1Bottom": "LINE"
    }
  },
  {
    "id": 16,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "EARTH",
        "bottom": "WORM"
      },
      {
        "id": "t2",
        "top": "RUSH",
        "bottom": "HOUR"
      },
      {
        "id": "t3",
        "top": "GOLD",
        "bottom": "MINE"
      },
      {
        "id": "t4",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t5",
        "top": "ICE",
        "bottom": "CREAM"
      }
    ],
    "hints": {
      "topRow": "Hurry",
      "bottomRow": "60 minutes",
      "leftCol": "Precious metal excavation",
      "rightCol": "My own"
    },
    "solution": {
      "slot0Top": "GOLD",
      "slot0Bottom": "MINE",
      "slot1Top": "RUSH",
      "slot1Bottom": "HOUR"
    }
  },
  {
    "id": 17,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t2",
        "top": "BATH",
        "bottom": "ROOM"
      },
      {
        "id": "t3",
        "top": "HAND",
        "bottom": "BOOK"
      },
      {
        "id": "t4",
        "top": "TUB",
        "bottom": "BEATER"
      },
      {
        "id": "t5",
        "top": "PAPER",
        "bottom": "CLIP"
      }
    ],
    "hints": {
      "topRow": "Washing basin",
      "bottomRow": "Mixing tool",
      "leftCol": "Place for toilet",
      "rightCol": "Space"
    },
    "solution": {
      "slot0Top": "BATH",
      "slot0Bottom": "ROOM",
      "slot1Top": "TUB",
      "slot1Bottom": "BEATER"
    }
  },
  {
    "id": 18,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t2",
        "top": "CAT",
        "bottom": "WALK"
      },
      {
        "id": "t3",
        "top": "WHEEL",
        "bottom": "CHAIR"
      },
      {
        "id": "t4",
        "top": "PEN",
        "bottom": "CIL"
      },
      {
        "id": "t5",
        "top": "BARROW",
        "bottom": "BOY"
      }
    ],
    "hints": {
      "topRow": "Pushcart",
      "bottomRow": "Male child",
      "leftCol": "Seat with wheels",
      "rightCol": "Furniture"
    },
    "solution": {
      "slot0Top": "WHEEL",
      "slot0Bottom": "CHAIR",
      "slot1Top": "BARROW",
      "slot1Bottom": "BOY"
    }
  },
  {
    "id": 19,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "MARROW",
        "bottom": "FAT"
      },
      {
        "id": "t2",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t3",
        "top": "BONE",
        "bottom": "YARD"
      },
      {
        "id": "t4",
        "top": "EARTH",
        "bottom": "WORM"
      },
      {
        "id": "t5",
        "top": "EAR",
        "bottom": "RING"
      }
    ],
    "hints": {
      "topRow": "Core of a bone",
      "bottomRow": "Grease",
      "leftCol": "Cemetery",
      "rightCol": "Lawn"
    },
    "solution": {
      "slot0Top": "BONE",
      "slot0Bottom": "YARD",
      "slot1Top": "MARROW",
      "slot1Bottom": "FAT"
    }
  },
  {
    "id": 20,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "BOWL",
        "bottom": "UP"
      },
      {
        "id": "t2",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t3",
        "top": "FISH",
        "bottom": "BOWL"
      },
      {
        "id": "t4",
        "top": "FISH",
        "bottom": "HOOK"
      },
      {
        "id": "t5",
        "top": "RAIN",
        "bottom": "COAT"
      }
    ],
    "hints": {
      "topRow": "Curved metal",
      "bottomRow": "Above",
      "leftCol": "Aquarium",
      "rightCol": "Container"
    },
    "solution": {
      "slot0Top": "HOOK",
      "slot0Bottom": "FISH",
      "slot1Top": "UP",
      "slot1Bottom": "BOWL"
    }
  },
  {
    "id": 21,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "HOUSE",
        "bottom": "DOG"
      },
      {
        "id": "t2",
        "top": "MOON",
        "bottom": "LIGHT"
      },
      {
        "id": "t3",
        "top": "TREE",
        "bottom": "TOP"
      },
      {
        "id": "t4",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t5",
        "top": "EAR",
        "bottom": "RING"
      }
    ],
    "hints": {
      "topRow": "Highest point",
      "bottomRow": "Canine",
      "leftCol": "Arboreal dwelling",
      "rightCol": "Building"
    },
    "solution": {
      "slot0Top": "TOP",
      "slot0Bottom": "TREE",
      "slot1Top": "DOG",
      "slot1Bottom": "HOUSE"
    }
  },
  {
    "id": 22,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "SEED",
        "bottom": "MONEY"
      },
      {
        "id": "t2",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t3",
        "top": "BIRD",
        "bottom": "CAGE"
      },
      {
        "id": "t4",
        "top": "LOCK",
        "bottom": "SMITH"
      },
      {
        "id": "t5",
        "top": "HAND",
        "bottom": "BOOK"
      }
    ],
    "hints": {
      "topRow": "Avian food",
      "bottomRow": "Currency",
      "leftCol": "Enclosure for pets",
      "rightCol": "Prison"
    },
    "solution": {
      "slot0Top": "BIRD",
      "slot0Bottom": "CAGE",
      "slot1Top": "SEED",
      "slot1Bottom": "MONEY"
    }
  },
  {
    "id": 23,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t2",
        "top": "DESK",
        "bottom": "TOP"
      },
      {
        "id": "t3",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t4",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t5",
        "top": "LIGHT",
        "bottom": "NET"
      }
    ],
    "hints": {
      "topRow": "Aquatic animal",
      "bottomRow": "Catching mesh",
      "leftCol": "Stellar glow",
      "rightCol": "Illumination"
    },
    "solution": {
      "slot0Top": "FISH",
      "slot0Bottom": "STAR",
      "slot1Top": "NET",
      "slot1Bottom": "LIGHT"
    }
  },
  {
    "id": 24,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "LIGHT",
        "bottom": "HOUSE"
      },
      {
        "id": "t2",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t3",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t4",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t5",
        "top": "MOON",
        "bottom": "BEAM"
      }
    ],
    "hints": {
      "topRow": "Illumination",
      "bottomRow": "Building",
      "leftCol": "Lunar ray",
      "rightCol": "Smile"
    },
    "solution": {
      "slot0Top": "MOON",
      "slot0Bottom": "BEAM",
      "slot1Top": "LIGHT",
      "slot1Bottom": "HOUSE"
    }
  },
  {
    "id": 25,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "EAR",
        "bottom": "RING"
      },
      {
        "id": "t2",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t3",
        "top": "SEA",
        "bottom": "WEED"
      },
      {
        "id": "t4",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t5",
        "top": "SHELL",
        "bottom": "KILLER"
      }
    ],
    "hints": {
      "topRow": "Unwanted plant",
      "bottomRow": "Murderer",
      "leftCol": "Ocean casing",
      "rightCol": "Explosive"
    },
    "solution": {
      "slot0Top": "WEED",
      "slot0Bottom": "SEA",
      "slot1Top": "KILLER",
      "slot1Bottom": "SHELL"
    }
  },
  {
    "id": 26,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "CAR",
        "bottom": "WASH"
      },
      {
        "id": "t2",
        "top": "FISH",
        "bottom": "BOWL"
      },
      {
        "id": "t3",
        "top": "PET",
        "bottom": "DOG"
      },
      {
        "id": "t4",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t5",
        "top": "EARTH",
        "bottom": "WORM"
      }
    ],
    "hints": {
      "topRow": "Animal companion",
      "bottomRow": "Canine",
      "leftCol": "Vehicle cleaning",
      "rightCol": "Laundry"
    },
    "solution": {
      "slot0Top": "CAR",
      "slot0Bottom": "WASH",
      "slot1Top": "PET",
      "slot1Bottom": "DOG"
    }
  },
  {
    "id": 27,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "TIME",
        "bottom": "OUT"
      },
      {
        "id": "t2",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t3",
        "top": "DAY",
        "bottom": "LIGHT"
      },
      {
        "id": "t4",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t5",
        "top": "EARTH",
        "bottom": "WORM"
      }
    ],
    "hints": {
      "topRow": "Chronological measure",
      "bottomRow": "Outside",
      "leftCol": "Sun illumination",
      "rightCol": "Weight"
    },
    "solution": {
      "slot0Top": "DAY",
      "slot0Bottom": "LIGHT",
      "slot1Top": "TIME",
      "slot1Bottom": "OUT"
    }
  },
  {
    "id": 28,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "NIGHT",
        "bottom": "CLUB"
      },
      {
        "id": "t2",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t3",
        "top": "AIR",
        "bottom": "PLANE"
      },
      {
        "id": "t4",
        "top": "FALL",
        "bottom": "HOUSE"
      },
      {
        "id": "t5",
        "top": "HAND",
        "bottom": "BOOK"
      }
    ],
    "hints": {
      "topRow": "Gathering place",
      "bottomRow": "Building",
      "leftCol": "Evening descent",
      "rightCol": "Drop"
    },
    "solution": {
      "slot0Top": "CLUB",
      "slot0Bottom": "NIGHT",
      "slot1Top": "HOUSE",
      "slot1Bottom": "FALL"
    }
  },
  {
    "id": 29,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "BIRD",
        "bottom": "WALK"
      },
      {
        "id": "t2",
        "top": "HAND",
        "bottom": "BOOK"
      },
      {
        "id": "t3",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t4",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t5",
        "top": "BLACK",
        "bottom": "BOARD"
      }
    ],
    "hints": {
      "topRow": "Wooden plank",
      "bottomRow": "Stroll",
      "leftCol": "Dark avian",
      "rightCol": "Feathered creature"
    },
    "solution": {
      "slot0Top": "BOARD",
      "slot0Bottom": "BLACK",
      "slot1Top": "WALK",
      "slot1Bottom": "BIRD"
    }
  },
  {
    "id": 30,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t2",
        "top": "WASH",
        "bottom": "OUT"
      },
      {
        "id": "t3",
        "top": "WHITE",
        "bottom": "HOUSE"
      },
      {
        "id": "t4",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t5",
        "top": "MOON",
        "bottom": "LIGHT"
      }
    ],
    "hints": {
      "topRow": "Clean with water",
      "bottomRow": "Outside",
      "leftCol": "Presidential home",
      "rightCol": "Building"
    },
    "solution": {
      "slot0Top": "WHITE",
      "slot0Bottom": "HOUSE",
      "slot1Top": "WASH",
      "slot1Bottom": "OUT"
    }
  },
  {
    "id": 31,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "BLUE",
        "bottom": "BIRD"
      },
      {
        "id": "t2",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t3",
        "top": "BELL",
        "bottom": "HOP"
      },
      {
        "id": "t4",
        "top": "MOON",
        "bottom": "LIGHT"
      },
      {
        "id": "t5",
        "top": "CODE",
        "bottom": "NAME"
      }
    ],
    "hints": {
      "topRow": "Chime",
      "bottomRow": "Jump",
      "leftCol": "Azure avian",
      "rightCol": "Animal"
    },
    "solution": {
      "slot0Top": "BLUE",
      "slot0Bottom": "BIRD",
      "slot1Top": "BELL",
      "slot1Bottom": "HOP"
    }
  },
  {
    "id": 32,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "AIR",
        "bottom": "PLANE"
      },
      {
        "id": "t2",
        "top": "EAR",
        "bottom": "RING"
      },
      {
        "id": "t3",
        "top": "RED",
        "bottom": "WOOD"
      },
      {
        "id": "t4",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t5",
        "top": "COAT",
        "bottom": "RACK"
      }
    ],
    "hints": {
      "topRow": "Outerwear",
      "bottomRow": "Shelf",
      "leftCol": "Tall tree",
      "rightCol": "Lumber"
    },
    "solution": {
      "slot0Top": "RED",
      "slot0Bottom": "WOOD",
      "slot1Top": "COAT",
      "slot1Bottom": "RACK"
    }
  },
  {
    "id": 33,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t2",
        "top": "HORN",
        "bottom": "PIPE"
      },
      {
        "id": "t3",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t4",
        "top": "DESK",
        "bottom": "TOP"
      },
      {
        "id": "t5",
        "top": "GREEN",
        "bottom": "HOUSE"
      }
    ],
    "hints": {
      "topRow": "Musical instrument",
      "bottomRow": "Tube",
      "leftCol": "Glass building",
      "rightCol": "Home"
    },
    "solution": {
      "slot0Top": "GREEN",
      "slot0Bottom": "HOUSE",
      "slot1Top": "HORN",
      "slot1Bottom": "PIPE"
    }
  },
  {
    "id": 34,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "JACK",
        "bottom": "POT"
      },
      {
        "id": "t2",
        "top": "CAT",
        "bottom": "WALK"
      },
      {
        "id": "t3",
        "top": "MOON",
        "bottom": "LIGHT"
      },
      {
        "id": "t4",
        "top": "YELLOW",
        "bottom": "TAIL"
      },
      {
        "id": "t5",
        "top": "WIND",
        "bottom": "MILL"
      }
    ],
    "hints": {
      "topRow": "Male name",
      "bottomRow": "Vessel",
      "leftCol": "Fish species",
      "rightCol": "Appendage"
    },
    "solution": {
      "slot0Top": "YELLOW",
      "slot0Bottom": "TAIL",
      "slot1Top": "JACK",
      "slot1Bottom": "POT"
    }
  },
  {
    "id": 35,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t2",
        "top": "BROWN",
        "bottom": "BEAR"
      },
      {
        "id": "t3",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t4",
        "top": "OUT",
        "bottom": "FIT"
      },
      {
        "id": "t5",
        "top": "EARTH",
        "bottom": "WORM"
      }
    ],
    "hints": {
      "topRow": "Outside",
      "bottomRow": "Healthy",
      "leftCol": "Grizzly",
      "rightCol": "Animal"
    },
    "solution": {
      "slot0Top": "BROWN",
      "slot0Bottom": "BEAR",
      "slot1Top": "OUT",
      "slot1Bottom": "FIT"
    }
  },
  {
    "id": 36,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "FISH",
        "bottom": "BOWL"
      },
      {
        "id": "t2",
        "top": "PEA",
        "bottom": "SOUP"
      },
      {
        "id": "t3",
        "top": "SWEET",
        "bottom": "HEART"
      },
      {
        "id": "t4",
        "top": "CAT",
        "bottom": "WALK"
      },
      {
        "id": "t5",
        "top": "FOOT",
        "bottom": "NOTE"
      }
    ],
    "hints": {
      "topRow": "Green vegetable",
      "bottomRow": "Broth",
      "leftCol": "Darling",
      "rightCol": "Organ"
    },
    "solution": {
      "slot0Top": "SWEET",
      "slot0Bottom": "HEART",
      "slot1Top": "PEA",
      "slot1Bottom": "SOUP"
    }
  },
  {
    "id": 37,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "DOUGH",
        "bottom": "CAT"
      },
      {
        "id": "t2",
        "top": "PEN",
        "bottom": "CIL"
      },
      {
        "id": "t3",
        "top": "SOUR",
        "bottom": "PUSS"
      },
      {
        "id": "t4",
        "top": "CODE",
        "bottom": "NAME"
      },
      {
        "id": "t5",
        "top": "AIR",
        "bottom": "PLANE"
      }
    ],
    "hints": {
      "topRow": "Feline",
      "bottomRow": "Pet",
      "leftCol": "Fermented bread",
      "rightCol": "Money"
    },
    "solution": {
      "slot0Top": "PUSS",
      "slot0Bottom": "SOUR",
      "slot1Top": "CAT",
      "slot1Bottom": "DOUGH"
    }
  },
  {
    "id": 38,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "HOT",
        "bottom": "DOG"
      },
      {
        "id": "t2",
        "top": "EARTH",
        "bottom": "WORM"
      },
      {
        "id": "t3",
        "top": "FISH",
        "bottom": "BOWL"
      },
      {
        "id": "t4",
        "top": "POTATO",
        "bottom": "CHIP"
      },
      {
        "id": "t5",
        "top": "RAIN",
        "bottom": "COAT"
      }
    ],
    "hints": {
      "topRow": "Spud",
      "bottomRow": "Snack",
      "leftCol": "Frankfurter",
      "rightCol": "Canine"
    },
    "solution": {
      "slot0Top": "HOT",
      "slot0Bottom": "DOG",
      "slot1Top": "POTATO",
      "slot1Bottom": "CHIP"
    }
  },
  {
    "id": 39,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "RAIN",
        "bottom": "COAT"
      },
      {
        "id": "t2",
        "top": "WATER",
        "bottom": "HOUND"
      },
      {
        "id": "t3",
        "top": "COLD",
        "bottom": "BLOOD"
      },
      {
        "id": "t4",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t5",
        "top": "LOCK",
        "bottom": "SMITH"
      }
    ],
    "hints": {
      "topRow": "Vital fluid",
      "bottomRow": "Dog",
      "leftCol": "Chilly liquid",
      "rightCol": "Drink"
    },
    "solution": {
      "slot0Top": "BLOOD",
      "slot0Bottom": "COLD",
      "slot1Top": "HOUND",
      "slot1Bottom": "WATER"
    }
  },
  {
    "id": 40,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "HEART",
        "bottom": "BEAT"
      },
      {
        "id": "t2",
        "top": "WARM",
        "bottom": "UP"
      },
      {
        "id": "t3",
        "top": "CAT",
        "bottom": "WALK"
      },
      {
        "id": "t4",
        "top": "PEN",
        "bottom": "CIL"
      },
      {
        "id": "t5",
        "top": "ICE",
        "bottom": "CREAM"
      }
    ],
    "hints": {
      "topRow": "Organ",
      "bottomRow": "Rhythm",
      "leftCol": "Preparation",
      "rightCol": "Above"
    },
    "solution": {
      "slot0Top": "WARM",
      "slot0Bottom": "UP",
      "slot1Top": "HEART",
      "slot1Bottom": "BEAT"
    }
  },
  {
    "id": 41,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "EARTH",
        "bottom": "WORM"
      },
      {
        "id": "t2",
        "top": "AIR",
        "bottom": "PLANE"
      },
      {
        "id": "t3",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t4",
        "top": "WAY",
        "bottom": "WARD"
      },
      {
        "id": "t5",
        "top": "FREE",
        "bottom": "DOM"
      }
    ],
    "hints": {
      "topRow": "Path",
      "bottomRow": "Direction",
      "leftCol": "Liberty",
      "rightCol": "Title"
    },
    "solution": {
      "slot0Top": "FREE",
      "slot0Bottom": "DOM",
      "slot1Top": "WAY",
      "slot1Bottom": "WARD"
    }
  },
  {
    "id": 42,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "DESK",
        "bottom": "TOP"
      },
      {
        "id": "t2",
        "top": "WILD",
        "bottom": "LIFE"
      },
      {
        "id": "t3",
        "top": "CAT",
        "bottom": "NIP"
      },
      {
        "id": "t4",
        "top": "STAR",
        "bottom": "FISH"
      },
      {
        "id": "t5",
        "top": "PAPER",
        "bottom": "CLIP"
      }
    ],
    "hints": {
      "topRow": "Feline",
      "bottomRow": "Bite",
      "leftCol": "Untamed animals",
      "rightCol": "Existence"
    },
    "solution": {
      "slot0Top": "WILD",
      "slot0Bottom": "LIFE",
      "slot1Top": "CAT",
      "slot1Bottom": "NIP"
    }
  },
  {
    "id": 43,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "PAPER",
        "bottom": "CLIP"
      },
      {
        "id": "t2",
        "top": "TY",
        "bottom": "DOG"
      },
      {
        "id": "t3",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t4",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t5",
        "top": "SAFE",
        "bottom": "GUARD"
      }
    ],
    "hints": {
      "topRow": "Protector",
      "bottomRow": "Canine",
      "leftCol": "Security",
      "rightCol": "Letter"
    },
    "solution": {
      "slot0Top": "GUARD",
      "slot0Bottom": "SAFE",
      "slot1Top": "DOG",
      "slot1Bottom": "TY"
    }
  },
  {
    "id": 44,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "WOOD",
        "bottom": "APPLE"
      },
      {
        "id": "t2",
        "top": "HAND",
        "bottom": "BOOK"
      },
      {
        "id": "t3",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t4",
        "top": "HARD",
        "bottom": "CORE"
      },
      {
        "id": "t5",
        "top": "FOOT",
        "bottom": "NOTE"
      }
    ],
    "hints": {
      "topRow": "Center",
      "bottomRow": "Fruit",
      "leftCol": "Solid timber",
      "rightCol": "Lumber"
    },
    "solution": {
      "slot0Top": "CORE",
      "slot0Bottom": "HARD",
      "slot1Top": "APPLE",
      "slot1Bottom": "WOOD"
    }
  },
  {
    "id": 45,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t2",
        "top": "SOFT",
        "bottom": "WARE"
      },
      {
        "id": "t3",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t4",
        "top": "BALL",
        "bottom": "PARK"
      },
      {
        "id": "t5",
        "top": "AIR",
        "bottom": "PLANE"
      }
    ],
    "hints": {
      "topRow": "Sphere",
      "bottomRow": "Recreation area",
      "leftCol": "Computer program",
      "rightCol": "Goods"
    },
    "solution": {
      "slot0Top": "SOFT",
      "slot0Bottom": "WARE",
      "slot1Top": "BALL",
      "slot1Bottom": "PARK"
    }
  },
  {
    "id": 46,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t2",
        "top": "RICH",
        "bottom": "LAND"
      },
      {
        "id": "t3",
        "top": "LOCK",
        "bottom": "SMITH"
      },
      {
        "id": "t4",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t5",
        "top": "MAN",
        "bottom": "LORD"
      }
    ],
    "hints": {
      "topRow": "Earth",
      "bottomRow": "Ruler",
      "leftCol": "Wealthy male",
      "rightCol": "Human"
    },
    "solution": {
      "slot0Top": "LAND",
      "slot0Bottom": "RICH",
      "slot1Top": "LORD",
      "slot1Bottom": "MAN"
    }
  },
  {
    "id": 47,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "DOG",
        "bottom": "SLED"
      },
      {
        "id": "t2",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t3",
        "top": "POOR",
        "bottom": "HOUSE"
      },
      {
        "id": "t4",
        "top": "AIR",
        "bottom": "PLANE"
      },
      {
        "id": "t5",
        "top": "BOY",
        "bottom": "HOOD"
      }
    ],
    "hints": {
      "topRow": "Male child",
      "bottomRow": "Covering",
      "leftCol": "Almshouse",
      "rightCol": "Building"
    },
    "solution": {
      "slot0Top": "POOR",
      "slot0Bottom": "HOUSE",
      "slot1Top": "BOY",
      "slot1Bottom": "HOOD"
    }
  },
  {
    "id": 48,
    "requiresRotation": true,
    "tiles": [
      {
        "id": "t1",
        "top": "FOOT",
        "bottom": "NOTE"
      },
      {
        "id": "t2",
        "top": "NEW",
        "bottom": "AGE"
      },
      {
        "id": "t3",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t4",
        "top": "YEAR",
        "bottom": "OLD"
      },
      {
        "id": "t5",
        "top": "DESK",
        "bottom": "TOP"
      }
    ],
    "hints": {
      "topRow": "Era",
      "bottomRow": "Elderly",
      "leftCol": "Jan 1 celebration",
      "rightCol": "Time"
    },
    "solution": {
      "slot0Top": "AGE",
      "slot0Bottom": "NEW",
      "slot1Top": "OLD",
      "slot1Bottom": "YEAR"
    }
  },
  {
    "id": 49,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "OLD",
        "bottom": "MAN"
      },
      {
        "id": "t2",
        "top": "WIND",
        "bottom": "MILL"
      },
      {
        "id": "t3",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t4",
        "top": "EAR",
        "bottom": "RING"
      },
      {
        "id": "t5",
        "top": "AGE",
        "bottom": "LESS"
      }
    ],
    "hints": {
      "topRow": "Era",
      "bottomRow": "Minus",
      "leftCol": "Elderly male",
      "rightCol": "Human"
    },
    "solution": {
      "slot0Top": "OLD",
      "slot0Bottom": "MAN",
      "slot1Top": "AGE",
      "slot1Bottom": "LESS"
    }
  },
  {
    "id": 50,
    "requiresRotation": false,
    "tiles": [
      {
        "id": "t1",
        "top": "HIGH",
        "bottom": "WAY"
      },
      {
        "id": "t2",
        "top": "SKY",
        "bottom": "LARK"
      },
      {
        "id": "t3",
        "top": "ICE",
        "bottom": "CREAM"
      },
      {
        "id": "t4",
        "top": "BIRD",
        "bottom": "SEED"
      },
      {
        "id": "t5",
        "top": "LIGHT",
        "bottom": "HOUSE"
      }
    ],
    "hints": {
      "topRow": "Illumination",
      "bottomRow": "Building",
      "leftCol": "Major road",
      "rightCol": "Path"
    },
    "solution": {
      "slot0Top": "HIGH",
      "slot0Bottom": "WAY",
      "slot1Top": "LIGHT",
      "slot1Bottom": "HOUSE"
    }
  }
];


const playPopSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {
    console.error("Audio play failed", e);
  }
};

const DominoTile = ({
  tile,
  onClick,
  onFlip,
  isSlot,
  draggable,
  onDragEnd,
  boardRotation = 0,
}: {
  tile: TileData;
  onClick: () => void;
  onFlip: (e: React.MouseEvent) => void;
  isSlot: boolean;
  draggable?: boolean;
  onDragEnd?: (e: any, info: PanInfo) => void;
  boardRotation?: number;
}) => {
  return (
    <motion.div
      layoutId={tile.id}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95, zIndex: 50 }}
      whileDrag={{ scale: 1.05, zIndex: 100 }}
      onClick={onClick}
      drag={draggable}
      dragSnapToOrigin={draggable}
      onDragEnd={onDragEnd}
      animate={{ rotateX: tile.isFlipped ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{ transformStyle: "preserve-3d" }}
      className={cn(
        "relative flex flex-col w-20 h-40 md:w-24 md:h-48 rounded-xl shadow-sm cursor-pointer overflow-hidden group select-none flex-shrink-0 touch-none",
        isSlot ? "bg-white border-2 border-[#ccff00] text-black shadow-md" : "bg-white border-2 border-zinc-200 text-black shadow-sm"
      )}
    >
      <motion.div
        animate={{ rotateX: tile.isFlipped ? 180 : 0, rotateZ: -boardRotation }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex-1 flex items-center justify-center p-2 text-center text-[0.95rem] md:text-lg font-extrabold tracking-wide"
      >
        {tile.top}
      </motion.div>
      
      <div className={cn("h-0.5 w-full", isSlot ? "bg-[#f4ffcc]" : "bg-zinc-100")} />
      
      <motion.div
        animate={{ rotateX: tile.isFlipped ? 180 : 0, rotateZ: -boardRotation }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex-1 flex items-center justify-center p-2 text-center text-[0.95rem] md:text-lg font-extrabold tracking-wide"
      >
        {tile.bottom}
      </motion.div>

      {/* Flip Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFlip(e);
        }}
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md transition-opacity duration-200 z-10",
          "opacity-0 group-hover:opacity-100 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
          isSlot ? "bg-[#ccff00] text-black hover:bg-[#b3e600]" : "bg-white text-black hover:bg-zinc-50 border border-zinc-200"
        )}
      >
        <span className="material-icons text-[18px]">sync</span>
      </button>
    </motion.div>
  );
};

export default function FlipWords() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [gameLevels, setGameLevels] = useState<Level[]>([]);
  const [levelIdx, setLevelIdx] = useState(0);
  const [bank, setBank] = useState<TileData[]>([]);
  const [slots, setSlots] = useState<SlotsState>([null, null]);
  const [boardRotation, setBoardRotation] = useState(0);
  const [turns, setTurns] = useState(0);
  const [hintMessage, setHintMessage] = useState("");

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("flipwords_tutorial_seen");
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialComplete = () => {
    localStorage.setItem("flipwords_tutorial_seen", "true");
    setShowTutorial(false);
  };

  useEffect(() => {
    const shuffled = [...allLevels].sort(() => 0.5 - Math.random());
    setGameLevels(shuffled.slice(0, 5));
  }, []);
  const [isSolved, setIsSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const trayRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<SlotsState>([null, null]);
  const bankRef = useRef<TileData[]>([]);
  const boardRotationRef = useRef(0);

  const level = gameLevels[levelIdx];

  const commitState = (
    nextSlots: SlotsState,
    nextBank: TileData[],
    nextBoardRotation: number,
    increaseTurns = false
  ) => {
    if (!level) return;
    const normalized = sanitizeState(level, nextSlots, nextBank);
    const normalizedRotation = normalizeRotation(nextBoardRotation);
    slotsRef.current = normalized.slots;
    bankRef.current = normalized.bank;
    boardRotationRef.current = normalizedRotation;
    setSlots(normalized.slots);
    setBank(normalized.bank);
    setBoardRotation(normalizedRotation);
    if (increaseTurns) {
      setTurns((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!level) return;
    const initialBank = level.tiles.map((t) => ({
      ...t,
      isFlipped: Math.random() > 0.5,
    }));
    const normalized = sanitizeState(level, [null, null], initialBank);
    slotsRef.current = normalized.slots;
    bankRef.current = normalized.bank;
    boardRotationRef.current = 0;
    setBank(normalized.bank);
    setSlots(normalized.slots);
    setIsSolved(false);
    setShowCelebration(false);
    setActiveSlot(null);
    setBoardRotation(0);
    setTurns(0);
    setHintMessage("");
  }, [levelIdx, level]);

  useEffect(() => {
    if (!level) return;
    if (slots[0] && slots[1]) {
      const s0 = getTileFaceInSlot(slots[0]);
      const s1 = getTileFaceInSlot(slots[1]);
      const targetRotation = getTargetRotation(level);

      if (normalizeRotation(boardRotation) === targetRotation) {
        if (
          s0.top === level.solution.slot0Top &&
          s0.bottom === level.solution.slot0Bottom &&
          s1.top === level.solution.slot1Top &&
          s1.bottom === level.solution.slot1Bottom
        ) {
          setIsSolved(true);
          setShowCelebration(true);
          setActiveSlot(null);
        } else {
          setIsSolved(false);
        }
      } else {
        setIsSolved(false);
      }
    } else {
      setIsSolved(false);
    }
  }, [slots, level, boardRotation]);

  if (!level) return null;

  const handleDragEnd = (_e: any, info: PanInfo, tile: TileData) => {
    if (isSolved) return;
    const { point } = info;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];

    for (let i = 0; i < 2; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      ) {
        const nextSlots = [...currentSlots] as SlotsState;
        const targetIdx = i as 0 | 1;
        const existingTile = nextSlots[targetIdx];
        nextSlots[targetIdx] = tile;
        let nextBank = currentBank.filter((entry) => entry.id !== tile.id);
        if (existingTile && existingTile.id !== tile.id) {
          nextBank = [...nextBank, existingTile];
        }
        commitState(nextSlots, nextBank, boardRotationRef.current, true);
        setActiveSlot(null);
        setHintMessage("");
        playPopSound();
        return;
      }
    }
  };

  const handleSlotDragEnd = (_e: any, info: PanInfo, tile: TileData, slotIdx: number) => {
    if (isSolved) return;
    const { point } = info;
    const sourceIdx = slotIdx as 0 | 1;
    const otherSlotIdx = (slotIdx === 0 ? 1 : 0) as 0 | 1;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];

    const otherEl = slotRefs.current[otherSlotIdx];
    if (otherEl) {
      const rect = otherEl.getBoundingClientRect();
      const droppedInOtherSlot =
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom;

      if (droppedInOtherSlot) {
        const nextSlots = [...currentSlots] as SlotsState;
        const otherTile = nextSlots[otherSlotIdx];
        nextSlots[sourceIdx] = otherTile;
        nextSlots[otherSlotIdx] = tile;
        commitState(nextSlots, currentBank, boardRotationRef.current, true);
        setActiveSlot(null);
        setHintMessage("");
        playPopSound();
        return;
      }
    }

    const sourceEl = slotRefs.current[sourceIdx];
    if (!sourceEl) return;
    const sourceRect = sourceEl.getBoundingClientRect();
    const droppedInSameSlot =
      point.x >= sourceRect.left &&
      point.x <= sourceRect.right &&
      point.y >= sourceRect.top &&
      point.y <= sourceRect.bottom;

    if (!droppedInSameSlot) {
      const nextSlots = [...currentSlots] as SlotsState;
      nextSlots[sourceIdx] = null;
      commitState(nextSlots, [...currentBank, tile], boardRotationRef.current, true);
      setActiveSlot(null);
      setHintMessage("");
      playPopSound();
    }
  };

  const handleHint = () => {
    if (isSolved) return;
    const nextHint = getNextHintAction(
      level,
      slotsRef.current,
      bankRef.current,
      boardRotationRef.current
    );
    setHintMessage(nextHint.text);

    if (!nextHint.action) {
      return;
    }

    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];

    if (nextHint.action === "removeTile") {
      for (const slotIdx of [0, 1] as const) {
        const target = findSolutionTileForSlot(level, slotIdx);
        if (!target) continue;
        const current = currentSlots[slotIdx];
        if (current && current.id !== target.tile.id) {
          const nextSlots = [...currentSlots] as SlotsState;
          nextSlots[slotIdx] = null;
          commitState(nextSlots, [...currentBank, current], boardRotationRef.current);
          setActiveSlot(null);
          playPopSound();
          return;
        }
      }
      return;
    }

    if (nextHint.action === "addTile") {
      for (const slotIdx of [0, 1] as const) {
        const target = findSolutionTileForSlot(level, slotIdx);
        if (!target || currentSlots[slotIdx]) continue;

        const nextSlots = [...currentSlots] as SlotsState;
        const nextBank = currentBank.filter((entry) => entry.id !== target.tile.id);
        const otherSlotIdx = (slotIdx === 0 ? 1 : 0) as 0 | 1;
        if (nextSlots[otherSlotIdx]?.id === target.tile.id) {
          nextSlots[otherSlotIdx] = null;
        }

        nextSlots[slotIdx] = { ...target.tile, isFlipped: target.shouldFlip };
        commitState(nextSlots, nextBank, boardRotationRef.current);
        setActiveSlot(null);
        playPopSound();
        return;
      }
      return;
    }

    if (nextHint.action === "rotateTile") {
      for (const slotIdx of [0, 1] as const) {
        const target = findSolutionTileForSlot(level, slotIdx);
        const current = currentSlots[slotIdx];
        if (!target || !current || current.id !== target.tile.id) continue;
        if (current.isFlipped === target.shouldFlip) continue;

        const nextSlots = [...currentSlots] as SlotsState;
        nextSlots[slotIdx] = { ...current, isFlipped: !current.isFlipped };
        commitState(nextSlots, currentBank, boardRotationRef.current);
        setActiveSlot(null);
        playPopSound();
        return;
      }
      return;
    }

    if (nextHint.action === "rotateBoard") {
      commitState(currentSlots, currentBank, boardRotationRef.current + 90);
      setActiveSlot(null);
      playPopSound();
    }
  };

  const handleBankTileClick = (tile: TileData) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];
    let targetIdx = activeSlot;
    if (targetIdx === null || currentSlots[targetIdx] !== null) {
      targetIdx = currentSlots.indexOf(null);
    }
    if (targetIdx !== -1) {
      const slotIndex = targetIdx as 0 | 1;
      const nextSlots = [...currentSlots] as SlotsState;
      const existingTile = nextSlots[slotIndex];
      nextSlots[slotIndex] = tile;
      let nextBank = currentBank.filter((entry) => entry.id !== tile.id);
      if (existingTile && existingTile.id !== tile.id) {
        nextBank = [...nextBank, existingTile];
      }
      commitState(nextSlots, nextBank, boardRotationRef.current, true);
      setActiveSlot(null);
      setHintMessage("");
      playPopSound();
    }
  };

  const handleEmptySlotClick = (idx: number) => {
    if (isSolved) return;
    setActiveSlot(idx === activeSlot ? null : idx);
  };

  const handleSlotTileClick = (slotIdx: number, tile: TileData) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];
    const nextSlots = [...currentSlots] as SlotsState;
    nextSlots[slotIdx as 0 | 1] = null;
    commitState(nextSlots, [...currentBank, tile], boardRotationRef.current, true);
    setHintMessage("");
    playPopSound();
    if (activeSlot === null) {
      setActiveSlot(slotIdx);
    }
  };

  const flipTileInBank = (id: string) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const nextBank = bankRef.current.map((tile) =>
      tile.id === id ? { ...tile, isFlipped: !tile.isFlipped } : tile
    );
    commitState(currentSlots, nextBank, boardRotationRef.current, true);
    setHintMessage("");
  };

  const flipTileInSlot = (slotIdx: number) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as SlotsState;
    const currentBank = [...bankRef.current];
    const nextSlots = [...currentSlots] as SlotsState;
    const tile = nextSlots[slotIdx as 0 | 1];
    if (tile) {
      nextSlots[slotIdx as 0 | 1] = { ...tile, isFlipped: !tile.isFlipped };
      commitState(nextSlots, currentBank, boardRotationRef.current, true);
      setHintMessage("");
      playPopSound();
    }
  };

  const nextLevel = () => {
    if (levelIdx < gameLevels.length - 1) {
      setLevelIdx(levelIdx + 1);
    } else {
      const shuffled = [...allLevels].sort(() => 0.5 - Math.random());
      setGameLevels(shuffled.slice(0, 5));
      setLevelIdx(0);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center py-4 md:py-8 bg-white text-black overflow-hidden">
      {showTutorial && <TutorialModal onComplete={handleTutorialComplete} />}
      <header className="mb-8 md:mb-12 flex flex-row items-center justify-between w-full max-w-2xl z-10 px-4 md:px-6 flex-shrink-0 mt-2">
        <h1 className="text-xl md:text-2xl font-black text-black drop-shadow-sm flex items-center gap-2">
          <span className="material-icons text-[#a3cc00] text-[20px] md:text-[24px]">auto_awesome</span>
          FlipWords
        </h1>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex flex-col items-end mr-1 md:mr-2">
            <p className="text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-wider leading-none">
              Level {levelIdx + 1}/{gameLevels.length}
            </p>
            <p className="text-sm md:text-base text-black font-black leading-none mt-1">
              Turns: {turns}
            </p>
          </div>

          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center justify-center text-xs bg-white hover:bg-zinc-50 text-black w-8 h-8 rounded-full font-bold transition-colors shadow-sm active:scale-95 border border-zinc-200"
            title="How to Play"
          >
            <span className="material-icons text-zinc-500 text-[18px]">help_outline</span>
          </button>
          
          <button
            onClick={handleHint}
            className="flex items-center gap-1 text-xs bg-white hover:bg-zinc-50 text-black px-3 py-1.5 rounded-full font-bold transition-colors shadow-sm active:scale-95 border border-zinc-200"
            title="Hint"
          >
            <span className="material-icons text-[#a3cc00] text-[16px]">lightbulb</span>
            <span className="hidden sm:inline">Hint</span>
          </button>
        </div>
      </header>

      {hintMessage ? (
        <div className="w-full max-w-2xl px-4 md:px-6 mb-4 -mt-4 text-xs md:text-sm font-semibold text-zinc-600">
          Hint: {hintMessage}
        </div>
      ) : null}

      {/* Game Board */}
      <div className="w-full px-4 max-w-2xl flex-shrink-0 z-10 mx-auto">
        <div className="relative bg-white p-4 md:p-10 rounded-3xl shadow-sm border border-zinc-200 w-full">
          <button
            onClick={() => {
              commitState(slotsRef.current, bankRef.current, boardRotationRef.current + 90, true);
              setHintMessage("");
            }}
            className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 flex items-center justify-center bg-white border border-zinc-200 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-50 transition-colors shadow-sm z-20"
            title="Rotate Board"
          >
            <span className="material-icons text-xl md:text-2xl">rotate_right</span>
          </button>
          <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-2 md:gap-4 place-items-center">
          
          {/* Top Row Hint */}
          <div className="col-start-2 row-start-1 text-center font-bold text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm shadow-sm">
            {level.hints.topRow}
          </div>

          {/* Left Col Hint */}
          <div className="col-start-1 row-start-2 text-right font-bold text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm shadow-sm transform -rotate-180 [writing-mode:vertical-rl]">
            {level.hints.leftCol}
          </div>

          {/* Slots Container */}
          <motion.div 
            animate={{ rotate: boardRotation }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="col-start-2 row-start-2 flex gap-3 md:gap-4 p-3 md:p-4 bg-white rounded-2xl border border-zinc-200 shadow-inner"
          >
            {[0, 1].map((idx) => {
              const tile = slots[idx as 0 | 1];
              const isActive = activeSlot === idx;
              return (
                <div
                  key={`slot-${idx}`}
                  onClick={() => !tile && handleEmptySlotClick(idx)}
                  ref={(el) => { slotRefs.current[idx] = el; }}
                  className={cn(
                    "w-20 h-40 md:w-24 md:h-48 rounded-xl flex items-center justify-center relative transition-colors cursor-pointer",
                    isActive ? "border-2 border-[#ccff00] bg-[#faffe5]" : (tile ? "border-0" : "border-2 border-zinc-300 border-dashed bg-slate-50")
                  )}
                >
                  {tile ? (
                    <div className="absolute inset-0 z-10">
                      <DominoTile
                        tile={tile}
                        isSlot={true}
                        draggable={true}
                        boardRotation={boardRotation}
                        onDragEnd={(e, info) => handleSlotDragEnd(e, info, tile, idx)}
                        onClick={() => handleSlotTileClick(idx, tile)}
                        onFlip={(e) => {
                          e.stopPropagation();
                          flipTileInSlot(idx);
                        }}
                      />
                    </div>
                  ) : (
                    <motion.span 
                      animate={{ rotate: -boardRotation }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={cn("font-semibold select-none text-sm md:text-base whitespace-nowrap", isActive ? "text-[#a3cc00]" : "text-zinc-400")}
                    >
                      Slot {idx + 1}
                    </motion.span>
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Right Col Hint */}
          <div className="col-start-3 row-start-2 text-left font-bold text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm shadow-sm [writing-mode:vertical-rl]">
            {level.hints.rightCol}
          </div>

          {/* Bottom Row Hint */}
          <div className="col-start-2 row-start-3 text-center font-bold text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm shadow-sm">
            {level.hints.bottomRow}
          </div>
        </div>
        </div>
      </div>

      {/* Success Bottom Sheet */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 w-full bg-white border-t border-zinc-200 z-40 flex flex-col items-center justify-center rounded-t-[2rem] p-8 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]"
          >
            <div className="bg-[#faffe5] text-[#a3cc00] p-3 rounded-full mb-4 shadow-sm flex items-center justify-center">
              <span className="material-icons text-[40px]">check_circle</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-black mb-6">Puzzle Solved!</h2>
            <button
              onClick={nextLevel}
              className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white px-8 py-3 md:px-10 md:py-4 rounded-full font-bold text-base md:text-lg shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              {levelIdx < gameLevels.length - 1 ? "Next Level" : "Play Again"}
              <span className="material-icons text-[20px]">play_arrow</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank Area */}
      <div className="mt-auto w-full flex-shrink-0 relative z-20 bg-white border-t border-zinc-100 py-6 md:py-8">
        <h3 className="text-center font-bold text-zinc-400 mb-4 text-xs md:text-sm uppercase tracking-widest">
          Available Tiles
        </h3>
        <div className="w-full relative flex flex-col items-center justify-center min-h-[14rem] md:min-h-[16rem]">
          <div ref={trayRef} className="w-full flex items-center justify-center overflow-visible z-10">
            <motion.div
              drag="x"
              dragConstraints={trayRef}
              className="flex gap-3 md:gap-5 w-max cursor-grab active:cursor-grabbing"
            >
            <AnimatePresence mode="popLayout">
              {bank.map((tile) => (
                <motion.div
                  key={tile.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex-shrink-0"
                >
                  <DominoTile
                    tile={tile}
                    isSlot={false}
                    draggable={true}
                    onDragEnd={(e, info) => handleDragEnd(e, info, tile)}
                    onClick={() => handleBankTileClick(tile)}
                    onFlip={(e) => {
                      e.stopPropagation();
                      flipTileInBank(tile.id);
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            </motion.div>
          </div>
          
          {/* Scrubber bar visual cue */}
          {bank.length > 0 && (
            <div className="w-full flex items-center justify-center mt-2 pointer-events-none z-0">
              <span className="material-icons rotate-90 text-[#ccff00]/60 text-6xl md:text-7xl select-none leading-none">
                drag_indicator
              </span>
            </div>
          )}

          {bank.length === 0 && !isSolved && (
            <div className="flex items-center justify-center text-zinc-400 font-medium w-full text-sm md:text-base absolute inset-0 pointer-events-none">
              No tiles left in the bank
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
