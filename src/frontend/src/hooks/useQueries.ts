import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ModData, Room } from "../GameTypes";
import type { Mod } from "../backend";
import { parseModRoom } from "../levels";
import { useActor } from "./useActor";

export function useListMods() {
  const { actor, isFetching } = useActor();
  return useQuery<Mod[]>({
    queryKey: ["mods"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listMods();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddMod() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      author,
      version,
      jsonContent,
    }: {
      id: string;
      name: string;
      description: string;
      author: string;
      version: string;
      jsonContent: string;
    }) => {
      if (!actor) throw new Error("No actor");
      await actor.addMod(id, name, description, author, version, jsonContent);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mods"] }),
  });
}

export function useDeleteMod() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("No actor");
      await actor.deleteMod(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mods"] }),
  });
}

export function useToggleMod() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("No actor");
      await actor.toggleModEnabled(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mods"] }),
  });
}

export function useModRooms(): Room[] {
  const { data: mods = [] } = useListMods();
  return useMemo(() => {
    const rooms: Room[] = [];
    let idx = 3; // start after default rooms
    for (const mod of mods) {
      if (!mod.enabled) continue;
      try {
        const data = JSON.parse(mod.jsonContent) as ModData;
        if (Array.isArray(data.levels)) {
          for (const level of data.levels) {
            const room = parseModRoom(level, idx);
            rooms.push(room);
            idx++;
          }
        }
      } catch {
        // ignore malformed mods
      }
    }
    return rooms;
  }, [mods]);
}
