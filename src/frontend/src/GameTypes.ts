export type Screen = "menu" | "game" | "mods" | "gameover" | "win";

export interface Room {
  id: string;
  name: string;
  tiles: number[][];
  cols: number;
  rows: number;
  spawnX: number;
  spawnY: number;
  enemies: SpawnDef[];
  items: ItemDef[];
  nextRoom: number;
  prevRoom: number;
  shelterArea: { x: number; xMax: number };
  isCustom?: boolean;
}

export interface SpawnDef {
  type: "lizard" | "batfly";
  x: number;
  y: number;
}

export interface ItemDef {
  type: "food";
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  wallLeft: boolean;
  wallRight: boolean;
  wallSliding: boolean;
  onPole: boolean;
  poleX: number;
  jumpsLeft: number;
  facing: number;
  crouching: boolean;
  dropThrough: number;
  hunger: number;
  karma: number;
  hasGrabbed: boolean;
  state: PlayerState;
  grabCooldown: number;
  animTimer: number;
}

export type PlayerState =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "crouch"
  | "wallSlide"
  | "climb";

export interface Enemy {
  id: number;
  type: "lizard" | "batfly";
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  facing: number;
  state: "patrol" | "chase" | "wander" | "flee";
  patrolA: number;
  patrolB: number;
  wanderTimer: number;
  animTimer: number;
}

export interface FoodItem {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
  floatTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  type: "rain" | "dust" | "splash";
  size: number;
}

export interface Camera {
  x: number;
  y: number;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  items: FoodItem[];
  particles: Particle[];
  rooms: Room[];
  currentRoom: number;
  rainTimer: number;
  rainActive: boolean;
  rainExposure: number;
  camera: Camera;
  keys: Set<string>;
  phase: "playing" | "dead" | "won" | "sleeping";
  sleepTimer: number;
  nextId: number;
  frame: number;
  canvasW: number;
  canvasH: number;
  prevJump: boolean;
  prevGrab: boolean;
}

export interface ModLevel {
  id: string;
  name: string;
  tiles: number[][];
  spawnX: number;
  spawnY: number;
  enemies: SpawnDef[];
  items: ItemDef[];
}

export interface ModData {
  name: string;
  description: string;
  author: string;
  version: string;
  levels?: ModLevel[];
}
