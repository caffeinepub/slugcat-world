import { useEffect, useRef, useState } from "react";
import type { Room } from "./GameTypes";
import { useModRooms } from "./hooks/useQueries";

interface MainMenuProps {
  onStart: () => void;
  onMods: () => void;
  onStartCustom: (roomIndex: number) => void;
  defaultRooms: Room[];
}

export function MainMenu({
  onStart,
  onMods,
  onStartCustom,
  defaultRooms,
}: MainMenuProps) {
  const customRooms = useModRooms();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customSprite, setCustomSprite] = useState<string | null>(() =>
    localStorage.getItem("customSlugcatSprite"),
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem("customSlugcatSprite", dataUrl);
      setCustomSprite(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function clearSprite() {
    localStorage.removeItem("customSlugcatSprite");
    setCustomSprite(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Animated background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const particles: Array<{
      x: number;
      y: number;
      vy: number;
      size: number;
      alpha: number;
    }> = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 1.5 + Math.random() * 3,
        size: 0.5 + Math.random(),
        alpha: 0.1 + Math.random() * 0.4,
      });
    }

    function loop() {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      frameRef.current++;
      const f = frameRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // Background
      ctx.fillStyle = "#06060d";
      ctx.fillRect(0, 0, W, H);

      // Distant fog
      const fogGrd = ctx.createRadialGradient(
        W / 2,
        H * 0.6,
        0,
        W / 2,
        H * 0.6,
        W * 0.6,
      );
      fogGrd.addColorStop(0, "rgba(30,20,60,0.25)");
      fogGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fogGrd;
      ctx.fillRect(0, 0, W, H);

      // Rain particles
      ctx.strokeStyle = "rgba(180,200,255,0.25)";
      ctx.lineWidth = 0.8;
      for (const p of particles) {
        p.y += p.vy;
        if (p.y > H + 10) {
          p.y = -10;
          p.x = Math.random() * W;
        }
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1, p.y + p.vy * 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Ground silhouette
      ctx.fillStyle = "#0a0a15";
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) {
        const gy =
          H * 0.72 +
          Math.sin((x + f * 0.3) * 0.015) * 20 +
          Math.sin((x + f * 0.15) * 0.03) * 10;
        ctx.lineTo(x, gy);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Scanlines
      for (let sy = 0; sy < H; sy += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(0, sy, W, 2);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden grain">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
        {/* Title */}
        <div className="mb-12 text-center">
          <div className="text-xs tracking-[0.5em] text-gray-600 mb-3 font-mono">
            A CAFFEINE GAME
          </div>
          <h1
            className="font-display font-bold text-gray-100"
            style={{
              fontSize: "clamp(3rem, 8vw, 6rem)",
              textShadow:
                "0 0 60px rgba(100,120,200,0.3), 0 0 120px rgba(60,80,160,0.15)",
              letterSpacing: "0.15em",
              lineHeight: 1,
            }}
          >
            SLUGCAT
          </h1>
          <div
            className="font-display text-gray-500 mt-2"
            style={{
              fontSize: "clamp(0.8rem, 2vw, 1.1rem)",
              letterSpacing: "0.4em",
            }}
          >
            RAIN WORLD INSPIRED
          </div>
        </div>

        {/* Controls info */}
        <div className="mb-8 text-center font-mono text-xs text-gray-700 space-y-1">
          <p>
            ARROWS / WASD — MOVE &nbsp; SPACE / ↑ — JUMP &nbsp; Z / X — GRAB
          </p>
          <p>↓ IN SHELTER — SLEEP / RESET RAIN &nbsp; DOUBLE JUMP AVAILABLE</p>
        </div>

        {/* Main buttons */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <button
            type="button"
            data-ocid="main_menu.start_button"
            onClick={onStart}
            className="group relative px-12 py-3 font-mono text-sm tracking-[0.3em] text-gray-200 border border-gray-600 hover:border-gray-300 hover:text-white transition-all duration-200 hover:bg-gray-900/50"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-800/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            ▶ START GAME
          </button>

          <button
            type="button"
            data-ocid="main_menu.mods_button"
            onClick={onMods}
            className="px-12 py-3 font-mono text-sm tracking-[0.3em] text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300 transition-all duration-200"
          >
            ◈ MOD MANAGER
          </button>
        </div>

        {/* Customize sprite */}
        <div className="mb-4 text-center">
          <p className="text-xs text-gray-700 tracking-widest mb-3 font-mono">
            ── CUSTOMIZE ──
          </p>
          <div className="flex items-center justify-center gap-3">
            {customSprite && (
              <img
                src={customSprite}
                alt="Custom slugcat sprite"
                className="w-10 h-10 object-cover border border-gray-700 rounded-sm"
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <button
              type="button"
              data-ocid="main_menu.upload_button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2 font-mono text-xs tracking-widest text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300 transition-all"
            >
              ⬆ UPLOAD SPRITE
            </button>
            {customSprite && (
              <button
                type="button"
                data-ocid="main_menu.delete_button"
                onClick={clearSprite}
                className="px-4 py-2 font-mono text-xs tracking-widest text-red-900 border border-red-900/30 hover:border-red-700 hover:text-red-500 transition-all"
              >
                ✕ CLEAR
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-[10px] text-gray-800 mt-2 font-mono">
            SPRITE SHOWN ON SLUGCAT HEAD
          </p>
        </div>

        {/* Custom levels from mods */}
        {customRooms.length > 0 && (
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-700 tracking-widest mb-3">
              ── CUSTOM LEVELS ──
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {customRooms.map((room, i) => (
                <button
                  type="button"
                  key={room.id}
                  data-ocid={`main_menu.item.${i + 1}`}
                  onClick={() => onStartCustom(defaultRooms.length + i)}
                  className="px-6 py-2 font-mono text-xs tracking-widest text-blue-400 border border-blue-900/50 hover:border-blue-600 hover:text-blue-200 transition-all"
                >
                  {room.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Room list */}
        <div className="mt-6 flex gap-6 text-[10px] font-mono text-gray-800">
          {["The Outskirts", "Industrial Wastes", "The Wall"].map((name, i) => (
            <span key={name}>
              0{i + 1} {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
