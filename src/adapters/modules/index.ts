import type { AdapterModule } from "../types";
import { celescFatura } from "./celesc-fatura";
import { echoTest } from "./echo-test";

export const adapterModules: Record<string, AdapterModule> = {
  "echo-test": echoTest,
  "celesc-fatura": celescFatura,
};

export function getAdapterModule(key: string): AdapterModule | undefined {
  return adapterModules[key];
}

export function getAvailableModules(): { key: string; label: string; description: string }[] {
  return Object.entries(adapterModules).map(([key, mod]) => ({
    key,
    label: mod.label,
    description: mod.description,
  }));
}
