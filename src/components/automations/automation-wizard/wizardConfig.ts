import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type {
  AutomationWithResume,
  JobBoard,
  SourceConfig,
} from "@/models/automation.model";
import type { AtsConfigValue } from "../AtsSearchStep";

export type AtsKey = "greenhouse" | "lever" | "ashby";

export const EMPTY_ATS: AtsConfigValue = {
  companies: [],
  targetTitles: [],
  keywords: [],
  locations: [],
  strictLocation: false,
  topK: APP_CONSTANTS.MAX_JOBS_PER_RUN,
  saveUnanalyzed: true,
};

/** Criteria carry over when the board changes; company tokens do not. */
export function migrateAtsConfigOnBoardChange(
  current: SourceConfig | undefined,
  from: JobBoard,
  to: JobBoard,
): SourceConfig {
  if (from === to) return current ?? {};
  const prev = current?.[from];
  return {
    [to]: {
      companies: [],
      targetTitles: prev?.targetTitles ?? [],
      keywords: prev?.keywords ?? [],
      locations: prev?.locations ?? [],
      strictLocation: prev?.strictLocation ?? false,
      topK: prev?.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN,
      saveUnanalyzed: prev?.saveUnanalyzed ?? true,
    },
  };
}

/** Prefill create-wizard defaults from an existing automation (does not save). */
export function buildDuplicateDefaults(
  source: AutomationWithResume,
): CreateAutomationInput {
  return {
    name: `Copy of ${source.name}`.slice(0, 100),
    jobBoard: source.jobBoard as JobBoard,
    keywords: source.keywords ?? "",
    location: source.location ?? "",
    sourceConfig: parseEditSourceConfig(source.sourceConfig),
    resumeId: source.resumeId,
    matchThreshold: source.matchThreshold,
    scheduleHour: source.scheduleHour,
  };
}

export const STEPS = [
  { id: "basics", title: "Basics", description: "Name your automation" },
  {
    id: "search",
    title: "Search",
    description: "Criteria, suggested companies, then confirm",
  },
  { id: "resume", title: "Resume", description: "Select resume for matching" },
  { id: "matching", title: "Matching", description: "Set match threshold" },
  { id: "schedule", title: "Schedule", description: "When to run" },
  { id: "review", title: "Review", description: "Confirm settings" },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export function parseEditSourceConfig(
  sc?: string | null,
): CreateAutomationInput["sourceConfig"] | undefined {
  if (!sc) return undefined;
  try {
    const parsed = JSON.parse(sc);
    return parsed?.greenhouse || parsed?.lever || parsed?.ashby
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export interface WizardResume {
  id: string;
  title: string;
  sectionCount: number;
}
