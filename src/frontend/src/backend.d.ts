import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Mod {
    id: string;
    name: string;
    createdAt: Time;
    description: string;
    author: string;
    version: string;
    enabled: boolean;
    jsonContent: string;
}
export type Time = bigint;
export interface backendInterface {
    addMod(id: string, name: string, description: string, author: string, version: string, jsonContent: string): Promise<void>;
    deleteMod(id: string): Promise<void>;
    getMod(id: string): Promise<Mod>;
    listMods(): Promise<Array<Mod>>;
    toggleModEnabled(id: string): Promise<void>;
}
