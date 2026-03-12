import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useRef } from "react";
import { toast } from "sonner";
import type { ModData } from "./GameTypes";
import {
  useAddMod,
  useDeleteMod,
  useListMods,
  useToggleMod,
} from "./hooks/useQueries";

interface ModManagerProps {
  onBack: () => void;
}

export function ModManager({ onBack }: ModManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: mods = [], isLoading } = useListMods();
  const addMod = useAddMod();
  const deleteMod = useDeleteMod();
  const toggleMod = useToggleMod();

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ModData;
      if (!data.name) throw new Error("Mod must have a name field");
      const id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await addMod.mutateAsync({
        id,
        name: data.name,
        description: data.description ?? "",
        author: data.author ?? "Unknown",
        version: data.version ?? "1.0.0",
        jsonContent: text,
      });
      toast.success(`Mod "${data.name}" loaded!`);
    } catch (err) {
      toast.error(
        `Failed to load mod: ${err instanceof Error ? err.message : "Invalid file"}`,
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col w-full h-full bg-[#060609] text-gray-300 font-mono">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <button
          type="button"
          data-ocid="mod_manager.back_button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm"
        >
          ← BACK
        </button>
        <h1 className="text-lg tracking-[0.2em] text-gray-200 font-display">
          MOD MANAGER
        </h1>
        <span className="ml-auto text-xs text-gray-600">
          {mods.length} installed
        </span>
      </div>

      {/* Load button */}
      <div className="px-6 py-4 border-b border-gray-800/50">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileLoad}
        />
        <Button
          data-ocid="mod_manager.upload_button"
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 font-mono text-xs tracking-widest"
          onClick={() => fileInputRef.current?.click()}
          disabled={addMod.isPending}
        >
          {addMod.isPending ? "⟳ LOADING..." : "+ LOAD MOD FILE (.json)"}
        </Button>
        <p className="mt-2 text-xs text-gray-700">
          Mod files can add custom levels, enemies, and items to the game.
        </p>
      </div>

      {/* Mod list */}
      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-20 w-full bg-gray-800/50 rounded"
              />
            ))}
          </div>
        ) : mods.length === 0 ? (
          <div
            data-ocid="mod_manager.empty_state"
            className="flex flex-col items-center justify-center py-20 text-gray-700"
          >
            <div className="text-4xl mb-4 opacity-30">◈</div>
            <p className="text-sm tracking-widest">NO MODS INSTALLED</p>
            <p className="text-xs mt-2">Load a .json mod file above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mods.map((mod, idx) => (
              <div
                key={mod.id}
                data-ocid={`mod_manager.item.${idx + 1}`}
                className={`p-4 rounded border transition-colors ${
                  mod.enabled
                    ? "border-gray-700 bg-gray-900/60"
                    : "border-gray-800/50 bg-gray-900/20 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <Switch
                    data-ocid={`mod_manager.toggle.${idx + 1}`}
                    checked={mod.enabled}
                    disabled={toggleMod.isPending}
                    onCheckedChange={() =>
                      toggleMod.mutate(mod.id, {
                        onSuccess: () =>
                          toast.success(
                            mod.enabled
                              ? `"${mod.name}" disabled`
                              : `"${mod.name}" enabled`,
                          ),
                      })
                    }
                    className="mt-0.5"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-200 font-semibold">
                        {mod.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-gray-700 text-gray-500"
                      >
                        v{mod.version}
                      </Badge>
                      {mod.enabled && (
                        <Badge className="text-[10px] bg-green-900/40 text-green-400 border-green-800">
                          ACTIVE
                        </Badge>
                      )}
                      {(() => {
                        try {
                          const d = JSON.parse(mod.jsonContent) as ModData;
                          if (d.levels && d.levels.length > 0) {
                            return (
                              <Badge className="text-[10px] bg-blue-900/40 text-blue-400 border-blue-800">
                                {d.levels.length} level
                                {d.levels.length > 1 ? "s" : ""}
                              </Badge>
                            );
                          }
                        } catch {
                          /* ignore */
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      by {mod.author}
                    </p>
                    {mod.description && (
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {mod.description}
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  <Button
                    data-ocid={`mod_manager.delete_button.${idx + 1}`}
                    variant="ghost"
                    size="sm"
                    className="text-gray-700 hover:text-red-400 hover:bg-red-900/20 text-xs px-2"
                    onClick={() =>
                      deleteMod.mutate(mod.id, {
                        onSuccess: () => toast.success(`"${mod.name}" removed`),
                      })
                    }
                    disabled={deleteMod.isPending}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-800 text-center">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
