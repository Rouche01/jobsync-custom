import type {
  AtsCompanyHost,
  GreenhouseSourceConfig,
} from "@/models/automation.model";

// Provider-agnostic wizard config: Greenhouse fields plus optional per-company
// host (Lever default/eu, Personio de/com; unused for Greenhouse/Ashby).
export type AtsConfigCompany = {
  name: string;
  token: string;
  host?: AtsCompanyHost;
};

export type AtsConfigValue = Omit<GreenhouseSourceConfig, "companies"> & {
  companies: AtsConfigCompany[];
};

export type EntityOption = { id: string; label: string; value: string };

export const PROVIDER_META: Record<
  string,
  { label: string; urlHint: string; searchExample: string }
> = {
  greenhouse: {
    label: "Greenhouse",
    urlHint: "Or paste a boards.greenhouse.io link",
    searchExample: "Anthropic",
  },
  lever: {
    label: "Lever",
    urlHint: "Or paste a jobs.lever.co link or token",
    searchExample: "Netflix",
  },
  ashby: {
    label: "Ashby",
    urlHint: "Or paste a jobs.ashbyhq.com link or token",
    searchExample: "Ramp",
  },
  personio: {
    label: "Personio",
    urlHint: "Or paste a jobs.personio.de / .com link or token",
    searchExample: "Personio",
  },
};
