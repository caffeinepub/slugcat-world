import type { Room } from "./GameTypes";

const TS = 32; // tile size alias

function makeTiles(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function fillRect(
  T: number[][],
  col: number,
  row: number,
  w: number,
  h: number,
  val: number,
) {
  for (let r = row; r < row + h; r++)
    for (let c = col; c < col + w; c++)
      if (T[r] && T[r][c] !== undefined) T[r][c] = val;
}

function fillRow(
  T: number[][],
  row: number,
  c1: number,
  c2: number,
  val: number,
) {
  for (let c = c1; c <= c2; c++)
    if (T[row] && T[row][c] !== undefined) T[row][c] = val;
}

function fillCol(
  T: number[][],
  col: number,
  r1: number,
  r2: number,
  val: number,
) {
  for (let r = r1; r <= r2; r++)
    if (T[r] && T[r][col] !== undefined) T[r][col] = val;
}

export function createDefaultRooms(): Room[] {
  return [createRoom0(), createRoom1(), createRoom2()];
}

export function parseModRoom(
  level: {
    id: string;
    name: string;
    tiles: number[][];
    spawnX: number;
    spawnY: number;
    enemies?: Array<{ type: "lizard" | "batfly"; x: number; y: number }>;
    items?: Array<{ type: "food" | "spear"; x: number; y: number }>;
  },
  roomIndex: number,
): Room {
  const rows = level.tiles.length;
  const cols = level.tiles[0]?.length ?? 30;
  return {
    id: level.id,
    name: level.name,
    tiles: level.tiles,
    cols,
    rows,
    spawnX: level.spawnX,
    spawnY: level.spawnY,
    enemies: (level.enemies ?? []).map((e) => ({
      type: e.type,
      x: e.x,
      y: e.y,
    })),
    items: (level.items ?? []).map((i) => ({
      type: i.type as "food" | "spear",
      x: i.x,
      y: i.y,
    })),
    nextRoom: -1,
    prevRoom: roomIndex > 0 ? roomIndex - 1 : -1,
    shelterArea: { x: Math.floor(cols * 0.7) * TS, xMax: cols * TS },
    isCustom: true,
  };
}

function createRoom0(): Room {
  const cols = 40;
  const rows = 20;
  const T = makeTiles(rows, cols);

  // Ground (rows 17-19)
  fillRect(T, 0, 17, cols, 3, 1);

  // Shelter floor on right side (type 6 = shelter tile)
  fillRow(T, 17, 29, 39, 6);

  // Platforms
  fillRow(T, 13, 6, 10, 2);
  fillRow(T, 10, 14, 18, 2);
  fillRow(T, 13, 22, 26, 2);
  fillRow(T, 7, 8, 12, 2);
  fillRow(T, 9, 28, 32, 2);
  fillRow(T, 5, 33, 37, 2);

  // Poles
  fillCol(T, 3, 7, 16, 3);
  fillCol(T, 19, 4, 16, 3);

  return {
    id: "outskirts",
    name: "The Outskirts",
    tiles: T,
    cols,
    rows,
    spawnX: 2,
    spawnY: 15,
    enemies: [
      { type: "batfly", x: 10, y: 10 },
      { type: "batfly", x: 18, y: 8 },
      { type: "batfly", x: 25, y: 12 },
    ],
    items: [
      { type: "food", x: 8, y: 16 },
      { type: "food", x: 16, y: 16 },
      { type: "spear", x: 5, y: 16 },
      { type: "spear", x: 20, y: 16 },
    ],
    nextRoom: 1,
    prevRoom: -1,
    shelterArea: { x: 29 * TS, xMax: 40 * TS },
  };
}

function createRoom1(): Room {
  const cols = 45;
  const rows = 22;
  const T = makeTiles(rows, cols);

  // Ground
  fillRect(T, 0, 18, cols, 4, 1);

  // Shelter floor
  fillRow(T, 18, 35, 44, 6);

  // Platforms
  fillRow(T, 14, 3, 8, 2);
  fillRow(T, 11, 11, 15, 2);
  fillRow(T, 14, 18, 23, 2);
  fillRow(T, 9, 25, 30, 2);
  fillRow(T, 13, 32, 37, 2);
  fillRow(T, 8, 5, 9, 2);
  fillRow(T, 8, 38, 42, 2);

  // Solid obstacles (walls mid-room)
  fillCol(T, 16, 10, 17, 1);
  fillCol(T, 31, 9, 17, 1);

  // Poles
  fillCol(T, 10, 5, 17, 3);
  fillCol(T, 34, 5, 17, 3);

  return {
    id: "industrial",
    name: "Industrial Wastes",
    tiles: T,
    cols,
    rows,
    spawnX: 1,
    spawnY: 17,
    enemies: [
      { type: "lizard", x: 5, y: 17 },
      { type: "lizard", x: 20, y: 17 },
      { type: "lizard", x: 35, y: 17 },
      { type: "batfly", x: 12, y: 7 },
    ],
    items: [
      { type: "food", x: 13, y: 17 },
      { type: "food", x: 28, y: 17 },
      { type: "spear", x: 8, y: 17 },
      { type: "spear", x: 30, y: 17 },
    ],
    nextRoom: 2,
    prevRoom: 0,
    shelterArea: { x: 35 * TS, xMax: 45 * TS },
  };
}

function createRoom2(): Room {
  const cols = 30;
  const rows = 28;
  const T = makeTiles(rows, cols);

  // Ground
  fillRect(T, 0, 24, cols, 4, 1);

  // Side walls (not at very top to allow win)
  fillCol(T, 0, 4, 23, 1);
  fillCol(T, 29, 4, 23, 1);

  // Zig-zag platforms going up
  fillRow(T, 20, 1, 10, 2);
  fillRow(T, 16, 18, 27, 2);
  fillRow(T, 12, 2, 12, 2);
  fillRow(T, 8, 17, 26, 2);
  fillRow(T, 4, 2, 14, 2);

  // Win platform at top
  fillRow(T, 1, 14, 28, 1);
  // Shelter tiles on win platform (player stands here to win)
  fillRow(T, 1, 15, 28, 6);

  // Poles
  fillCol(T, 14, 1, 23, 3);
  fillCol(T, 5, 5, 19, 3);
  fillCol(T, 24, 5, 19, 3);

  // Spikes in dangerous gap
  fillRow(T, 23, 11, 17, 5);

  return {
    id: "the_wall",
    name: "The Wall",
    tiles: T,
    cols,
    rows,
    spawnX: 1,
    spawnY: 23,
    enemies: [
      { type: "lizard", x: 5, y: 23 },
      { type: "lizard", x: 20, y: 23 },
      { type: "batfly", x: 20, y: 10 },
    ],
    items: [
      { type: "food", x: 8, y: 23 },
      { type: "spear", x: 3, y: 23 },
    ],
    nextRoom: -1,
    prevRoom: 1,
    shelterArea: { x: 15 * TS, xMax: 28 * TS },
  };
}
