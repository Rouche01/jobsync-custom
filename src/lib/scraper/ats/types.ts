import type { JobBoard } from "@/models/automation.model";
import type { JobDetails } from "../types";

// Optional per-company host persisted after resolve so runtime fetches never
// re-probe. Lever uses default/eu; Personio uses de/com; Greenhouse/Ashby ignore it.
export type AtsHost = "default" | "eu" | "de" | "com";

export interface AtsProvider {
  id: JobBoard;
  label: string; // display name shown in the wizard/detail UI
  // Fetch a watchlist with bounded concurrency + per-token isolation.
  search(
    companies: { name: string; token: string; host?: AtsHost }[],
  ): Promise<{
    jobs: JobDetails[];
    errors: { token: string; reason: string }[];
  }>;
}
