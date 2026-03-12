import { useCallback, useEffect, useRef } from "react";
import type {
  Enemy,
  FoodItem,
  GameState,
  Particle,
  Player,
  Room,
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
      const tile = getTile(room, c, bc);
      if (isSolid(tile) || tile === 2) {
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
  // Suppress unused prevY warning
  void prevY;
  return grounded;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function createPlayer(room: Room): Player {
  return {
    x: room.spawnX * TS,
    y: room.spawnY * TS,
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
): { items: FoodItem[]; nextId: number } {
  let nextId = startId;
  const items: FoodItem[] = [];
  for (const def of room.items) {
    items.push({
      id: nextId++,
      x: def.x * TS + 8,
      y: def.y * TS - 10,
      w: 14,
      h: 14,
      collected: false,
      floatTimer: Math.random() * Math.PI * 2,
    });
  }
  return { items, nextId };
}

export function initGameState(rooms: Room[], initialRoom: number): GameState {
  const room = rooms[initialRoom];
  const player = createPlayer(room);
  const { enemies, nextId: nid1 } = spawnEnemies(room, 1);
  const { items, nextId: nid2 } = spawnItems(room, nid1);
  return {
    player,
    enemies,
    items,
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
  };
}

function transitionRoom(gs: GameState, targetRoom: number) {
  gs.currentRoom = targetRoom;
  const room = gs.rooms[targetRoom];
  gs.player = createPlayer(room);
  const { enemies, nextId: nid1 } = spawnEnemies(room, gs.nextId);
  gs.enemies = enemies;
  gs.nextId = nid1;
  const { items, nextId: nid2 } = spawnItems(room, gs.nextId);
  gs.items = items;
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

  // Grab nearby entities
  if (grabPressed && p.grabCooldown <= 0) {
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
  gs.items = gs.items.filter((i) => !i.collected);

  // Crouch / drop-through
  p.crouching = down && p.onGround;
  if (down && p.onGround) p.dropThrough = 15;

  // Pole check
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
      else p.vy *= 0.7;
      if (jumpPressed) {
        p.onPole = false;
        p.vy = JUMP_FORCE;
        p.vx = left ? -PLAYER_SPEED : PLAYER_SPEED;
        p.jumpsLeft = 1;
      }
      p.y += p.vy;
      p.y = Math.max(0, Math.min(p.y, room.rows * TS - p.h));
      p.onGround = false;
      p.state = "climb";
      // Spawn dust
      if (Math.abs(p.vy) > 0.5 && gs.frame % 8 === 0)
        spawnDust(gs, p.x + p.w / 2, p.y + p.h);
      return;
    }
  }

  // Horizontal movement
  if (left && !p.crouching) {
    p.vx = -PLAYER_SPEED;
    p.facing = -1;
  } else if (right && !p.crouching) {
    p.vx = PLAYER_SPEED;
    p.facing = 1;
  } else {
    p.vx *= p.onGround ? FRIC_GROUND : FRIC_AIR;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
  }

  // Wall slide
  const slidingLeft = p.wallLeft && left && !p.onGround;
  const slidingRight = p.wallRight && right && !p.onGround;
  p.wallSliding = slidingLeft || slidingRight;
  if (p.wallSliding && p.vy > WALL_SLIDE_MAX) p.vy = WALL_SLIDE_MAX;

  // Jump
  if (jumpPressed) {
    if (p.onGround) {
      p.vy = JUMP_FORCE;
      p.jumpsLeft = 1;
      spawnDust(gs, p.x + p.w / 2, p.y + p.h);
    } else if (p.wallSliding) {
      p.vy = JUMP_FORCE;
      p.vx = p.wallLeft ? PLAYER_SPEED * 1.5 : -PLAYER_SPEED * 1.5;
      p.jumpsLeft = 1;
      p.wallSliding = false;
    } else if (p.jumpsLeft > 0) {
      p.vy = JUMP_FORCE * 0.85;
      p.jumpsLeft--;
    }
  }

  // Gravity
  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // Resolve collisions
  const prevY = p.y;
  resolvePlayerX(p, room);
  p.onGround = resolvePlayerY(p, room, prevY);
  detectWalls(p, room);

  if (p.onGround) p.jumpsLeft = 1;

  // Footstep dust
  if (p.onGround && Math.abs(p.vx) > 2 && gs.frame % 6 === 0)
    spawnDust(gs, p.x + p.w / 2, p.y + p.h);

  // Clamp
  p.x = Math.max(-p.w, Math.min(p.x, room.cols * TS));
  p.y = Math.max(0, Math.min(p.y, room.rows * TS - p.h));

  // State
  if (p.onGround) {
    if (Math.abs(p.vx) > 0.5) p.state = "run";
    else if (p.crouching) p.state = "crouch";
    else p.state = "idle";
  } else if (p.wallSliding) {
    p.state = "wallSlide";
  } else if (p.vy < 0) {
    p.state = "jump";
  } else {
    p.state = "fall";
  }

  p.animTimer++;
  if (p.dropThrough > 0) p.dropThrough--;
  if (p.grabCooldown > 0) p.grabCooldown--;
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

      // Turn around on wall hit
      if (e.vx === 0 && e.state === "patrol") {
        const tmp = e.patrolA;
        e.patrolA = e.patrolB;
        e.patrolB = tmp;
        e.facing *= -1;
      }

      // Kill player on contact
      if (overlaps(p, e) && gs.phase === "playing") {
        gs.phase = "dead";
      }
    } else {
      // Batfly
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
        // Gentle sine bob
        e.vy += Math.sin(gs.frame * 0.05 + e.id) * 0.05;
      }

      e.x += e.vx;
      e.y += e.vy;
      e.vx *= 0.94;
      e.vy *= 0.94;

      // Soft bounds
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
  for (let i = 0; i < 3; i++) {
    gs.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 1.5,
      life: 0.8 + Math.random() * 0.4,
      type: "dust",
      size: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(gs: GameState) {
  // Spawn rain
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

  // Sleep phase
  if (gs.phase === "sleeping") {
    gs.sleepTimer -= FIXED_DT;
    if (gs.sleepTimer <= 0) {
      if (room.nextRoom === -1) {
        gs.phase = "won";
        return;
      }
      // Reset cycle
      gs.rainTimer = RAIN_DURATION;
      gs.rainActive = false;
      gs.rainExposure = 0;
      const { enemies, nextId: nid1 } = spawnEnemies(room, gs.nextId);
      gs.enemies = enemies;
      gs.nextId = nid1;
      const { items, nextId: nid2 } = spawnItems(room, gs.nextId);
      gs.items = items;
      gs.nextId = nid2;
      gs.phase = "playing";
    }
    updateParticles(gs);
    updateCamera(gs);
    return;
  }

  // Rain timer
  gs.rainTimer = Math.max(0, gs.rainTimer - FIXED_DT);
  if (gs.rainTimer === 0) gs.rainActive = true;

  // Rain exposure
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

  // Player
  updatePlayer(gs);
  if ((gs.phase as string) === "dead") return;

  // Spikes
  checkSpikes(gs);
  if ((gs.phase as string) === "dead") return;

  // Enemies
  updateEnemies(gs);
  if ((gs.phase as string) === "dead") return;

  // Sleep in shelter
  const pressingDown = gs.keys.has("ArrowDown") || gs.keys.has("KeyS");
  if (inShelterZone(gs.player, room) && gs.player.onGround && pressingDown) {
    gs.phase = "sleeping";
    gs.sleepTimer = SLEEP_DURATION;
  }

  // Win condition (last room + shelter area)
  if (
    room.nextRoom === -1 &&
    gs.player.y < 4 * TS &&
    inShelterZone(gs.player, room)
  ) {
    gs.phase = "won";
    return;
  }

  // Room transition
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

  // Items float
  for (const item of gs.items) {
    item.floatTimer += 0.06;
  }

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
    // Spikes
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
    // Shelter
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = "#152515";
    ctx.fillRect(sx + 2, sy + 2, TS - 4, TS - 4);
    ctx.fillStyle = "#1f3d1f";
    ctx.fillRect(sx, sy, TS, 1);
    ctx.fillRect(sx, sy, 1, TS);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, frame: number) {
  const { x, y, w, h, facing, state, onPole } = p;
  const bob = state === "idle" ? Math.sin(frame * 0.06) * 1 : 0;
  const squishY = state === "jump" ? 0.85 : state === "fall" ? 1.1 : 1;
  const squishX = state === "jump" ? 1.1 : state === "fall" ? 0.9 : 1;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + bob);
  ctx.scale(facing * squishX, squishY);

  // Body shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(2, 3, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body
  const bodyColor = state === "idle" ? "#f0ead6" : "#e8e0cc";
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [6]);
  ctx.fill();

  // Ear nubs
  if (!onPole) {
    ctx.fillStyle = "#d8d0bc";
    ctx.beginPath();
    ctx.ellipse(-w / 2 + 4, -h / 2 + 2, 3, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2 - 4, -h / 2 + 2, 3, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye
  const eyeOX = w / 2 - 5;
  const eyeOY = -h / 2 + 6;
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(eyeOX, eyeOY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(eyeOX + 1, eyeOY - 1, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.strokeStyle = "#d8d0bc";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, h / 4);
  ctx.bezierCurveTo(
    -w / 2 - 6,
    h / 4 + 4,
    -w / 2 - 10,
    h / 2,
    -w / 2 - 8,
    h / 2 + 4,
  );
  ctx.stroke();

  ctx.restore();
}

function drawLizard(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y, w, h, facing, animTimer, state } = e;
  const walkBob = e.onGround ? Math.sin(animTimer * 0.18) * 1.5 : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + walkBob);
  ctx.scale(facing, 1);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 3, w / 2, h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyG = state === "chase" ? "#5aba5a" : "#4a9a4a";
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Underbelly
  ctx.fillStyle = "#6aaa6a";
  ctx.beginPath();
  ctx.ellipse(2, 2, w / 2 - 6, h / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  const headX = w / 2 - 2;
  ctx.fillStyle = bodyG;
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

  // Tail
  ctx.strokeStyle = "#3a7a3a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w / 2, 2);
  ctx.bezierCurveTo(-w / 2 - 8, 4, -w / 2 - 14, 0, -w / 2 - 18, -4);
  ctx.stroke();

  // Legs (walking animation)
  ctx.strokeStyle = "#3a7a3a";
  ctx.lineWidth = 2;
  const legAnim = Math.sin(animTimer * 0.2) * 4;
  ctx.beginPath();
  ctx.moveTo(-4, h / 2 - 2);
  ctx.lineTo(-4 + legAnim, h / 2 + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, h / 2 - 2);
  ctx.lineTo(4 - legAnim, h / 2 + 5);
  ctx.stroke();

  ctx.restore();
}

function drawBatfly(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y, animTimer } = e;
  const flapAngle = Math.sin(animTimer * 0.35) * 0.5;

  ctx.save();
  ctx.translate(x + 5, y + 5);

  // Wings
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

  // Body
  ctx.fillStyle = "#303050";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
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

  // Glow
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
  grd.addColorStop(0, "rgba(200,220,100,0.3)");
  grd.addColorStop(1, "rgba(200,220,100,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  // Fruit body
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

  // Petals
  for (let i = 0; i < karma; i++) {
    const angle = (i / Math.max(karma, 1)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * r * 0.55;
    const py = y + Math.sin(angle) * r * 0.55;
    ctx.fillStyle = `rgba(160,160,220,${0.5 + i * 0.08})`;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center dot
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

  // ── Karma symbol (top-left)
  drawKarmaSymbol(ctx, 28, 28, p.karma);
  ctx.fillStyle = "rgba(140,140,180,0.7)";
  ctx.fillText("KARMA", 46, 28);

  // ── Hunger pips
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

  // ── Rain timer (top-right)
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

  // ── Rain exposure warning
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

  // ── Shelter safe indicator
  if (inShelterZone(p, gs.rooms[gs.currentRoom])) {
    ctx.fillStyle = "rgba(60,180,80,0.7)";
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("SHELTER  ↓ to sleep", w / 2, h - 20);
    ctx.textAlign = "left";
  }

  // ── Sleep animation
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
    ctx.textAlign = "left";
  }

  // ── Grab hint
  if (!p.hasGrabbed) {
    ctx.fillStyle = "rgba(140,140,180,0.5)";
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("[ Z / X ] GRAB   [ ↑/SPACE ] JUMP", w / 2, h - 36);
    ctx.textAlign = "left";
  }

  // ── Room name (top-center)
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

  // ── Background gradient
  const bgGrd = ctx.createLinearGradient(0, 0, 0, H);
  bgGrd.addColorStop(0, "#06060d");
  bgGrd.addColorStop(1, "#0c0c18");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, W, H);

  // ── Background stars/dust
  ctx.fillStyle = "rgba(150,150,200,0.15)";
  for (let i = 0; i < 40; i++) {
    const sx = (((i * 137 + camX * 0.05) % W) + W) % W;
    const sy = (((i * 97 + camY * 0.05) % H) + H) % H;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // ── Tiles
  const startCol = Math.max(0, Math.floor(camX / TS) - 1);
  const endCol = Math.min(room.cols, Math.ceil((camX + W) / TS) + 1);
  const startRow = Math.max(0, Math.floor(camY / TS) - 1);
  const endRow = Math.min(room.rows, Math.ceil((camY + H) / TS) + 1);

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const t = getTile(room, c, r);
      if (t !== 0) drawTile(ctx, t, c * TS - camX, r * TS - camY);
    }
  }

  // ── Food items
  for (const item of gs.items) {
    drawFoodItem(ctx, { ...item, x: item.x - camX, y: item.y - camY });
  }

  // ── Enemies
  for (const e of gs.enemies) {
    if (e.type === "lizard") {
      drawLizard(ctx, { ...e, x: e.x - camX, y: e.y - camY });
    } else {
      drawBatfly(ctx, { ...e, x: e.x - camX, y: e.y - camY });
    }
  }

  // ── Player
  drawPlayer(
    ctx,
    { ...gs.player, x: gs.player.x - camX, y: gs.player.y - camY },
    gs.frame,
  );

  // ── Particles
  for (const p of gs.particles) {
    const sx = p.x - camX;
    const sy = p.y - camY;
    if (p.type === "rain") {
      ctx.strokeStyle = `rgba(180,200,255,${p.life * 0.55})`;
      ctx.lineWidth = p.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + p.vx * 3, sy + p.vy * 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(200,190,170,${p.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Rain overlay
  if (gs.rainActive) {
    const intensity = Math.min(gs.rainExposure / RAIN_KILL_TIME, 1);
    ctx.fillStyle = `rgba(10,20,60,${0.25 + intensity * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Scanlines
  for (let sy = 0; sy < H; sy += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(0, sy, W, 2);
  }

  // ── HUD
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

  useEffect(() => {
    onDeathRef.current = onDeath;
  }, [onDeath]);
  useEffect(() => {
    onWinRef.current = onWin;
  }, [onWin]);

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
    </div>
  );
}
