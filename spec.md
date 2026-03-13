# Slugcat World

## Current State
Full-stack Rain World-inspired game with procedural slugcat animation (3-body chunks, 6-tail nodes, 4 limb nodes), lizard and batfly enemies, spears, starvation/karma mechanics, and mod manager. Slugcat is drawn procedurally on canvas with ear nubs, one eye, body segments, and tail. MainMenu has animated rain background, Start, Mod Manager, and custom level buttons.

## Requested Changes (Diff)

### Add
- **Developer console overlay** (toggle with backtick `` ` `` key while in-game): semi-transparent panel at the bottom of the screen showing a command history log and a text input. Supported commands: `spawn lizard` (spawns a lizard near the player), `spawn batfly`, `kill all` (removes all enemies), `food <n>` (set food pips 0-4), `karma <n>` (set karma 1-5), `help` (list commands). When console is open, keyboard input goes to the console only (not the game). Press Escape or backtick again to close.
- **Custom slugcat sprite upload** on the MainMenu: a small "CUSTOMIZE" button or section that lets players upload a PNG/JPG image file. The image is stored in localStorage as a data URL. A thumbnail preview is shown. On game start, if a custom sprite is set, draw it as a texture overlay clipped to the slugcat's head circle. Add a "clear" button to remove the custom sprite.
- **Slugcat face and ears**: replace current ear ellipses with proper triangular pointed cat ears (filled triangles, slightly angled outward, with an inner ear accent color). Add a second eye (both eyes should be on the forward-facing side of the head, slightly apart). Add a small nose dot below the eyes.

### Modify
- `Game.tsx`: add dev console state (open ref + React state for rendering), separate keydown listener for backtick outside game loop, command processor function, pass custom sprite image ref to `drawPlayer`, update `drawPlayer` to accept optional sprite image and render it clipped to head. Block game inputs when console is open.
- `MainMenu.tsx`: add customize section with file input, preview image, and clear button.

### Remove
- Nothing removed.

## Implementation Plan
1. Update `drawPlayer` in Game.tsx: replace ear ellipses with triangular pointed ears + inner ear fill, add second eye, add nose dot.
2. Add custom sprite support: load from localStorage as HTMLImageElement in Game component (useEffect), pass as optional prop to drawPlayer, clip-draw at head position when available.
3. Add dev console React component inside Game.tsx return JSX: bottom overlay, command history list, text input.
4. Add backtick keydown listener in Game component (separate useEffect) to toggle console open state.
5. In the game loop's keydown handler, block game keys when console is open.
6. Write command executor function that operates on gsRef.current (spawn enemies, adjust stats, etc.).
7. Update MainMenu.tsx: add file input (hidden), trigger via button, read as dataURL, save to localStorage, show thumbnail, add clear button.
