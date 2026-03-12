# Slugcat World - Rain World-inspired Browser Game

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- 2D platformer game inspired by Rain World with physics-based movement
- Slugcat player character with momentum, gravity, wall-sliding, and climbing
- Tile-based level system with multiple rooms/screens
- Enemy AI creatures (lizards, batflies) with simple patrol/chase behavior
- Rain cycle mechanic (timer triggers rain, player must find shelter)
- Mod system: users can upload JSON mod files to add custom levels, creatures, and items
- Mod manager UI panel showing installed mods, enable/disable, load from file
- Backend storage for mods (save/load mod definitions)
- Atmospheric dark visual style with rain particles
- HUD showing hunger, rain timer, karma level

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Backend: Motoko canister stores mod definitions (name, description, JSON content)
2. Frontend Game Engine:
   - Canvas-based renderer with tile map
   - Physics: gravity, velocity, friction, collision detection against tiles
   - Player: run, jump, crouch, grab/climb poles, slide walls
   - Enemy AI: patrol waypoints, detect player, chase/flee states
   - Rain cycle timer with particle system
   - Karma/hunger HUD
3. Level system: default 3 rooms, rooms loaded from tile arrays
4. Mod system:
   - Mod file format: JSON with `levels`, `creatures`, `items` arrays
   - Upload button to load .json mod files from disk
   - Mod manager panel listing active mods
   - Mods saved to backend canister
   - Game merges mod data into base game data at runtime
5. Screens: Main Menu, Game (Canvas), Mod Manager, Game Over / Win
