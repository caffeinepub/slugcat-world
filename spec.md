# Slugcat World

## Current State
A Rain World-inspired 2D platformer with:
- Slugcat player with spring-physics body chunks (3 segments) and a 6-node tapered tail with ground/air tail physics
- Procedural head/body animation with facing-aware eyes and ear nubs
- Batfly food enemies (flee behavior) and green lizard enemies (patrol/chase)
- Food pip system (4 pips), karma system, shelter sleep mechanic
- Rain timer with kill zone, spike tiles, wall sliding, pole climbing
- 3 rooms with mod manager for custom levels

## Requested Changes (Diff)

### Add
- **Limb nodes**: 4 procedural leg nodes (front pair attached to upper body, back pair to hips). Each limb is a 2-node chain (thigh + foot). When grounded, feet use a stepped IK target that snaps to nearby ground level. When in air, legs dangle via spring physics. Drawn as thin limbs with slight knee bend.
- **Spears**: Throwable weapon items. Spawned in levels. Player picks up with Z/X when near. Player carries one spear at a time; a small visual indicator shows the held spear. Press Z/X again to throw in facing direction with velocity. Thrown spear has angular rotation, physics (gravity), and sticks into walls/floors on contact. A thrown spear that hits a lizard kills it (remove lizard, remove spear).
- **Starvation mechanic**: On sleeping, check if `player.hunger < 2` (starving threshold). If so, record `starvationPenalty = true` on GameState. On wakeup, if starvationPenalty is set, decrement karma by 1 (min 1) and display a brief "STARVING" warning on the HUD. Clear the flag after applying.
- More lizards in rooms 1 and 2, and spear spawn positions in all 3 rooms.

### Modify
- `GameTypes.ts`: Add `limbNodes: BodyChunk[]` (4 nodes) to `Player`. Add `heldSpear: boolean` and `starving: boolean`. Add `Spear` interface. Add `spears: Spear[]` and `starvationPenalty: boolean` to `GameState`. Add `'spear'` to `ItemDef` type.
- `Game.tsx`: Integrate limb IK into `updateBodyChunks`, spear pickup/throw logic in `updatePlayer`, lizard kill in spear collision, starvation check in the sleeping->wakeup transition. Draw limbs in `drawPlayer` (back limbs before body, front limbs after body). Draw spears in render loop.
- `levels.ts`: Add spear ItemDefs to all 3 rooms.

### Remove
- Nothing removed.

## Implementation Plan
1. Update `GameTypes.ts`: add LimbNode fields to Player, Spear interface, GameState spears/starvationPenalty fields, ItemDef spear type.
2. Update `Game.tsx`:
   a. `createPlayer`: initialize 4 limbNodes as BodyChunks, heldSpear=false, starving=false.
   b. `updateBodyChunks`: compute step targets per limb based on grounded state; spring limb nodes toward targets when grounded, dangle when airborne.
   c. `spawnItems`: handle 'spear' ItemDef → push to gs.spears.
   d. `initGameState`: add `spears: []`, `starvationPenalty: false`.
   e. `updatePlayer`: Z/X pressed near spear → pickup; Z/X pressed with heldSpear → throw; on wakeup transition apply starvation penalty.
   f. `updateSpears`: physics, wall collision (stick), lizard collision (kill lizard + remove spear).
   g. `update()`: call `updateSpears`; check starvation on sleeping->playing transition.
   h. `drawPlayer`: render back limbs (behind body), front limbs (in front of body).
   i. `drawSpear`: render as a thin elongated rod with rotation.
   j. `render()`: draw spears.
   k. `drawHUD`: show starvation warning if starving flag set briefly; show spear carry indicator.
3. Update `levels.ts`: add spear items and extra lizards to rooms.
