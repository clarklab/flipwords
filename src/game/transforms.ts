import type { BoardFaces, Edges, Level, Rotation, Slots, Tile } from "./types";

export type SolvedEdges = {
  top: string;
  bottom: string;
  left: string;
  right: string;
};

export const normalizeRotation = (rotation: number): Rotation => {
  const mod = ((rotation % 360) + 360) % 360;
  return mod as Rotation;
};

export const getTileFace = (tile: Tile): { top: string; bottom: string } => {
  if (tile.isFlipped) {
    return { top: tile.bottom, bottom: tile.top };
  }
  return { top: tile.top, bottom: tile.bottom };
};

/**
 * Single source of truth for what's visible at each board position.
 * `slots` is the storage order: slot0 = left column, slot1 = right column.
 * Each slot's tile has top/bottom in storage order; flipping swaps them.
 *
 * Returns the 4 visible word-cells in SCREEN coordinates, accounting for board rotation.
 * No other code in the codebase should perform rotation math — every consumer reads from here.
 */
export const getBoardFaces = (slots: Slots, rotation: number): BoardFaces => {
  const r = normalizeRotation(rotation);
  const s0 = slots[0] ? getTileFace(slots[0]) : null;
  const s1 = slots[1] ? getTileFace(slots[1]) : null;

  // Storage positions (unrotated): TL=s0.top, TR=s1.top, BL=s0.bottom, BR=s1.bottom
  const storage = {
    topLeft: s0?.top ?? null,
    topRight: s1?.top ?? null,
    bottomLeft: s0?.bottom ?? null,
    bottomRight: s1?.bottom ?? null,
  };

  // For rotation r clockwise, screen[TL]=storage[BL], etc.
  switch (r) {
    case 0:
      return storage;
    case 90:
      return {
        topLeft: storage.bottomLeft,
        topRight: storage.topLeft,
        bottomLeft: storage.bottomRight,
        bottomRight: storage.topRight,
      };
    case 180:
      return {
        topLeft: storage.bottomRight,
        topRight: storage.bottomLeft,
        bottomLeft: storage.topRight,
        bottomRight: storage.topLeft,
      };
    case 270:
      return {
        topLeft: storage.topRight,
        topRight: storage.bottomRight,
        bottomLeft: storage.topLeft,
        bottomRight: storage.bottomLeft,
      };
  }
};

/** Read the 4 candidate edge-compounds from the visible board. */
export const getEdges = (faces: BoardFaces): Edges => {
  const concat = (a: string | null, b: string | null) =>
    a && b ? `${a}${b}` : null;
  return {
    top: concat(faces.topLeft, faces.topRight),
    bottom: concat(faces.bottomLeft, faces.bottomRight),
    left: concat(faces.topLeft, faces.bottomLeft),
    right: concat(faces.topRight, faces.bottomRight),
  };
};

/**
 * The 4 target compounds the player must produce on the screen edges.
 * Derived from the level solution + the rotation the level demands.
 *
 * The level's solution slot0/slot1 describe storage positions. The hint texts
 * describe the FINAL on-screen edges (top/bottom/left/right). For non-rotated
 * levels, storage edges == screen edges. For rotated levels (90° CW), we need
 * to compute what the screen edges look like once the solution is in place
 * and the board is rotated, and match those to the corresponding hint strings.
 */
export const getExpectedEdges = (level: Level): SolvedEdges => {
  const s = level.solution;
  // Place solution into storage:
  const storage: BoardFaces = {
    topLeft: s.slot0Top,
    topRight: s.slot1Top,
    bottomLeft: s.slot0Bottom,
    bottomRight: s.slot1Bottom,
  };
  const targetRotation = level.requiresRotation ? 90 : 0;

  let visible: BoardFaces;
  if (targetRotation === 0) {
    visible = storage;
  } else {
    visible = {
      topLeft: storage.bottomLeft,
      topRight: storage.topLeft,
      bottomLeft: storage.bottomRight,
      bottomRight: storage.topRight,
    };
  }

  const edges = getEdges(visible);
  return {
    top: edges.top!,
    bottom: edges.bottom!,
    left: edges.left!,
    right: edges.right!,
  };
};

/**
 * True iff the visible board edges form the 4 expected compounds.
 * Reads through `getBoardFaces` so the win check uses the same coordinate
 * system the player sees.
 */
export const isLevelSolved = (
  slots: Slots,
  rotation: number,
  level: Level
): boolean => {
  const faces = getBoardFaces(slots, rotation);
  if (!faces.topLeft || !faces.topRight || !faces.bottomLeft || !faces.bottomRight) {
    return false;
  }
  const edges = getEdges(faces);
  const expected = getExpectedEdges(level);
  return (
    edges.top === expected.top &&
    edges.bottom === expected.bottom &&
    edges.left === expected.left &&
    edges.right === expected.right
  );
};

/**
 * For a given slot in storage, returns the tile from the level's tile bank
 * that belongs there, and whether it needs to be flipped from its canonical
 * orientation to match the solution.
 */
export const findSolutionTileForSlot = (
  level: Level,
  slotIdx: 0 | 1
): { tile: { id: string; top: string; bottom: string }; shouldFlip: boolean } | null => {
  const expectedTop = slotIdx === 0 ? level.solution.slot0Top : level.solution.slot1Top;
  const expectedBottom = slotIdx === 0 ? level.solution.slot0Bottom : level.solution.slot1Bottom;

  const tile = level.tiles.find(
    (candidate) =>
      (candidate.top === expectedTop && candidate.bottom === expectedBottom) ||
      (candidate.top === expectedBottom && candidate.bottom === expectedTop)
  );

  if (!tile) return null;
  return {
    tile,
    shouldFlip: tile.top !== expectedTop,
  };
};

/**
 * Sanitize externally-provided slot/bank state against a level — drops invalid
 * tile ids, removes duplicates between slot and bank, preserves bank order
 * for tiles already present.
 */
export const sanitizeState = (
  level: Level,
  slotsInput: Slots,
  bankInput: Tile[]
): { slots: Slots; bank: Tile[] } => {
  const canonicalById = new Map(level.tiles.map((tile) => [tile.id, tile]));
  const validIdSet = new Set(level.tiles.map((tile) => tile.id));
  const orientationById = new Map<string, boolean>();
  const occupied = new Set<string>();

  const normalizedSlots: Slots = [null, null];
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
    if (!validIdSet.has(tile.id) || occupied.has(tile.id)) continue;
    if (!orientationById.has(tile.id)) orientationById.set(tile.id, tile.isFlipped);
    if (!bankOrder.includes(tile.id)) bankOrder.push(tile.id);
  }
  for (const tile of level.tiles) {
    if (!occupied.has(tile.id) && !bankOrder.includes(tile.id)) bankOrder.push(tile.id);
  }

  const normalizedBank = bankOrder
    .filter((id) => !occupied.has(id))
    .map((id) => {
      const canonical = canonicalById.get(id)!;
      return { ...canonical, isFlipped: orientationById.get(id) ?? false };
    });

  return { slots: normalizedSlots, bank: normalizedBank };
};
