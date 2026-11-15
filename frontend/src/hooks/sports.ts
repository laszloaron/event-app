/** The sport list for filters and the form. Fetched once per visit: it is seeded reference data (architecture.md §1). */
import { listSports } from "../api/events";
import type { SportOut } from "../api/schema";
import { useApi } from "./data";

let cached: Promise<SportOut[]> | null = null;

function loadSports(): Promise<SportOut[]> {
  cached ??= listSports().catch((error: unknown) => {
    cached = null; // try again next time
    throw error;
  });
  return cached;
}

export function useSports(): SportOut[] {
  return useApi(loadSports, []).data ?? [];
}
