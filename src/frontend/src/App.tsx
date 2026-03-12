import { Toaster } from "@/components/ui/sonner";
import { useMemo, useState } from "react";
import { Game } from "./Game";
import type { Screen } from "./GameTypes";
import { MainMenu } from "./MainMenu";
import { ModManager } from "./ModManager";
import { useModRooms } from "./hooks/useQueries";
import { createDefaultRooms } from "./levels";

const DEFAULT_ROOMS = createDefaultRooms();

function GameResultScreen({
  won,
  onReplay,
  onMenu,
}: {
  won: boolean;
  onReplay: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#06060d] font-mono">
      {/* Atmospheric background lines */}
      <div className="absolute inset-0 overflow-hidden">
        {[
          5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
          95, 100,
        ].map((pct) => (
          <div
            key={pct}
            className="absolute w-full h-px opacity-5"
            style={{
              top: `${pct}%`,
              background: won ? "#4ade80" : "#ef4444",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center">
        <div
          className="font-display font-bold mb-2"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            color: won ? "#4ade80" : "#ef4444",
            textShadow: won
              ? "0 0 40px rgba(74,222,128,0.4)"
              : "0 0 40px rgba(239,68,68,0.4)",
            letterSpacing: "0.15em",
          }}
        >
          {won ? "ASCENDED" : "PERISHED"}
        </div>
        <p className="text-gray-600 text-sm tracking-widest mb-10">
          {won
            ? "You have reached the sky. The cycle continues."
            : "The rain claimed you. All things end."}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            data-ocid="gameover.primary_button"
            onClick={onReplay}
            className="px-10 py-3 font-mono text-sm tracking-[0.3em] border transition-all duration-200"
            style={{
              borderColor: won ? "#166534" : "#7f1d1d",
              color: won ? "#4ade80" : "#ef4444",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = won
                ? "rgba(74,222,128,0.1)"
                : "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ▶ PLAY AGAIN
          </button>
          <button
            type="button"
            data-ocid="gameover.back_button"
            onClick={onMenu}
            className="px-10 py-3 font-mono text-sm tracking-[0.3em] text-gray-600 border border-gray-800 hover:border-gray-600 hover:text-gray-300 transition-all duration-200"
          >
            MAIN MENU
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 text-[10px] text-gray-800 font-mono">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600"
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [startRoom, setStartRoom] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const customRooms = useModRooms();

  const allRooms = useMemo(
    () => [...DEFAULT_ROOMS, ...customRooms],
    [customRooms],
  );

  function startGame(roomIdx = 0) {
    setStartRoom(roomIdx);
    setGameKey((k) => k + 1);
    setScreen("game");
  }

  return (
    <div className="w-full h-full">
      {screen === "menu" && (
        <MainMenu
          onStart={() => startGame(0)}
          onMods={() => setScreen("mods")}
          onStartCustom={(idx) => startGame(idx)}
          defaultRooms={DEFAULT_ROOMS}
        />
      )}

      {screen === "game" && (
        <Game
          key={gameKey}
          rooms={allRooms}
          initialRoom={startRoom}
          onDeath={() => setScreen("gameover")}
          onWin={() => setScreen("win")}
          onMenu={() => setScreen("menu")}
        />
      )}

      {screen === "mods" && <ModManager onBack={() => setScreen("menu")} />}

      {(screen === "gameover" || screen === "win") && (
        <GameResultScreen
          won={screen === "win"}
          onReplay={() => startGame(startRoom)}
          onMenu={() => setScreen("menu")}
        />
      )}

      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "#0d0d18",
            border: "1px solid #2a2a4a",
            color: "#c0c0e0",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}
