import type { HintActionKind, Level, Slots, Tile } from "./types";
import {
  findSolutionTileForSlot,
  getBoardFaces,
  getEdges,
  getExpectedEdges,
  isLevelSolved,
  normalizeRotation,
  sanitizeState,
} from "./transforms";

const getTargetRotation = (level: Level) => (level.requiresRotation ? 90 : 0);

/**
 * Decides the single next move that advances the player toward the solution.
 * Priority:
 *   1. Remove wrong tile occupying a slot
 *   2. Add missing solution tile to empty slot
 *   3. Flip a correctly-placed tile that's oriented wrong
 *   4. Rotate the board to its required orientation
 */
export const getNextHintAction = (
  level: Level,
  slotsInput: Slots,
  bankInput: Tile[],
  boardRotation: number
): { action: HintActionKind | null; text: string } => {
  if (isLevelSolved(slotsInput, boardRotation, level)) {
    return { action: null, text: "Already solved." };
  }
  const { slots } = sanitizeState(level, slotsInput, bankInput);

  // 1. Wrong tile in slot?
  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (current && current.id !== target.tile.id) {
      return {
        action: "removeTile",
        text: `That tile in slot ${slotIdx + 1} isn't the one — send it back to the rail.`,
      };
    }
  }

  // 2. Empty slot needs a tile?
  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (!current) {
      return {
        action: "addTile",
        text: `Look for the ${target.tile.top}/${target.tile.bottom} tile — it belongs in slot ${slotIdx + 1}.`,
      };
    }
  }

  // 3. Correct tile but wrong flip?
  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    const current = slots[slotIdx];
    if (!current || current.id !== target.tile.id) continue;
    if (current.isFlipped !== target.shouldFlip) {
      return {
        action: "rotateTile",
        text: `Slot ${slotIdx + 1} is reading the wrong way — flip that tile.`,
      };
    }
  }

  // 4. Board rotation
  const current = normalizeRotation(boardRotation);
  const target = getTargetRotation(level);
  if (current !== target) {
    if (target === 90 && current === 0) {
      return { action: "rotateBoard", text: "The clues only line up if you give the board a quarter-turn." };
    }
    return {
      action: "rotateBoardBack",
      text: "Spin the board back to its starting orientation.",
    };
  }

  // Should not reach here unless edge text comparison failed in a weird way
  const faces = getBoardFaces(slotsInput, boardRotation);
  const edges = getEdges(faces);
  const expected = getExpectedEdges(level);
  const mismatches: string[] = [];
  if (edges.top !== expected.top) mismatches.push("top");
  if (edges.bottom !== expected.bottom) mismatches.push("bottom");
  if (edges.left !== expected.left) mismatches.push("left");
  if (edges.right !== expected.right) mismatches.push("right");

  if (mismatches.length > 0) {
    return {
      action: null,
      text: `Close — but the ${mismatches.join(", ")} edge${mismatches.length > 1 ? "s aren't" : " isn't"} matching yet.`,
    };
  }
  return { action: null, text: "Everything's lined up." };
};

export const getLevelHintPattern = (level: Level): { action: HintActionKind; text: string }[] => {
  const steps: { action: HintActionKind; text: string }[] = [];
  for (const slotIdx of [0, 1] as const) {
    const target = findSolutionTileForSlot(level, slotIdx);
    if (!target) continue;
    steps.push({
      action: "removeTile",
      text: `If slot ${slotIdx + 1} has the wrong tile, return it to the rail.`,
    });
    steps.push({
      action: "addTile",
      text: `Drop the ${target.tile.top}/${target.tile.bottom} tile into slot ${slotIdx + 1}.`,
    });
    steps.push({
      action: "rotateTile",
      text: `If slot ${slotIdx + 1} reads backwards, flip it.`,
    });
  }
  if (level.requiresRotation) {
    steps.push({
      action: "rotateBoard",
      text: "Rotate the board a quarter turn clockwise.",
    });
  } else {
    steps.push({
      action: "rotateBoardBack",
      text: "If the board has been rotated, bring it back upright.",
    });
  }
  return steps;
};
