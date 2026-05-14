export type TileBase = {
  id: string;
  top: string;
  bottom: string;
};

export type Tile = TileBase & {
  isFlipped: boolean;
};

export type Slots = [Tile | null, Tile | null];

export type Rotation = 0 | 90 | 180 | 270;

export type Level = {
  id: number;
  tier?: 1 | 2 | 3;
  requiresRotation?: boolean;
  tiles: TileBase[];
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

export type BoardFaces = {
  topLeft: string | null;
  topRight: string | null;
  bottomLeft: string | null;
  bottomRight: string | null;
};

export type Edges = {
  top: string | null;
  bottom: string | null;
  left: string | null;
  right: string | null;
};

export type HintActionKind =
  | "addTile"
  | "removeTile"
  | "rotateTile"
  | "rotateBoard"
  | "rotateBoardBack";

export type HintStep = {
  action: HintActionKind;
  text: string;
};
