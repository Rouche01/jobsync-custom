import {
  fetchPersonioBoardJobs,
  mergePersonioLanguages,
  searchPersonioJobs,
} from "@/lib/scraper/personio";
import {
  hasUsefulPersonioCopy,
  mapPersonioJob,
  personioBoardBase,
} from "@/lib/scraper/personio/mapper";
import type { PersonioPosition } from "@/lib/scraper/personio/types";
import { ATS_PROVIDERS } from "@/lib/scraper/ats/registry";
import { ATS_BOARDS } from "@/models/automation.model";

function position(overrides: Partial<PersonioPosition> = {}): PersonioPosition {
  return {
    id: "1001",
    name: "Backend Engineer",
    office: "Berlin",
    jobDescriptions: {
      jobDescription: [
        { name: "About", value: "<p>Build APIs</p>" },
      ],
    },
    employmentType: "permanent",
    schedule: "full-time",
    createdAt: "2026-11-01T10:00:00+00:00",
    ...overrides,
  };
}

function positionXml(positions: PersonioPosition[]): string {
  const body = positions
    .map((p) => {
      const offices = Array.isArray(p.additionalOffices?.office)
        ? p.additionalOffices!.office
        : p.additionalOffices?.office
          ? [p.additionalOffices.office]
          : [];
      const additional = offices.length
        ? `<additionalOffices>${offices
            .map((o) => `<office>${o}</office>`)
            .join("")}</additionalOffices>`
        : "";
      const blocks = Array.isArray(p.jobDescriptions?.jobDescription)
        ? p.jobDescriptions!.jobDescription
        : p.jobDescriptions?.jobDescription
          ? [p.jobDescriptions.jobDescription]
          : [];
      const descriptions = blocks
        .map(
          (b) =>
            `<jobDescription><name>${b.name ?? ""}</name><value><![CDATA[${b.value ?? ""}]]></value></jobDescription>`,
        )
        .join("");
      return `<position>
        <id>${p.id}</id>
        <name>${p.name ?? ""}</name>
        <office>${Array.isArray(p.office) ? p.office[0] : (p.office ?? "")}</office>
        ${additional}
        <jobDescriptions>${descriptions}</jobDescriptions>
        <employmentType>${p.employmentType ?? ""}</employmentType>
        <schedule>${p.schedule ?? ""}</schedule>
        <createdAt>${p.createdAt ?? ""}</createdAt>
      </position>`;
    })
    .join("");
  return `<?xml version="1.0"?><workzag-jobs>${body}</workzag-jobs>`;
}

function okXml(xml: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => xml,
    body: { cancel: vi.fn() },
  } as unknown as Response;
}

describe("personioBoardBase", () => {
  it("builds .de and .com career URLs", () => {
    expect(personioBoardBase("acme", "de")).toBe(
      "https://acme.jobs.personio.de",
    );
    expect(personioBoardBase("acme", "com")).toBe(
      "https://acme.jobs.personio.com",
    );
  });
});

describe("mapPersonioJob", () => {
  it("carries the company name from the caller", () => {
    expect(mapPersonioJob(position(), "Acme", "acme", "de").company).toBe(
      "Acme",
    );
  });

  it("joins primary and additional offices, deduped", () => {
    const job = mapPersonioJob(
      position({
        office: "Munich",
        additionalOffices: { office: ["Berlin", "Munich"] },
      }),
      "Acme",
      "acme",
      "de",
    );
    expect(job.location).toBe("Munich, Berlin");
  });

  it("concatenates description blocks with headings", () => {
    const job = mapPersonioJob(
      position({
        jobDescriptions: {
          jobDescription: [
            { name: "Role", value: "<p>Do things</p>" },
            { name: "Requirements", value: "<p>Ship code</p>" },
          ],
        },
      }),
      "Acme",
      "acme",
      "de",
    );
    expect(job.description).toContain("<h3>Role</h3><p>Do things</p>");
    expect(job.description).toContain(
      "<h3>Requirements</h3><p>Ship code</p>",
    );
  });

  it("builds the public job URL for the resolved host", () => {
    expect(mapPersonioJob(position(), "Acme", "acme", "de").url).toBe(
      "https://acme.jobs.personio.de/job/1001",
    );
    expect(mapPersonioJob(position(), "Acme", "acme", "com").url).toBe(
      "https://acme.jobs.personio.com/job/1001",
    );
  });

  it("formats salary when present", () => {
    const job = mapPersonioJob(
      position({
        salaryInformation: {
          min: "90000.00",
          max: "110000.00",
          currencySymbol: "€",
          type: "yearly",
        },
      }),
      "Acme",
      "acme",
      "de",
    );
    expect(job.salary).toBe("€90000.00–110000.00 yearly");
  });

  it("joins employmentType and schedule", () => {
    expect(mapPersonioJob(position(), "Acme", "acme", "de").employmentType).toBe(
      "permanent / full-time",
    );
  });
});

describe("hasUsefulPersonioCopy / mergePersonioLanguages", () => {
  it("requires both title and description for useful EN copy", () => {
    expect(hasUsefulPersonioCopy(position())).toBe(true);
    expect(
      hasUsefulPersonioCopy(
        position({
          jobDescriptions: { jobDescription: [{ name: "Role", value: "" }] },
        }),
      ),
    ).toBe(false);
  });

  it("prefers EN when useful, otherwise keeps DE", () => {
    const de = [
      position({
        id: "1",
        name: "Entwickler",
        jobDescriptions: {
          jobDescription: [{ name: "Rolle", value: "<p>DE</p>" }],
        },
      }),
      position({
        id: "2",
        name: "Nur DE",
        jobDescriptions: {
          jobDescription: [{ name: "Rolle", value: "<p>DE only</p>" }],
        },
      }),
    ];
    const en = [
      position({
        id: "1",
        name: "Engineer",
        jobDescriptions: {
          jobDescription: [{ name: "Role", value: "<p>EN</p>" }],
        },
      }),
      position({
        id: "2",
        name: "Empty EN",
        jobDescriptions: { jobDescription: [{ name: "Role", value: "" }] },
      }),
    ];

    const merged = mergePersonioLanguages(en, de);
    const byId = Object.fromEntries(
      merged.map((p) => [String(p.id), p.name]),
    );
    expect(byId["1"]).toBe("Engineer");
    expect(byId["2"]).toBe("Nur DE");
  });
});

describe("fetchPersonioBoardJobs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches EN and DE feeds and returns mapped jobs", async () => {
    const xml = positionXml([position(), position({ id: "1002", name: "SRE" })]);
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okXml(xml));

    const result = await fetchPersonioBoardJobs("Acme", "acme", "de");

    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[0][0])).toContain(
      "https://acme.jobs.personio.de/xml?language=en",
    );
    expect(String(spy.mock.calls[1][0])).toContain(
      "https://acme.jobs.personio.de/xml?language=de",
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].company).toBe("Acme");
  });

  it("surfaces a rate_limited error when both feeds are 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okXml("", 429));

    const result = await fetchPersonioBoardJobs("Acme", "acme", "de");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("rate_limited");
  });
});

describe("searchPersonioJobs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("isolates per-token failures", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("bad")) return okXml("", 404);
      return okXml(positionXml([position()]));
    });

    const { jobs, errors } = await searchPersonioJobs([
      { name: "Good", token: "good", host: "de" },
      { name: "Bad", token: "bad", host: "de" },
    ]);

    expect(jobs.length).toBeGreaterThan(0);
    expect(errors).toEqual([
      expect.objectContaining({ token: "bad" }),
    ]);
  });
});

describe("ATS_PROVIDERS personio", () => {
  it("is registered alongside the other boards", () => {
    expect(ATS_BOARDS).toContain("personio");
    expect(ATS_PROVIDERS.personio?.id).toBe("personio");
    expect(ATS_PROVIDERS.personio?.label).toBe("Personio");
    expect(typeof ATS_PROVIDERS.personio?.search).toBe("function");
  });
});
