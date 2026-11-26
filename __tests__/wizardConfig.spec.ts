import {
  buildDuplicateDefaults,
  migrateAtsConfigOnBoardChange,
  parseEditSourceConfig,
} from "@/components/automations/automation-wizard/wizardConfig";
import { PROVIDER_META } from "@/components/automations/ats-search-step/types";
import type { AutomationWithResume } from "@/models/automation.model";
import { APP_CONSTANTS } from "@/lib/constants";

describe("parseEditSourceConfig", () => {
  it("returns undefined for null/blank input", () => {
    expect(parseEditSourceConfig(null)).toBeUndefined();
    expect(parseEditSourceConfig("")).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    expect(parseEditSourceConfig("{not json")).toBeUndefined();
  });

  it("keeps a Greenhouse config", () => {
    const sc = JSON.stringify({ greenhouse: { companies: [] } });
    expect(parseEditSourceConfig(sc)).toEqual({ greenhouse: { companies: [] } });
  });

  it("keeps a Lever config", () => {
    const sc = JSON.stringify({ lever: { companies: [] } });
    expect(parseEditSourceConfig(sc)).toEqual({ lever: { companies: [] } });
  });

  it("keeps an Ashby config so editing an Ashby automation keeps its companies", () => {
    const sc = JSON.stringify({
      ashby: { companies: [{ name: "Ramp", token: "ramp" }] },
    });
    expect(parseEditSourceConfig(sc)).toEqual({
      ashby: { companies: [{ name: "Ramp", token: "ramp" }] },
    });
  });
});

describe("PROVIDER_META", () => {
  it("has an entry for every board the wizard can select", () => {
    ["greenhouse", "lever", "ashby", "personio"].forEach((board) => {
      expect(PROVIDER_META[board]).toBeDefined();
      expect(PROVIDER_META[board].label.length).toBeGreaterThan(0);
    });
  });
});

describe("migrateAtsConfigOnBoardChange", () => {
  it("keeps criteria and clears companies when switching boards", () => {
    const next = migrateAtsConfigOnBoardChange(
      {
        greenhouse: {
          companies: [{ name: "Acme", token: "acme" }],
          targetTitles: ["Engineer"],
          keywords: ["React"],
          locations: ["Remote"],
          strictLocation: true,
          topK: 12,
          saveUnanalyzed: false,
        },
      },
      "greenhouse",
      "lever",
    );
    expect(next).toEqual({
      lever: {
        companies: [],
        targetTitles: ["Engineer"],
        keywords: ["React"],
        locations: ["Remote"],
        strictLocation: true,
        topK: 12,
        saveUnanalyzed: false,
      },
    });
  });

  it("is a no-op when the board does not change", () => {
    const current = {
      ashby: { companies: [{ name: "Ramp", token: "ramp" }] },
    };
    expect(migrateAtsConfigOnBoardChange(current, "ashby", "ashby")).toBe(
      current,
    );
  });
});

describe("buildDuplicateDefaults", () => {
  const source = {
    id: "auto-1",
    userId: "user-1",
    name: "GH Search",
    jobBoard: "greenhouse",
    keywords: "",
    location: "",
    sourceConfig: JSON.stringify({
      greenhouse: {
        companies: [{ name: "Acme", token: "acme" }],
        keywords: ["TypeScript"],
      },
    }),
    resumeId: "11111111-1111-1111-1111-111111111111",
    matchThreshold: 75,
    scheduleHour: 9,
    nextRunAt: null,
    lastRunAt: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    resume: { id: "11111111-1111-1111-1111-111111111111", title: "Main" },
  } as AutomationWithResume;

  it("prefills create fields with a Copy of name and the same settings", () => {
    const defaults = buildDuplicateDefaults(source);
    expect(defaults.name).toBe("Copy of GH Search");
    expect(defaults.jobBoard).toBe("greenhouse");
    expect(defaults.resumeId).toBe(source.resumeId);
    expect(defaults.matchThreshold).toBe(75);
    expect(defaults.scheduleHour).toBe(9);
    expect(defaults.sourceConfig?.greenhouse?.companies).toEqual([
      { name: "Acme", token: "acme" },
    ]);
    expect(defaults.sourceConfig?.greenhouse?.keywords).toEqual(["TypeScript"]);
  });

  it("truncates a long Copy of name to 100 chars", () => {
    const long = buildDuplicateDefaults({
      ...source,
      name: "x".repeat(120),
    });
    expect(long.name.length).toBe(100);
    expect(long.name.startsWith("Copy of ")).toBe(true);
  });

  it("falls back to default topK when migrating empty criteria", () => {
    const next = migrateAtsConfigOnBoardChange(undefined, "lever", "ashby");
    expect(next.ashby?.topK).toBe(APP_CONSTANTS.MAX_JOBS_PER_RUN);
    expect(next.ashby?.companies).toEqual([]);
  });
});
