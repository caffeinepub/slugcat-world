import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BodyChunk,
  Enemy,
  FoodItem,
  GameState,
  Particle,
  Player,
  Room,
  Spear,
} from "./GameTypes";

// ─── Constants ───────────────────────────────────────────────────────────────
const TS = 32;
const GRAVITY = 0.45;
const MAX_FALL = 12;
const PW = 16;
const PH = 20;
const PLAYER_SPEED = 3.5;
const CLIMB_SPEED = 2.2;
const JUMP_FORCE = -10.5;
const WALL_SLIDE_MAX = 1.5;
const FRIC_GROUND = 0.72;
const FRIC_AIR = 0.88;
const RAIN_DURATION = 120_000;
const RAIN_KILL_TIME = 15_000;
const SLEEP_DURATION = 1_800;
const FIXED_DT = 1000 / 60;

// Body chunk spring constants
const CHUNK_SEG_LEN = 7; // distance between body chunks
const TAIL_SEG_LEN = 6; // distance between tail nodes
const CHUNK_SPRING = 0.28; // spring stiffness
const CHUNK_DAMP = 0.78; // velocity damping per frame
const TAIL_SPRING = 0.32;
const TAIL_DAMP = 0.75;

// ─── Tile helpers ─────────────────────────────────────────────────────────────
function getTile(room: Room, c: number, r: number): number {
  if (c < 0 || c >= room.cols || r < 0 || r >= room.rows) return 1;
  return room.tiles[r][c];
}

function isSolid(t: number): boolean {
  return t === 1 || t === 6;
}

function inShelterZone(p: Player, room: Room): boolean {
  const cx = p.x + p.w / 2;
  return cx >= room.shelterArea.x && cx <= room.shelterArea.xMax;
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// ─── Physics ─────────────────────────────────────────────────────────────────
function resolvePlayerX(p: Player, room: Room) {
  p.x += p.vx;
  const top = Math.floor(p.y / TS);
  const bot = Math.floor((p.y + p.h - 1) / TS);
  if (p.vx > 0) {
    const rc = Math.floor((p.x + p.w - 1) / TS);
    for (let r = top; r <= bot; r++) {
      if (isSolid(getTile(room, rc, r))) {
        p.x = rc * TS - p.w;
        p.vx = 0;
        break;
      }
    }
  } else if (p.vx < 0) {
    const lc = Math.floor(p.x / TS);
    for (let r = top; r <= bot; r++) {
      if (isSolid(getTile(room, lc, r))) {
        p.x = (lc + 1) * TS;
        p.vx = 0;
        break;
      }
    }
  }
}

function resolvePlayerY(p: Player, room: Room, prevY: number): boolean {
  p.y += p.vy;
  const lc = Math.floor(p.x / TS);
  const rc = Math.floor((p.x + p.w - 1) / TS);
  let grounded = false;
  if (p.vy >= 0) {
    const bc = Math.floor((p.y + p.h - 1) / TS);
    for (let c = lc; c <= rc; c++) {
      const tile = getTile(room, c, bc);
      if (isSolid(tile)) {
        p.y = bc * TS - p.h;
        p.vy = 0;
        grounded = true;
        break;
      }
      if (tile === 2 && p.dropThrough <= 0) {
        const prevBot = prevY + p.h;
        const platTop = bc * TS;
        if (prevBot <= platTop + 2) {
          p.y = platTop - p.h;
          p.vy = 0;
          grounded = true;
          break;
        }
      }
    }
  } else {
    const tc = Math.floor(p.y / TS);
    for (let c = lc; c <= rc; c++) {
      if (isSolid(getTile(room, c, tc))) {
        p.y = (tc + 1) * TS;
        p.vy = 0;
        break;
      }
    }
  }
  return grounded;
}

function detectWalls(p: Player, room: Room) {
  const top = Math.floor((p.y + 4) / TS);
  const bot = Math.floor((p.y + p.h - 4) / TS);
  const lc = Math.floor((p.x - 1) / TS);
  const rc = Math.floor((p.x + p.w) / TS);
  p.wallLeft = false;
  p.wallRight = false;
  for (let r = top; r <= bot; r++) {
    if (isSolid(getTile(room, lc, r))) p.wallLeft = true;
    if (isSolid(getTile(room, rc, r))) p.wallRight = true;
  }
}

function resolveEnemyX(e: Enemy, room: Room) {
  e.x += e.vx;
  const top = Math.floor(e.y / TS);
  const bot = Math.floor((e.y + e.h - 1) / TS);
  if (e.vx > 0) {
    const rc = Math.floor((e.x + e.w - 1) / TS);
    for (let r = top; r <= bot; r++) {
      if (isSolid(getTile(room, rc, r))) {
        e.x = rc * TS - e.w;
        e.vx = 0;
        break;
      }
    }
  } else if (e.vx < 0) {
    const lc = Math.floor(e.x / TS);
    for (let r = top; r <= bot; r++) {
      if (isSolid(getTile(room, lc, r))) {
        e.x = (lc + 1) * TS;
        e.vx = 0;
        break;
      }
    }
  }
}

function resolveEnemyY(e: Enemy, room: Room, prevY: number): boolean {
  e.y += e.vy;
  const lc = Math.floor(e.x / TS);
  const rc = Math.floor((e.x + e.w - 1) / TS);
  let grounded = false;
  if (e.vy >= 0) {
    const bc = Math.floor((e.y + e.h - 1) / TS);
    for (let c = lc; c <= rc; c++) {
      if (isSolid(getTile(room, c, bc))) {
        e.y = bc * TS - e.h;
        e.vy = 0;
        grounded = true;
        break;
      }
    }
  } else {
    const tc = Math.floor(e.y / TS);
    for (let c = lc; c <= rc; c++) {
      if (isSolid(getTile(room, c, tc))) {
        e.y = (tc + 1) * TS;
        e.vy = 0;
        break;
      }
    }
  }
  if (!grounded) {
    // Check platform tiles too
    const bc = Math.floor((e.y + e.h - 1) / TS);
    const prevBot = prevY + e.h;
    const platTop = bc * TS;
    for (let c = lc; c <= rc; c++) {
      if (getTile(room, c, bc) === 2 && prevBot <= platTop + 4) {
        e.y = platTop - e.h;
        e.vy = 0;
        grounded = true;
        break;
      }
    }
  }
  return grounded;
}

// ─── Spring physics ───────────────────────────────────────────────────────────
/**
 * Spring-constrain child to stay within segLen of parent.
 * Applies spring force, gravity, damping, then enforces hard max distance.
 */
function springChunk(
  child: BodyChunk,
  parent: BodyChunk,
  segLen: number,
  spring: number,
  damp: number,
  gravFactor: number,
) {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

  const targetX = parent.x + (dx / dist) * segLen;
  const targetY = parent.y + (dy / dist) * segLen;
  child.vx += (targetX - child.x) * spring;
  child.vy += (targetY - child.y) * spring;

  child.vy += GRAVITY * gravFactor;

  child.vx *= damp;
  child.vy *= damp;

  child.x += child.vx;
  child.y += child.vy;

  // Hard constraint — keep within segLen
  const dx2 = child.x - parent.x;
  const dy2 = child.y - parent.y;
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 0.001;
  if (dist2 > segLen) {
    child.x = parent.x + (dx2 / dist2) * segLen;
    child.y = parent.y + (dy2 / dist2) * segLen;
  }
}

function makeChunk(x: number, y: number, r: number): BodyChunk {
  return { x, y, vx: 0, vy: 0, r };
}

function createBodyChunks(hx: number, hy: number): BodyChunk[] {
  return [
    makeChunk(hx, hy, 4.5), // head
    makeChunk(hx - CHUNK_SEG_LEN, hy + 2, 4.0), // upper body
    makeChunk(hx - CHUNK_SEG_LEN * 2, hy + 4, 3.5), // lower body / hips
  ];
}

function createTailNodes(hx: number, hy: number): BodyChunk[] {
  const nodes: BodyChunk[] = [];
  for (let i = 0; i < 6; i++) {
    nodes.push(
      makeChunk(
        hx - CHUNK_SEG_LEN * 2 - TAIL_SEG_LEN * (i + 1),
        hy + 4 + i * 1.5,
        2.5 - i * 0.25,
      ),
    );
  }
  return nodes;
}

function createLimbNodes(hx: number, hy: number): BodyChunk[] {
  // [frontLeft, frontRight, backLeft, backRight]
  return [
    makeChunk(hx - 3, hy + 12, 1.5), // frontLeft
    makeChunk(hx + 3, hy + 12, 1.5), // frontRight
    makeChunk(hx - 3 - CHUNK_SEG_LEN * 2, hy + 12, 1.5), // backLeft
    makeChunk(hx + 3 - CHUNK_SEG_LEN * 2, hy + 12, 1.5), // backRight
  ];
}

function updateBodyChunks(p: Player) {
  // Head chunk tracks player hitbox center-top
  p.bodyChunks[0].x = p.x + p.w / 2;
  p.bodyChunks[0].y = p.y + p.h * 0.25;
  p.bodyChunks[0].vx = p.vx;
  p.bodyChunks[0].vy = p.vy;

  for (let i = 1; i < p.bodyChunks.length; i++) {
    springChunk(
      p.bodyChunks[i],
      p.bodyChunks[i - 1],
      CHUNK_SEG_LEN,
      CHUNK_SPRING,
      CHUNK_DAMP,
      0.25,
    );
  }

  const tailRoot = p.bodyChunks[p.bodyChunks.length - 1];

  // Tail physics: on ground the tail rests; in air it hangs/swings
  const tailGrav = p.onGround ? 0.15 : 0.45;
  springChunk(
    p.tailNodes[0],
    tailRoot,
    TAIL_SEG_LEN,
    TAIL_SPRING,
    TAIL_DAMP,
    tailGrav,
  );
  for (let i = 1; i < p.tailNodes.length; i++) {
    const nodeGrav = p.onGround ? 0.1 : 0.4 + i * 0.05;
    springChunk(
      p.tailNodes[i],
      p.tailNodes[i - 1],
      TAIL_SEG_LEN,
      TAIL_SPRING,
      TAIL_DAMP,
      nodeGrav,
    );
  }

  // Ground-clamp tail: prevent tail from sinking below floor when on ground
  if (p.onGround) {
    const floorY = p.y + p.h;
    for (const node of p.tailNodes) {
      if (node.y > floorY) {
        node.y = floorY;
        node.vy = Math.min(node.vy, 0);
      }
    }
  }

  updateLimbNodes(p);
}

function updateLimbNodes(p: Player) {
  const limbs = p.limbNodes;
  if (!limbs || limbs.length < 4) return;

  const upperBody = p.bodyChunks[1]; // arms attach here
  const hips = p.bodyChunks[2]; // legs attach here

  const attachPoints = [
    { x: upperBody.x - 3, y: upperBody.y + 2 }, // armLeft  [0]
    { x: upperBody.x + 3, y: upperBody.y + 2 }, // armRight [1]
    { x: hips.x - 3, y: hips.y + 2 }, // legLeft  [2]
    { x: hips.x + 3, y: hips.y + 2 }, // legRight [3]
  ];

  const legLength = 12;
  const stride = 9;
  const facing = p.facing;

  // Walk cycle phase — only advances while moving on ground
  const isMoving = p.onGround && Math.abs(p.vx) > 0.3;
  const walkPhase = p.animTimer * 0.22;

  for (let i = 0; i < 4; i++) {
    const limb = limbs[i];
    const attach = attachPoints[i];
    const isArm = i < 2; // [0,1] = arms
    const isLeft = i % 2 === 0;
    const lateralSign = isLeft ? -1 : 1;
    // Left arm and right leg step together; right arm and left leg step together
    // Phase offset: arm swings opposite to same-side leg
    const phaseOffset = isLeft ? 0 : Math.PI;
    const phase = isArm
      ? walkPhase + phaseOffset + Math.PI
      : walkPhase + phaseOffset;
    const swingAmt = isMoving ? (isArm ? stride * 0.45 : stride * 0.6) : 0;

    let targetX: number;
    let targetY: number;

    if (p.onGround) {
      // Alternating stride
      const stepFwd = Math.sin(phase) * swingAmt * facing;
      targetX = attach.x + stepFwd + lateralSign * 2;
      if (isArm) {
        // Arms reach forward/backward at mid-body height
        targetY =
          attach.y +
          legLength * 0.55 +
          Math.max(0, Math.sin(phase + Math.PI * 0.5)) * 2;
      } else {
        // Legs step on ground, lift slightly mid-stride
        targetY = p.y + p.h + 1 - Math.max(0, Math.sin(phase)) * 3;
      }
    } else if (p.onPole) {
      // Grip the pole
      targetX = attach.x + lateralSign * 5;
      targetY = attach.y + legLength * 0.7;
    } else {
      // In air: dangle and swing with velocity
      const swingX = p.vx * 0.4;
      targetX = attach.x + lateralSign * 3 + swingX;
      targetY = attach.y + legLength + Math.abs(p.vy) * 0.2;
    }

    // Spring foot toward target
    const springK = p.onGround ? 0.2 : 0.1;
    const dampK = p.onGround ? 0.62 : 0.75;
    const gravF = p.onGround ? 0.0 : 0.3;

    limb.vx += (targetX - limb.x) * springK;
    limb.vy += (targetY - limb.y) * springK;
    limb.vy += GRAVITY * gravF;
    limb.vx *= dampK;
    limb.vy *= dampK;
    limb.x += limb.vx;
    limb.y += limb.vy;

    // Clamp max limb reach
    const maxReach = legLength + 6;
    const dx = limb.x - attach.x;
    const dy = limb.y - attach.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist > maxReach) {
      limb.x = attach.x + (dx / dist) * maxReach;
      limb.y = attach.y + (dy / dist) * maxReach;
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function createPlayer(room: Room): Player {
  const hx = room.spawnX * TS;
  const hy = room.spawnY * TS;
  return {
    x: hx,
    y: hy,
    vx: 0,
    vy: 0,
    w: PW,
    h: PH,
    onGround: false,
    wallLeft: false,
    wallRight: false,
    wallSliding: false,
    onPole: false,
    poleX: 0,
    jumpsLeft: 1,
    facing: 1,
    crouching: false,
    dropThrough: 0,
    hunger: 0,
    karma: 1,
    hasGrabbed: false,
    state: "idle",
    grabCooldown: 0,
    animTimer: 0,
    bodyChunks: createBodyChunks(hx + PW / 2, hy + PH * 0.25),
    tailNodes: createTailNodes(hx + PW / 2, hy + PH * 0.25),
    limbNodes: createLimbNodes(hx + PW / 2, hy + PH * 0.25),
    heldSpear: false,
    starving: false,
  };
}

function spawnEnemies(
  room: Room,
  startId: number,
): { enemies: Enemy[]; nextId: number } {
  let nextId = startId;
  const enemies: Enemy[] = [];
  for (const def of room.enemies) {
    if (def.type === "lizard") {
      enemies.push({
        id: nextId++,
        type: "lizard",
        x: def.x * TS,
        y: def.y * TS,
        vx: 0,
        vy: 0,
        w: 28,
        h: 18,
        onGround: false,
        facing: 1,
        state: "patrol",
        patrolA: Math.max(0, def.x - 6),
        patrolB: Math.min(room.cols - 1, def.x + 6),
        wanderTimer: 0,
        animTimer: 0,
      });
    } else {
      enemies.push({
        id: nextId++,
        type: "batfly",
        x: def.x * TS,
        y: def.y * TS,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        w: 10,
        h: 10,
        onGround: false,
        facing: 1,
        state: "wander",
        patrolA: 0,
        patrolB: 0,
        wanderTimer: 60,
        animTimer: 0,
      });
    }
  }
  return { enemies, nextId };
}

function spawnItems(
  room: Room,
  startId: number,
): { items: FoodItem[]; spears: Spear[]; nextId: number } {
  let nextId = startId;
  const items: FoodItem[] = [];
  const spears: Spear[] = [];
  for (const def of room.items) {
    if (def.type === "food") {
      items.push({
        id: nextId++,
        x: def.x * TS + 8,
        y: def.y * TS - 10,
        w: 14,
        h: 14,
        collected: false,
        floatTimer: Math.random() * Math.PI * 2,
      });
    } else if (def.type === "spear") {
      spears.push({
        id: nextId++,
        x: def.x * TS,
        y: def.y * TS - 8,
        vx: 0,
        vy: 0,
        angle: 0,
        angVel: 0,
        stuck: true, // spawned spears rest on ground
        w: 24,
        h: 4,
      });
    }
  }
  return { items, spears, nextId };
}

export function initGameState(rooms: Room[], initialRoom: number): GameState {
  const room = rooms[initialRoom];
  const player = createPlayer(room);
  const { enemies, nextId: nid1 } = spawnEnemies(room, 1);
  const { items, spears, nextId: nid2 } = spawnItems(room, nid1);
  return {
    player,
    enemies,
    items,
    spears,
    particles: [],
    rooms,
    currentRoom: initialRoom,
    rainTimer: RAIN_DURATION,
    rainActive: false,
    rainExposure: 0,
    camera: { x: 0, y: 0 },
    keys: new Set(),
    phase: "playing",
    sleepTimer: 0,
    nextId: nid2,
    frame: 0,
    canvasW: window.innerWidth,
    canvasH: window.innerHeight,
    prevJump: false,
    prevGrab: false,
    starvationPenalty: false,
    customSprite: null as HTMLImageElement | null,
  };
}

function transitionRoom(gs: GameState, targetRoom: number) {
  gs.currentRoom = targetRoom;
  const room = gs.rooms[targetRoom];
  gs.player = createPlayer(room);
  // Preserve hunger/karma/heldSpear/starving across rooms
  gs.player.hunger = 0;
  gs.player.karma = Math.max(1, gs.player.karma);
  const { enemies, nextId: nid1 } = spawnEnemies(room, gs.nextId);
  gs.enemies = enemies;
  gs.nextId = nid1;
  const { items, spears, nextId: nid2 } = spawnItems(room, gs.nextId);
  gs.items = items;
  gs.spears = spears;
  gs.nextId = nid2;
  gs.particles = [];
  gs.camera = { x: 0, y: 0 };
}

// ─── Update ───────────────────────────────────────────────────────────────────
function updatePlayer(gs: GameState) {
  const p = gs.player;
  const room = gs.rooms[gs.currentRoom];
  const { keys } = gs;

  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const up = keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  const grab = keys.has("KeyZ") || keys.has("KeyX");

  const jumpPressed = up && !gs.prevJump;
  const grabPressed = grab && !gs.prevGrab;

  // ── Spear throw ──────────────────────────────────────────────────────────
  if (grabPressed && p.heldSpear) {
    const throwSpeed = 12;
    gs.spears.push({
      id: gs.nextId++,
      x: p.x + p.w / 2 + p.facing * 10,
      y: p.y + p.h / 2 - 2,
      vx: p.facing * throwSpeed,
      vy: -2,
      angle: p.facing === 1 ? 0 : Math.PI,
      angVel: p.facing * 0.3,
      stuck: false,
      w: 24,
      h: 4,
    });
    p.heldSpear = false;
  } else if (grabPressed && p.grabCooldown <= 0) {
    // ── Spear pickup ────────────────────────────────────────────────────────
    let pickedUpSpear = false;
    if (!p.heldSpear) {
      const pickupBox = { x: p.x - 10, y: p.y - 10, w: p.w + 20, h: p.h + 20 };
      for (let si = 0; si < gs.spears.length; si++) {
        const s = gs.spears[si];
        const spearBox = {
          x: s.x - s.w / 2,
          y: s.y - s.h / 2,
          w: s.w,
          h: s.h + 4,
        };
        if (overlaps(pickupBox, spearBox)) {
          p.heldSpear = true;
          p.grabCooldown = 20;
          gs.spears.splice(si, 1);
          pickedUpSpear = true;
          break;
        }
      }
    }

    if (!pickedUpSpear) {
      // ── Batfly grab ───────────────────────────────────────────────────────
      let grabbed = false;
      for (let i = 0; i < gs.enemies.length; i++) {
        const e = gs.enemies[i];
        if (e.type === "batfly" && overlaps(p, e)) {
          gs.enemies.splice(i, 1);
          p.hunger++;
          p.hasGrabbed = true;
          p.grabCooldown = 20;
          if (p.hunger >= 4) {
            p.karma = Math.min(p.karma + 1, 5);
            p.hunger = 0;
          }
          grabbed = true;
          break;
        }
      }
      if (!grabbed) {
        for (let i = 0; i < gs.items.length; i++) {
          const item = gs.items[i];
          if (!item.collected && overlaps(p, item)) {
            item.collected = true;
            p.hunger++;
            p.hasGrabbed = true;
            p.grabCooldown = 20;
            if (p.hunger >= 4) {
              p.karma = Math.min(p.karma + 1, 5);
              p.hunger = 0;
            }
            break;
          }
        }
      }
    }
  }
  gs.items = gs.items.filter((i) => !i.collected);

  p.crouching = down && p.onGround;
  if (down && p.onGround) p.dropThrough = 15;

  const midCol = Math.floor((p.x + p.w / 2) / TS);
  const topRow = Math.floor(p.y / TS);
  const botRow = Math.floor((p.y + p.h - 1) / TS);
  let nearPole = false;
  for (let r = topRow; r <= botRow; r++) {
    if (getTile(room, midCol, r) === 3) {
      nearPole = true;
      break;
    }
  }

  if (!p.onPole && nearPole && (up || down)) {
    p.onPole = true;
    p.poleX = midCol * TS + TS / 2 - p.w / 2;
    p.vy = 0;
  }

  if (p.onPole) {
    if (!nearPole) {
      p.onPole = false;
    } else {
      p.x = p.poleX;
      p.vx = 0;
      if (up) p.vy = -CLIMB_SPEED;
      else if (down) p.vy = CLIMB_SPEED;
      else p.vy = 0;

      if (jumpPressed) {
        p.onPole = false;
        p.vy = JUMP_FORCE * 0.8;
        p.vx = left ? -PLAYER_SPEED * 1.3 : right ? PLAYER_SPEED * 1.3 : 0;
      }
    }
  }

  if (!p.onPole) {
    if (left) {
      p.vx -= PLAYER_SPEED * (p.onGround ? 0.5 : 0.3);
      p.facing = -1;
    }
    if (right) {
      p.vx += PLAYER_SPEED * (p.onGround ? 0.5 : 0.3);
      p.facing = 1;
    }
    p.vx = Math.max(-PLAYER_SPEED * 1.5, Math.min(p.vx, PLAYER_SPEED * 1.5));
    p.vx *= p.onGround ? FRIC_GROUND : FRIC_AIR;

    detectWalls(p, room);
    p.wallSliding =
      !p.onGround && ((p.wallLeft && left) || (p.wallRight && right));

    if (p.wallSliding) {
      p.vy = Math.min(p.vy, WALL_SLIDE_MAX);
      p.jumpsLeft = 1;
    }

    if (jumpPressed && p.jumpsLeft > 0) {
      p.vy = JUMP_FORCE;
      p.jumpsLeft--;
      if (p.wallSliding) {
        p.vx = p.wallLeft ? PLAYER_SPEED * 2 : -PLAYER_SPEED * 2;
      }
    }

    p.vy += GRAVITY;
    if (p.vy > MAX_FALL) p.vy = MAX_FALL;

    const prevY = p.y;
    if (p.dropThrough > 0) p.dropThrough--;
    resolvePlayerX(p, room);
    p.onGround = resolvePlayerY(p, room, prevY);
    if (p.onGround) p.jumpsLeft = 1;
  } else {
    p.vy += GRAVITY * 0.15;
    p.vy = Math.max(-CLIMB_SPEED, Math.min(p.vy, CLIMB_SPEED));
    p.y += p.vy;
    p.onGround = false;
  }

  if (p.x < 0) p.x = 0;
  if (p.x + p.w > room.cols * TS) p.x = room.cols * TS - p.w;

  if (overlaps(p, { x: -9999, y: room.rows * TS, w: 99999, h: 100 })) {
    gs.phase = "dead";
    return;
  }

  const spd = Math.abs(p.vx);
  if (!p.onGround && !p.onPole) {
    p.state = p.vy < 0 ? "jump" : "fall";
  } else if (p.wallSliding) {
    p.state = "wallSlide";
  } else if (p.onPole) {
    p.state = "climb";
  } else if (p.crouching) {
    p.state = "crouch";
  } else if (spd > 0.5) {
    p.state = "run";
  } else {
    p.state = "idle";
  }
  p.animTimer++;
  if (p.grabCooldown > 0) p.grabCooldown--;

  updateBodyChunks(p);
}

function updateSpears(gs: GameState) {
  const room = gs.rooms[gs.currentRoom];
  for (const spear of gs.spears) {
    if (spear.stuck) continue;
    spear.vy += GRAVITY * 0.6;
    spear.x += spear.vx;
    spear.y += spear.vy;
    spear.angle += spear.angVel;
    spear.angVel *= 0.98;
    // Align angle to velocity when flying fast
    if (Math.abs(spear.vx) > 2) {
      spear.angle = Math.atan2(spear.vy, spear.vx);
    }
    // Wall/floor collision
    const tc = Math.floor(spear.x / TS);
    const tr = Math.floor(spear.y / TS);
    if (isSolid(getTile(room, tc, tr)) || isSolid(getTile(room, tc, tr + 1))) {
      spear.stuck = true;
      spear.vx = 0;
      spear.vy = 0;
      spear.angVel = 0;
    }
    // Out of bounds
    if (spear.y > room.rows * TS) spear.stuck = true;
  }

  // Spear vs lizard collision
  for (let si = gs.spears.length - 1; si >= 0; si--) {
    const spear = gs.spears[si];
    if (spear.stuck) continue;
    // Only flying spears can hit (speed threshold)
    if (Math.abs(spear.vx) < 3 && Math.abs(spear.vy) < 3) continue;
    const spearRect = { x: spear.x - 12, y: spear.y - 2, w: 24, h: 4 };
    for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
      const e = gs.enemies[ei];
      if (e.type === "lizard" && overlaps(spearRect, e)) {
        gs.enemies.splice(ei, 1);
        gs.spears.splice(si, 1);
        spawnDust(gs, e.x + e.w / 2, e.y + e.h / 2);
        break;
      }
    }
  }
}

function updateEnemies(gs: GameState) {
  const room = gs.rooms[gs.currentRoom];
  const p = gs.player;

  for (let i = gs.enemies.length - 1; i >= 0; i--) {
    const e = gs.enemies[i];
    if (e.type === "lizard") {
      const dx = p.x - e.x;
      const dist = Math.abs(dx);
      const dy = Math.abs(p.y - e.y);

      if (dist < 200 && dy < 64) e.state = "chase";
      else if (e.state === "chase" && dist > 300) e.state = "patrol";

      const speed = e.state === "chase" ? 2.4 : 1.0;
      if (e.state === "chase") {
        e.vx = dx > 0 ? speed : -speed;
        e.facing = dx > 0 ? 1 : -1;
      } else {
        const ax = e.patrolA * TS;
        const bx = e.patrolB * TS;
        if (e.x <= ax) {
          e.vx = speed;
          e.facing = 1;
        } else if (e.x >= bx) {
          e.vx = -speed;
          e.facing = -1;
        } else if (e.vx === 0) {
          e.vx = speed;
          e.facing = 1;
        }
      }

      e.vy += GRAVITY;
      if (e.vy > MAX_FALL) e.vy = MAX_FALL;

      const prevY = e.y;
      resolveEnemyX(e, room);
      e.onGround = resolveEnemyY(e, room, prevY);

      if (e.vx === 0 && e.state === "patrol") {
        const tmp = e.patrolA;
        e.patrolA = e.patrolB;
        e.patrolB = tmp;
        e.facing *= -1;
      }
      if (overlaps(p, e) && gs.phase === "playing") gs.phase = "dead";
    } else {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 80) {
        e.state = "flee";
        e.vx = dx > 0 ? -2.5 : 2.5;
        e.vy = -1.5;
      } else if (e.state === "flee" && dist > 180) {
        e.state = "wander";
      }

      if (e.state === "wander") {
        e.wanderTimer--;
        if (e.wanderTimer <= 0) {
          e.wanderTimer = 60 + Math.floor(Math.random() * 90);
          e.vx = (Math.random() - 0.5) * 2;
          e.vy = (Math.random() - 0.5) * 1.5;
        }
        e.vy += Math.sin(gs.frame * 0.05 + e.id) * 0.05;
      }

      e.x += e.vx;
      e.y += e.vy;
      e.vx *= 0.94;
      e.vy *= 0.94;

      if (e.x < 20) {
        e.x = 20;
        e.vx = Math.abs(e.vx);
      }
      if (e.x > room.cols * TS - 20) {
        e.x = room.cols * TS - 20;
        e.vx = -Math.abs(e.vx);
      }
      if (e.y < 10) {
        e.y = 10;
        e.vy = Math.abs(e.vy);
      }
      if (e.y > room.rows * TS - 30) {
        e.y = room.rows * TS - 30;
        e.vy = -Math.abs(e.vy);
      }
    }
    e.animTimer++;
  }
}

function checkSpikes(gs: GameState) {
  const p = gs.player;
  const room = gs.rooms[gs.currentRoom];
  const lc = Math.floor(p.x / TS);
  const rc = Math.floor((p.x + p.w - 1) / TS);
  const bc = Math.floor((p.y + p.h - 1) / TS);
  for (let c = lc; c <= rc; c++) {
    if (getTile(room, c, bc) === 5) {
      gs.phase = "dead";
      return;
    }
  }
}

function spawnDust(gs: GameState, x: number, y: number) {
  for (let i = 0; i < 6; i++) {
    gs.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2.5,
      life: 0.8 + Math.random() * 0.4,
      type: "dust",
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles(gs: GameState) {
  const spawnCount = gs.rainActive ? 14 : 3;
  for (let i = 0; i < spawnCount; i++) {
    gs.particles.push({
      x: gs.camera.x + Math.random() * gs.canvasW,
      y: gs.camera.y - 5,
      vx: -0.7 - Math.random() * 0.5,
      vy: 9 + Math.random() * 5,
      life: 1,
      type: "rain",
      size: 1 + Math.random(),
    });
  }
  for (const p of gs.particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === "rain") p.life -= 0.018;
    else p.life -= 0.04;
  }
  gs.particles = gs.particles.filter(
    (p) =>
      p.life > 0 &&
      p.y < gs.camera.y + gs.canvasH + 20 &&
      p.x > gs.camera.x - 20 &&
      p.x < gs.camera.x + gs.canvasW + 20,
  );
  if (gs.particles.length > 600)
    gs.particles.splice(0, gs.particles.length - 600);
}

function updateCamera(gs: GameState) {
  const p = gs.player;
  const room = gs.rooms[gs.currentRoom];
  const maxX = Math.max(0, room.cols * TS - gs.canvasW);
  const maxY = Math.max(0, room.rows * TS - gs.canvasH);
  const tx = p.x + p.w / 2 - gs.canvasW / 2;
  const ty = p.y + p.h / 2 - gs.canvasH / 2;
  gs.camera.x += (tx - gs.camera.x) * 0.1;
  gs.camera.y += (ty - gs.camera.y) * 0.1;
  gs.camera.x = Math.max(0, Math.min(gs.camera.x, maxX));
  gs.camera.y = Math.max(0, Math.min(gs.camera.y, maxY));
}

function update(gs: GameState) {
  if (gs.phase === "dead" || gs.phase === "won") return;
  gs.frame++;
  const room = gs.rooms[gs.currentRoom];

  if (gs.phase === "sleeping") {
    gs.sleepTimer -= FIXED_DT;
    if (gs.sleepTimer <= 0) {
      if (room.nextRoom === -1) {
        gs.phase = "won";
        return;
      }
      // Apply starvation penalty before waking
      if (gs.starvationPenalty) {
        gs.player.starving = true;
        gs.player.karma = Math.max(1, gs.player.karma - 1);
        gs.starvationPenalty = false;
      }
      gs.rainTimer = RAIN_DURATION;
      gs.rainActive = false;
      gs.rainExposure = 0;
      const { enemies, nextId: nid1 } = spawnEnemies(room, gs.nextId);
      gs.enemies = enemies;
      gs.nextId = nid1;
      const { items, spears, nextId: nid2 } = spawnItems(room, gs.nextId);
      gs.items = items;
      gs.spears = spears;
      gs.nextId = nid2;
      gs.phase = "playing";
    }
    updateParticles(gs);
    updateCamera(gs);
    return;
  }

  gs.rainTimer = Math.max(0, gs.rainTimer - FIXED_DT);
  if (gs.rainTimer === 0) gs.rainActive = true;

  const safe = inShelterZone(gs.player, room);
  if (gs.rainActive && !safe) {
    gs.rainExposure += FIXED_DT;
    if (gs.rainExposure >= RAIN_KILL_TIME) {
      gs.phase = "dead";
      return;
    }
  } else {
    gs.rainExposure = Math.max(0, gs.rainExposure - FIXED_DT * 1.5);
  }

  updatePlayer(gs);
  if ((gs.phase as string) === "dead") return;
  checkSpikes(gs);
  if ((gs.phase as string) === "dead") return;
  updateEnemies(gs);
  if ((gs.phase as string) === "dead") return;
  updateSpears(gs);

  const pressingDown = gs.keys.has("ArrowDown") || gs.keys.has("KeyS");
  if (inShelterZone(gs.player, room) && gs.player.onGround && pressingDown) {
    // Set starvation penalty based on hunger before sleeping
    gs.starvationPenalty = gs.player.hunger < 2;
    gs.phase = "sleeping";
    gs.sleepTimer = SLEEP_DURATION;
  }

  if (
    room.nextRoom === -1 &&
    gs.player.y < 4 * TS &&
    inShelterZone(gs.player, room)
  ) {
    gs.phase = "won";
    return;
  }

  if (
    gs.player.x > room.cols * TS - 10 &&
    room.nextRoom !== -1 &&
    room.nextRoom < gs.rooms.length
  ) {
    transitionRoom(gs, room.nextRoom);
    return;
  }
  if (gs.player.x < -10 && room.prevRoom !== -1) {
    transitionRoom(gs, room.prevRoom);
    return;
  }

  for (const item of gs.items) item.floatTimer += 0.06;

  updateParticles(gs);
  updateCamera(gs);

  gs.prevJump =
    gs.keys.has("ArrowUp") || gs.keys.has("KeyW") || gs.keys.has("Space");
  gs.prevGrab = gs.keys.has("KeyZ") || gs.keys.has("KeyX");
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function drawTile(
  ctx: CanvasRenderingContext2D,
  type: number,
  sx: number,
  sy: number,
) {
  if (type === 0) return;
  if (type === 1) {
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = "#252538";
    ctx.fillRect(sx, sy, TS, 1);
    ctx.fillRect(sx, sy, 1, TS);
    ctx.fillStyle = "#0d0d18";
    ctx.fillRect(sx, sy + TS - 1, TS, 1);
    ctx.fillRect(sx + TS - 1, sy, 1, TS);
  } else if (type === 2) {
    ctx.fillStyle = "#2e1c0d";
    ctx.fillRect(sx + 1, sy + TS / 2 - 5, TS - 2, 10);
    ctx.fillStyle = "#4a3018";
    ctx.fillRect(sx + 1, sy + TS / 2 - 5, TS - 2, 2);
    ctx.fillStyle = "#1a0e05";
    ctx.fillRect(sx + 1, sy + TS / 2 + 3, TS - 2, 2);
  } else if (type === 3) {
    ctx.fillStyle = "#555568";
    ctx.fillRect(sx + 14, sy, 4, TS);
    ctx.fillStyle = "#7777aa";
    ctx.fillRect(sx + 14, sy, 1, TS);
  } else if (type === 4) {
    ctx.fillStyle = "rgba(20,80,200,0.55)";
    ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = "rgba(60,120,240,0.3)";
    ctx.fillRect(sx, sy, TS, 3);
  } else if (type === 5) {
    ctx.fillStyle = "#445566";
    for (let i = 0; i < 4; i++) {
      const tx = sx + i * 8 + 4;
      ctx.beginPath();
      ctx.moveTo(tx - 4, sy + TS);
      ctx.lineTo(tx, sy + TS - 12);
      ctx.lineTo(tx + 4, sy + TS);
      ctx.fill();
    }
  } else if (type === 6) {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = "#152515";
    ctx.fillRect(sx + 2, sy + 2, TS - 4, TS - 4);
    ctx.fillStyle = "#1f3d1f";
    ctx.fillRect(sx, sy, TS, 1);
    ctx.fillRect(sx, sy, 1, TS);
  }
}

function drawSpear(
  ctx: CanvasRenderingContext2D,
  spear: Spear,
  camX: number,
  camY: number,
) {
  const sx = spear.x - camX;
  const sy = spear.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(spear.angle);
  // Shaft
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(-14, -1.5, 24, 3);
  // Tip (metal point)
  ctx.fillStyle = "#aaaacc";
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(14, -3);
  ctx.lineTo(16, 0);
  ctx.lineTo(14, 3);
  ctx.closePath();
  ctx.fill();
  // Butt end
  ctx.fillStyle = "#6a4a0a";
  ctx.fillRect(-14, -2, 3, 4);
  ctx.restore();
}

/**
 * Draw slugcat using procedural body chunks + tail nodes + limb nodes.
 * Render order: back limbs → tail → body → front limbs → head
 */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  camX: number,
  camY: number,
  _frame: number,
  customSprite?: HTMLImageElement | null,
) {
  const chunks = p.bodyChunks;
  const tail = p.tailNodes;
  const limbs = p.limbNodes;

  // Helper: world → screen
  const sx = (c: BodyChunk) => c.x - camX;
  const sy = (c: BodyChunk) => c.y - camY;

  const headSX = sx(chunks[0]);
  const headSY = sy(chunks[0]);
  const body1SX = sx(chunks[1]);
  const body1SY = sy(chunks[1]);
  const body2SX = sx(chunks[2]);
  const body2SY = sy(chunks[2]);

  const bodyColor = "#f0ead6";
  const limbColor = "#c8c0aa";
  const shadow = "rgba(0,0,0,0.22)";

  // ── Helper: draw a 2-segment leg ─────────────────────────────────────────
  function drawLimb(
    attachX: number,
    attachY: number,
    footX: number,
    footY: number,
    bendDir: number, // +1 = bend right/forward, -1 = bend left/back
  ) {
    const midX = (attachX + footX) / 2;
    const midY = (attachY + footY) / 2;
    // Perpendicular offset for knee bend
    const dx = footX - attachX;
    const dy = footY - attachY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = (-dy / len) * 5 * bendDir;
    const perpY = (dx / len) * 5 * bendDir;
    const kneeX = midX + perpX;
    const kneeY = midY + perpY;

    ctx.save();
    ctx.strokeStyle = limbColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // Small foot dot
    ctx.fillStyle = limbColor;
    ctx.beginPath();
    ctx.arc(footX, footY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Attach points in screen space
  const frontAttachX = body1SX;
  const frontAttachY = body1SY + 2;
  const backAttachX = body2SX;
  const backAttachY = body2SY + 2;

  const facing = p.facing;

  // ── Back limbs (drawn BEFORE body) ───────────────────────────────────────
  if (limbs && limbs.length >= 4) {
    // backLeft [2], backRight [3]
    drawLimb(backAttachX - 2, backAttachY, sx(limbs[2]), sy(limbs[2]), -facing);
    drawLimb(backAttachX + 2, backAttachY, sx(limbs[3]), sy(limbs[3]), facing);
  }

  // ── Tail ─────────────────────────────────────────────────────────────────
  const tailRoot = chunks[chunks.length - 1];
  ctx.save();
  ctx.strokeStyle = "#c8c0aa";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx(tailRoot), sy(tailRoot));
  for (let i = 0; i < tail.length; i++) {
    const t = tail[i];
    const w = tailRoot.r * 2 - (i * (tailRoot.r * 2 - 0.8)) / tail.length;
    ctx.lineWidth = Math.max(0.8, w);
    ctx.lineTo(sx(t), sy(t));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(t), sy(t));
  }
  ctx.restore();

  // ── Hips ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(
    body2SX + 1,
    body2SY + 2,
    chunks[2].r + 1,
    chunks[2].r,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(
    body2SX,
    body2SY,
    chunks[2].r + 1,
    chunks[2].r,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // ── Body connecting strip ─────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = (chunks[1].r + chunks[2].r) * 0.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(body1SX, body1SY);
  ctx.lineTo(body2SX, body2SY);
  ctx.stroke();
  ctx.restore();

  // ── Upper body ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(
    body1SX + 1,
    body1SY + 2,
    chunks[1].r + 1.5,
    chunks[1].r + 0.5,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(
    body1SX,
    body1SY,
    chunks[1].r + 1.5,
    chunks[1].r + 1,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // ── Front limbs (drawn AFTER body, BEFORE head) ───────────────────────────
  if (limbs && limbs.length >= 2) {
    // frontLeft [0], frontRight [1]
    drawLimb(
      frontAttachX - 2,
      frontAttachY,
      sx(limbs[0]),
      sy(limbs[0]),
      -facing,
    );
    drawLimb(
      frontAttachX + 2,
      frontAttachY,
      sx(limbs[1]),
      sy(limbs[1]),
      facing,
    );
  }

  // ── Held spear ────────────────────────────────────────────────────────────
  if (p.heldSpear) {
    ctx.save();
    ctx.translate(headSX + facing * 4, headSY + 2);
    ctx.rotate(facing > 0 ? -0.3 : Math.PI + 0.3);
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(-14, -1.5, 24, 3);
    ctx.fillStyle = "#aaaacc";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(14, -3);
    ctx.lineTo(16, 0);
    ctx.lineTo(14, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Neck connector ────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = (chunks[0].r + chunks[1].r) * 0.75;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(headSX, headSY);
  ctx.lineTo(body1SX, body1SY);
  ctx.stroke();
  ctx.restore();

  // ── Head ──────────────────────────────────────────────────────────────────
  // Compute head tilt from body chain angle
  const hdx = headSX - body1SX;
  const hdy = headSY - body1SY;
  const headAngle = Math.atan2(hdy, hdx) - Math.PI / 2;

  ctx.save();
  ctx.translate(headSX, headSY);
  ctx.rotate(headAngle);

  // Shadow
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(1.5, 1.5, chunks[0].r + 1, chunks[0].r + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head circle
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, chunks[0].r + 1, chunks[0].r + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const r = chunks[0].r + 1;

  // ── Pointed ears (drawn BEFORE head so head overlaps base) ───────────────
  // Left ear
  ctx.fillStyle = "#f0ead6";
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.5);
  ctx.lineTo(-r * 1.0, -r * 1.5);
  ctx.lineTo(-r * 0.35, -r * 0.8);
  ctx.closePath();
  ctx.fill();
  // Left ear inner
  ctx.fillStyle = "#e8a0a0";
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.6);
  ctx.lineTo(-r * 0.95, -r * 1.35);
  ctx.lineTo(-r * 0.42, -r * 0.85);
  ctx.closePath();
  ctx.fill();
  // Right ear
  ctx.fillStyle = "#f0ead6";
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.5);
  ctx.lineTo(r * 1.0, -r * 1.5);
  ctx.lineTo(r * 0.35, -r * 0.8);
  ctx.closePath();
  ctx.fill();
  // Right ear inner
  ctx.fillStyle = "#e8a0a0";
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.6);
  ctx.lineTo(r * 0.95, -r * 1.35);
  ctx.lineTo(r * 0.42, -r * 0.85);
  ctx.closePath();
  ctx.fill();

  // ── Head circle (drawn after ears so it overlaps their base) ─────────────
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(1.5, 1.5, r, chunks[0].r + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, chunks[0].r + 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Custom sprite clipped to head ─────────────────────────────────────────
  if (customSprite) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, chunks[0].r + 0.5, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(customSprite, -r - 1, -r - 0.5, (r + 1) * 2, (r + 0.5) * 2);
    ctx.restore();
  }

  // ── Two eyes (both on facing side) ───────────────────────────────────────
  const eye1X = facing * (r - 2);
  const eye1Y = -r * 0.3;
  const eye2X = facing * (r * 0.3);
  const eye2Y = -r * 0.5;
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(eye1X, eye1Y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2X, eye2Y, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(eye1X + 0.6, eye1Y - 0.6, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2X + 0.5, eye2Y - 0.5, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // ── Nose ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(facing * (r * 0.5), -r * 0.05, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLizard(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y, w, h, facing, animTimer, state } = e;
  const walkBob = e.onGround ? Math.sin(animTimer * 0.18) * 1.5 : 0;

  const bodyColor = state === "chase" ? "#5aba5a" : "#4a9a4a";
  const limbColor = "#3a7a3a";

  // Helper: draw a 2-segment limb (attach → knee → foot)
  function drawLimb2(
    ax: number,
    ay: number,
    fx: number,
    fy: number,
    bendDir: number,
    thick: number,
  ) {
    const mx = (ax + fx) / 2;
    const my = (ay + fy) / 2;
    const dx = fx - ax;
    const dy = fy - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const kx = mx + (-dy / len) * 5 * bendDir;
    const ky = my + (dx / len) * 5 * bendDir;
    ctx.save();
    ctx.strokeStyle = limbColor;
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(kx, ky);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.fillStyle = limbColor;
    ctx.beginPath();
    ctx.arc(fx, fy, thick * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + walkBob);
  ctx.scale(facing, 1);

  // Walk animation: all 4 legs on the ground, alternating diagonal pairs
  const legPhase = animTimer * 0.22;
  const legSwing = e.onGround ? 5 : 3;

  // Back legs: attach near rear of body
  const bLegAY = h / 2 - 3;
  const bLegAXL = -6;
  const bLegAXR = 6;
  const bFootL_X = bLegAXL + Math.sin(legPhase) * legSwing;
  const bFootL_Y = h / 2 + 8 + Math.max(0, -Math.sin(legPhase)) * 3;
  const bFootR_X = bLegAXR - Math.sin(legPhase) * legSwing;
  const bFootR_Y = h / 2 + 8 + Math.max(0, Math.sin(legPhase)) * 3;

  // Front legs: attach near front of body, stride opposite to back legs
  const fLegAY = -h / 2 + 5;
  const fLegAXL = -4;
  const fLegAXR = 4;
  // Front legs phase-shifted by PI so diagonal pairs move together
  const fFootL_X = fLegAXL - Math.sin(legPhase) * legSwing;
  const fFootL_Y = h / 2 + 6 + Math.max(0, Math.sin(legPhase)) * 3;
  const fFootR_X = fLegAXR + Math.sin(legPhase) * legSwing;
  const fFootR_Y = h / 2 + 6 + Math.max(0, -Math.sin(legPhase)) * 3;

  // ── Back legs (drawn behind body) ─────────────────────────────────────────
  drawLimb2(bLegAXL - 1, bLegAY, bFootL_X - 1, bFootL_Y, 1, 1.5);
  drawLimb2(bLegAXR + 1, bLegAY, bFootR_X + 1, bFootR_Y, -1, 1.5);

  // ── Shadow ────────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 3, w / 2, h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Body (torso) ──────────────────────────────────────────────────────────
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6aaa6a";
  ctx.beginPath();
  ctx.ellipse(2, 2, w / 2 - 6, h / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Tail ──────────────────────────────────────────────────────────────────
  const tailWag = Math.sin(animTimer * 0.15) * 3;
  ctx.strokeStyle = "#3a7a3a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w / 2, 2);
  ctx.bezierCurveTo(
    -w / 2 - 8,
    4 + tailWag * 0.5,
    -w / 2 - 14,
    tailWag,
    -w / 2 - 20,
    -4 + tailWag,
  );
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 14, tailWag);
  ctx.bezierCurveTo(
    -w / 2 - 20,
    -4 + tailWag,
    -w / 2 - 24,
    -2 + tailWag * 0.8,
    -w / 2 - 26,
    tailWag * 0.5,
  );
  ctx.stroke();

  // ── Head ──────────────────────────────────────────────────────────────────
  const headX = w / 2 - 2;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(headX, -2, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(headX + 4, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,100,0.7)";
  ctx.beginPath();
  ctx.arc(headX + 4, -4, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // ── Front legs (drawn over body) ──────────────────────────────────────────
  drawLimb2(fLegAXL, fLegAY, fFootL_X, fFootL_Y, -1, 1.5);
  drawLimb2(fLegAXR, fLegAY, fFootR_X, fFootR_Y, 1, 1.5);

  ctx.restore();
}

function drawBatfly(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y, animTimer } = e;
  const flapAngle = Math.sin(animTimer * 0.35) * 0.5;
  ctx.save();
  ctx.translate(x + 5, y + 5);

  ctx.fillStyle = "rgba(80,100,160,0.7)";
  ctx.save();
  ctx.rotate(flapAngle);
  ctx.beginPath();
  ctx.ellipse(-6, 0, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.rotate(-flapAngle);
  ctx.beginPath();
  ctx.ellipse(6, 0, 6, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#303050";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff6644";
  ctx.beginPath();
  ctx.arc(-1.5, -1, 1, 0, Math.PI * 2);
  ctx.arc(1.5, -1, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFoodItem(ctx: CanvasRenderingContext2D, item: FoodItem) {
  const floatY = Math.sin(item.floatTimer) * 3;
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2 + floatY;

  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
  grd.addColorStop(0, "rgba(200,220,100,0.3)");
  grd.addColorStop(1, "rgba(200,220,100,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c8dc50";
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0f060";
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKarmaSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  karma: number,
) {
  const r = 11;
  ctx.strokeStyle = "rgba(160,160,200,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < karma; i++) {
    const angle = (i / Math.max(karma, 1)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * r * 0.55;
    const py = y + Math.sin(angle) * r * 0.55;
    ctx.fillStyle = `rgba(160,160,220,${0.5 + i * 0.08})`;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(200,200,240,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  w: number,
  h: number,
) {
  const p = gs.player;
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.textBaseline = "middle";

  drawKarmaSymbol(ctx, 28, 28, p.karma);
  ctx.fillStyle = "rgba(140,140,180,0.7)";
  ctx.fillText("KARMA", 46, 28);

  const pipY = 58;
  for (let i = 0; i < 4; i++) {
    const px = 22 + i * 22;
    ctx.strokeStyle = "rgba(160,140,100,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, pipY, 7, 0, Math.PI * 2);
    ctx.stroke();
    if (i < p.hunger) {
      ctx.fillStyle = "#c8b860";
      ctx.beginPath();
      ctx.arc(px, pipY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(140,120,80,0.6)";
  ctx.fillText("FOOD", 112, pipY);

  // Held spear indicator
  if (p.heldSpear) {
    ctx.save();
    ctx.translate(170, pipY);
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(-10, -1.5, 18, 3);
    ctx.fillStyle = "#aaaacc";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(11, -2.5);
    ctx.lineTo(13, 0);
    ctx.lineTo(11, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(180,160,100,0.8)";
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";
    ctx.fillText("SPEAR", 16, 0);
    ctx.restore();
  }

  // Starving warning
  if (p.starving) {
    ctx.save();
    const pulse = 0.6 + Math.sin(gs.frame * 0.15) * 0.4;
    ctx.fillStyle = `rgba(255,60,60,${pulse})`;
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";
    ctx.fillText("⚠ STARVING", 22, 80);
    ctx.restore();
  }

  const secs = gs.rainTimer / 1000;
  const mins = Math.floor(secs / 60);
  const sec = Math.floor(secs % 60);
  const timerText = `${mins}:${sec.toString().padStart(2, "0")}`;
  const timerColor = gs.rainActive
    ? `rgba(255,${Math.floor(60 + Math.sin(gs.frame * 0.1) * 40)},60,0.9)`
    : secs < 30
      ? "rgba(220,100,80,0.85)"
      : "rgba(140,160,200,0.75)";

  ctx.fillStyle = timerColor;
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(`☁ ${timerText}`, w - 16, 28);
  ctx.textAlign = "left";

  if (gs.rainActive && gs.rainExposure > 0) {
    const pct = gs.rainExposure / RAIN_KILL_TIME;
    ctx.fillStyle = `rgba(255,60,60,${0.3 + pct * 0.5})`;
    ctx.fillRect(0, h - 6, w * pct, 6);
    ctx.fillStyle = "rgba(255,80,80,0.8)";
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("SEEK SHELTER", w / 2, h - 20);
    ctx.textAlign = "left";
  }

  if (inShelterZone(p, gs.rooms[gs.currentRoom])) {
    ctx.fillStyle = "rgba(60,180,80,0.7)";
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("SHELTER  ↓ to sleep", w / 2, h - 20);
    ctx.textAlign = "left";
  }

  if (gs.phase === "sleeping") {
    const alpha = Math.min(
      1,
      (SLEEP_DURATION - gs.sleepTimer) / SLEEP_DURATION + 0.3,
    );
    ctx.fillStyle = `rgba(5,10,5,${alpha * 0.9})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(80,180,80,0.85)";
    ctx.font = '24px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    const zzz = "".padStart(Math.floor(gs.frame / 20) % 4, "z").toUpperCase();
    ctx.fillText(`sleeping${zzz}`, w / 2, h / 2);
    if (gs.starvationPenalty) {
      ctx.fillStyle = "rgba(255,80,60,0.8)";
      ctx.font = '16px "JetBrains Mono", monospace';
      ctx.fillText("insufficient food — karma will drop", w / 2, h / 2 + 36);
    }
    ctx.textAlign = "left";
  }

  if (!p.hasGrabbed) {
    ctx.fillStyle = "rgba(140,140,180,0.5)";
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("[ Z / X ] GRAB · THROW   [ ↑/SPACE ] JUMP", w / 2, h - 36);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(120,120,160,0.5)";
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText(gs.rooms[gs.currentRoom].name.toUpperCase(), w / 2, 16);
  ctx.textAlign = "left";
}

function render(canvas: HTMLCanvasElement, gs: GameState) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { canvasW: W, canvasH: H } = gs;
  const camX = Math.round(gs.camera.x);
  const camY = Math.round(gs.camera.y);
  const room = gs.rooms[gs.currentRoom];

  const bgGrd = ctx.createLinearGradient(0, 0, 0, H);
  bgGrd.addColorStop(0, "#06060d");
  bgGrd.addColorStop(1, "#0c0c18");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(150,150,200,0.15)";
  for (let i = 0; i < 40; i++) {
    const starX = (((i * 137 + camX * 0.05) % W) + W) % W;
    const starY = (((i * 97 + camY * 0.05) % H) + H) % H;
    ctx.fillRect(starX, starY, 1, 1);
  }

  const startCol = Math.max(0, Math.floor(camX / TS) - 1);
  const endCol = Math.min(room.cols, Math.ceil((camX + W) / TS) + 1);
  const startRow = Math.max(0, Math.floor(camY / TS) - 1);
  const endRow = Math.min(room.rows, Math.ceil((camY + H) / TS) + 1);

  for (let r = startRow; r < endRow; r++)
    for (let c = startCol; c < endCol; c++) {
      const t = getTile(room, c, r);
      if (t !== 0) drawTile(ctx, t, c * TS - camX, r * TS - camY);
    }

  for (const item of gs.items)
    drawFoodItem(ctx, { ...item, x: item.x - camX, y: item.y - camY });

  // Draw spears (world)
  for (const spear of gs.spears) {
    drawSpear(ctx, spear, camX, camY);
  }

  for (const e of gs.enemies) {
    if (e.type === "lizard")
      drawLizard(ctx, { ...e, x: e.x - camX, y: e.y - camY });
    else drawBatfly(ctx, { ...e, x: e.x - camX, y: e.y - camY });
  }

  // Procedural slugcat (camera offset passed directly)
  drawPlayer(ctx, gs.player, camX, camY, gs.frame, gs.customSprite);

  for (const part of gs.particles) {
    const psx = part.x - camX;
    const psy = part.y - camY;
    if (part.type === "rain") {
      ctx.strokeStyle = `rgba(180,200,255,${part.life * 0.55})`;
      ctx.lineWidth = part.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.lineTo(psx + part.vx * 3, psy + part.vy * 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(200,190,170,${part.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(psx, psy, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (gs.rainActive) {
    const intensity = Math.min(gs.rainExposure / RAIN_KILL_TIME, 1);
    ctx.fillStyle = `rgba(10,20,60,${0.25 + intensity * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }

  for (let scanY = 0; scanY < H; scanY += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(0, scanY, W, 2);
  }

  drawHUD(ctx, gs, W, H);
}

// ─── React Component ──────────────────────────────────────────────────────────
interface GameProps {
  rooms: Room[];
  initialRoom: number;
  onDeath: () => void;
  onWin: () => void;
  onMenu: () => void;
}

export function Game({
  rooms,
  initialRoom,
  onDeath,
  onWin,
  onMenu,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const onDeathRef = useRef(onDeath);
  const onWinRef = useRef(onWin);
  const customSpriteRef = useRef<HTMLImageElement | null>(null);

  // Dev console state
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [consoleHistory, setConsoleHistory] = useState<string[]>([
    "Dev Console ready. Type 'help' for commands.",
  ]);
  const devConsoleOpenRef = useRef(false);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onDeathRef.current = onDeath;
  }, [onDeath]);
  useEffect(() => {
    onWinRef.current = onWin;
  }, [onWin]);

  // Load custom sprite from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("customSlugcatSprite");
    if (saved) {
      const img = new Image();
      img.onload = () => {
        customSpriteRef.current = img;
        if (gsRef.current) gsRef.current.customSprite = img;
      };
      img.src = saved;
    }
  }, []);

  // Backtick toggle for dev console (separate effect, not inside game loop)
  useEffect(() => {
    function handleBacktick(e: KeyboardEvent) {
      if (e.code === "Backquote") {
        e.preventDefault();
        const next = !devConsoleOpenRef.current;
        devConsoleOpenRef.current = next;
        setDevConsoleOpen(next);
        if (next) {
          setTimeout(() => consoleInputRef.current?.focus(), 50);
        }
      }
    }
    window.addEventListener("keydown", handleBacktick);
    return () => window.removeEventListener("keydown", handleBacktick);
  }, []);

  function executeConsoleCommand(cmd: string): string {
    const gs = gsRef.current;
    if (!gs) return "Game not initialized.";
    const parts = cmd.trim().toLowerCase().split(/\s+/);
    const verb = parts[0];
    if (verb === "help") {
      return [
        "Commands:",
        "  spawn lizard  — spawn a lizard at player pos",
        "  spawn batfly  — spawn a batfly near player",
        "  kill all      — remove all enemies",
        "  food <0-4>    — set food pips",
        "  karma <1-5>   — set karma level",
      ].join("\n");
    }
    if (verb === "spawn") {
      const type = parts[1];
      const px = gs.player.x;
      const py = gs.player.y;
      if (type === "lizard") {
        const x = px + 40;
        const y = py;
        gs.enemies.push({
          id: gs.nextId++,
          type: "lizard",
          x,
          y,
          vx: 0,
          vy: 0,
          w: 28,
          h: 18,
          onGround: false,
          facing: 1,
          state: "patrol",
          patrolA: Math.max(0, Math.floor(x / 32) - 6),
          patrolB: Math.floor(x / 32) + 6,
          wanderTimer: 0,
          animTimer: 0,
        });
        return "Spawned lizard at player position.";
      }
      if (type === "batfly") {
        gs.enemies.push({
          id: gs.nextId++,
          type: "batfly",
          x: px + 20,
          y: py - 30,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1,
          w: 10,
          h: 10,
          onGround: false,
          facing: 1,
          state: "wander",
          patrolA: 0,
          patrolB: 0,
          wanderTimer: 60,
          animTimer: 0,
        });
        return "Spawned batfly near player.";
      }
      return `Unknown entity: ${type}`;
    }
    if (verb === "kill" && parts[1] === "all") {
      gs.enemies = [];
      return "All enemies killed.";
    }
    if (verb === "food") {
      const n = Number.parseInt(parts[1]);
      if (Number.isNaN(n) || n < 0 || n > 4) return "Usage: food <0-4>";
      gs.player.hunger = n;
      return `Food set to ${n}.`;
    }
    if (verb === "karma") {
      const n = Number.parseInt(parts[1]);
      if (Number.isNaN(n) || n < 1 || n > 5) return "Usage: karma <1-5>";
      gs.player.karma = n;
      return `Karma set to ${n}.`;
    }
    return "Unknown command. Type 'help' for list.";
  }

  function handleConsoleSubmit() {
    const input = consoleInputRef.current;
    if (!input) return;
    const cmd = input.value.trim();
    if (!cmd) return;
    const result = executeConsoleCommand(cmd);
    setConsoleHistory((prev) => [...prev, `> ${cmd}`, result]);
    input.value = "";
    setTimeout(
      () => historyEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      10,
    );
  }

  const handleMenu = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    onMenu();
  }, [onMenu]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gsRef.current = initGameState(rooms, initialRoom);

    function resize() {
      if (!canvas || !gsRef.current) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gsRef.current.canvasW = window.innerWidth;
      gsRef.current.canvasH = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const keysRef: Set<string> = new Set();
    function onKeyDown(e: KeyboardEvent) {
      // Block game input when console is open
      if (devConsoleOpenRef.current) return;
      keysRef.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Escape") handleMenu();
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.delete(e.code);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.focus();

    function loop(timestamp: number) {
      const gs = gsRef.current;
      if (!gs) return;
      gs.keys = keysRef;
      // Sync custom sprite to game state
      gs.customSprite = customSpriteRef.current;
      const rawDt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      accRef.current += Math.min(rawDt, 100);
      while (accRef.current >= FIXED_DT) {
        update(gs);
        accRef.current -= FIXED_DT;
      }
      render(canvas!, gs);
      if (gs.phase === "dead") {
        onDeathRef.current();
        return;
      }
      if (gs.phase === "won") {
        onWinRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [rooms, initialRoom, handleMenu]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        data-ocid="game.canvas_target"
        className="block"
        tabIndex={0}
        style={{ outline: "none" }}
      />
      <button
        type="button"
        onClick={handleMenu}
        className="absolute top-3 right-3 text-xs font-mono text-gray-600 hover:text-gray-300 transition-colors px-2 py-1 border border-gray-800 hover:border-gray-600 rounded"
      >
        [ESC] MENU
      </button>

      {/* Dev Console */}
      {devConsoleOpen && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[200px] bg-black/85 border-t border-green-900/50 flex flex-col font-mono text-xs text-green-400"
          data-ocid="dev_console.panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-green-900/40 bg-black/60">
            <span className="text-green-500 tracking-widest">
              ▶ DEV CONSOLE
            </span>
            <span className="text-green-900">[ ` ] to toggle</span>
            <button
              type="button"
              data-ocid="dev_console.close_button"
              onClick={() => {
                devConsoleOpenRef.current = false;
                setDevConsoleOpen(false);
              }}
              className="text-green-800 hover:text-green-400 transition-colors ml-4"
            >
              [X]
            </button>
          </div>
          {/* History */}
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
            {consoleHistory.map((line, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
                key={`console-line-${i}`}
                className={
                  line.startsWith(">") ? "text-green-300" : "text-green-600"
                }
                style={{ whiteSpace: "pre-wrap" }}
              >
                {line}
              </div>
            ))}
            <div ref={historyEndRef} />
          </div>
          {/* Input */}
          <div className="flex items-center px-3 py-1 border-t border-green-900/40">
            <span className="text-green-700 mr-2">$</span>
            <input
              ref={consoleInputRef}
              data-ocid="dev_console.input"
              type="text"
              className="flex-1 bg-transparent outline-none text-green-400 placeholder-green-900"
              placeholder="type a command..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConsoleSubmit();
                e.stopPropagation();
              }}
            />
            <button
              type="button"
              data-ocid="dev_console.submit_button"
              onClick={handleConsoleSubmit}
              className="ml-2 text-green-700 hover:text-green-400 transition-colors"
            >
              [ENTER]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
