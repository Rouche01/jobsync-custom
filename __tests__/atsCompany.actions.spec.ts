vi.mock("@/utils/user.utils", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/actions/company.actions", () => ({
  getWatchedBoards: vi.fn(),
}));

import {
  resolveAtsBoard,
  searchAtsCompanies,
  getAtsCompanyCount,
  suggestAtsCompanies,
} from "@/actions/atsCompany.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { getWatchedBoards } from "@/actions/company.actions";
import { APP_CONSTANTS } from "@/lib/constants";

const user = { id: "user-1" };

function okResponse(status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => [] } as Response;
}

describe("resolveAtsBoard (lever branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  afterEach(() => vi.restoreAllMocks());

  it("validates an explicit EU URL against the EU host", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard(
      "lever",
      "https://jobs.eu.lever.co/acme",
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("acme");
    expect(result.host).toBe("eu");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain(
      APP_CONSTANTS.LEVER_EU_BASE_URL,
    );
  });

  it("probes the default host first for a bare token", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard("lever", "acme");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.host).toBe("default");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain(APP_CONSTANTS.LEVER_BASE_URL);
  });

  it("falls back to the EU host when the default host does not resolve", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      return Promise.resolve(
        url.includes(APP_CONSTANTS.LEVER_EU_BASE_URL)
          ? okResponse(200)
          : okResponse(404),
      );
    });

    const result = await resolveAtsBoard("lever", "acme");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.host).toBe("eu");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("fails when neither host resolves", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okResponse(404));

    const result = await resolveAtsBoard("lever", "acme");
    expect(result.success).toBe(false);
  });

  it("rejects a malformed token before any fetch fires", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard("lever", "ab cd");
    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const result = await resolveAtsBoard("lever", "acme");
    expect(result.success).toBe(false);
  });
});

describe("resolveAtsBoard (greenhouse branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  afterEach(() => vi.restoreAllMocks());

  it("extracts token from a boards.greenhouse.io URL and returns the API name", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: "Anthropic" }),
    } as Response);

    const result = await resolveAtsBoard(
      "greenhouse",
      "https://boards.greenhouse.io/anthropic",
    );
    expect(result).toEqual({
      success: true,
      name: "Anthropic",
      token: "anthropic",
    });
  });

  it("extracts token from a job-boards.greenhouse.io URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: "Stripe" }),
    } as Response);

    const result = await resolveAtsBoard(
      "greenhouse",
      "https://job-boards.greenhouse.io/stripe/jobs/123",
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.token).toBe("stripe");
  });

  it("returns an error on 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const result = await resolveAtsBoard("greenhouse", "nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects a non-Greenhouse URL", async () => {
    const result = await resolveAtsBoard(
      "greenhouse",
      "https://careers.acme.com/jobs",
    );
    expect(result.success).toBe(false);
  });

  it("requires authentication", async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const result = await resolveAtsBoard("greenhouse", "anthropic");
    expect(result.success).toBe(false);
  });
});

describe("suggestAtsCompanies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
    (getWatchedBoards as any).mockResolvedValue([]);
  });

  it("returns empty when unauthenticated", async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const { companies } = await suggestAtsCompanies({
      provider: "greenhouse",
      keywords: ["lyft"],
    });
    expect(companies).toEqual([]);
  });

  it("ranks seed hits from keywords and includes watchlist", async () => {
    (getWatchedBoards as any).mockResolvedValue([
      {
        id: "1",
        name: "Anthropic",
        token: "anthropic",
        provider: "greenhouse",
      },
    ]);

    const { companies } = await suggestAtsCompanies({
      provider: "greenhouse",
      keywords: ["lyft"],
      limit: 10,
    });

    expect(companies.some((c) => c.token === "anthropic")).toBe(true);
    expect(
      companies.find((c) => c.token === "anthropic")?.reasons,
    ).toContain("watchlist");
    expect(
      companies.some((c) => c.name.toLowerCase().includes("lyft")),
    ).toBe(true);
  });

  it("caps limit at ATS_MAX_COMPANIES", async () => {
    (getWatchedBoards as any).mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        id: String(i),
        name: `Watched ${i}`,
        token: `watched-${i}`,
        provider: "lever",
      })),
    );

    const { companies } = await suggestAtsCompanies({
      provider: "lever",
      limit: 100,
    });
    expect(companies.length).toBeLessThanOrEqual(
      APP_CONSTANTS.ATS_MAX_COMPANIES,
    );
  });
});

describe("searchAtsCompanies / getAtsCompanyCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  it("searches the Greenhouse seed", async () => {
    const { companies } = await searchAtsCompanies("greenhouse", "lyft");
    expect(
      companies.some((c) => c.name.toLowerCase().includes("lyft")),
    ).toBe(true);
  });

  it("returns the seeded Lever company count", async () => {
    const count = await getAtsCompanyCount("lever");
    expect(count).toBeGreaterThan(100);
  });

  it("searches the Lever seed by name and token", async () => {
    const { companies } = await searchAtsCompanies("lever", "activecampaign");
    expect(companies.some((c) => c.token === "activecampaign")).toBe(true);
  });

  it("paginates the browse list and reports hasMore", async () => {
    const first = await searchAtsCompanies("lever", "");
    expect(first.companies).toHaveLength(50);
    expect(first.hasMore).toBe(true);

    const second = await searchAtsCompanies("lever", "", 50);
    expect(second.companies).toHaveLength(50);
    // No overlap between consecutive pages.
    const firstTokens = new Set(first.companies.map((c) => c.token));
    expect(second.companies.every((c) => !firstTokens.has(c.token))).toBe(true);
  });
});

describe("resolveAtsBoard (ashby branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  afterEach(() => vi.restoreAllMocks());

  it("extracts the token from a jobs.ashbyhq.com board URL", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard("ashby", "https://jobs.ashbyhq.com/ramp");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("ramp");
    expect(String(spy.mock.calls[0][0])).toContain(APP_CONSTANTS.ASHBY_BASE_URL);
  });

  it("extracts the token from a deep posting URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard(
      "ashby",
      "https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("ramp");
  });

  it("accepts a bare token and lowercases it", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard("ashby", "Ramp");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("ramp");
  });

  it("never returns a host (Ashby is single-host)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okResponse(200));

    const result = await resolveAtsBoard("ashby", "ramp");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.host).toBeUndefined();
  });

  it("rejects an unknown board on 404 without a second probe", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okResponse(404));

    const result = await resolveAtsBoard("ashby", "nope");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain("nope");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed token before any fetch", async () => {
    const spy = vi.spyOn(global, "fetch");

    const result = await resolveAtsBoard("ashby", "../etc/passwd");

    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("searchAtsCompanies (ashby)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  it("serves the Ashby seed, not an empty list", async () => {
    expect(await getAtsCompanyCount("ashby")).toBeGreaterThan(0);
    const { companies } = await searchAtsCompanies("ashby", "");
    expect(companies.length).toBeGreaterThan(0);
    expect(companies[0]).toHaveProperty("token");
  });
});

describe("resolveAtsBoard (personio branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  afterEach(() => vi.restoreAllMocks());

  function okProbe(status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      body: { cancel: vi.fn() },
    } as unknown as Response;
  }

  it("extracts the token and host from a .jobs.personio.de URL", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okProbe(200));

    const result = await resolveAtsBoard(
      "personio",
      "https://acme.jobs.personio.de",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("acme");
    expect(result.host).toBe("de");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain(
      "https://acme.jobs.personio.de/xml",
    );
  });

  it("extracts the token from a jobs.personio.com path URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(okProbe(200));

    const result = await resolveAtsBoard(
      "personio",
      "https://jobs.personio.com/acme/job/1",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("acme");
    expect(result.host).toBe("com");
  });

  it("probes .de then .com for a bare token", async () => {
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okProbe(404))
      .mockResolvedValueOnce(okProbe(200));

    const result = await resolveAtsBoard("personio", "Acme");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toBe("acme");
    expect(result.host).toBe("com");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("rejects an unknown board after probing both hosts", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(okProbe(404));

    const result = await resolveAtsBoard("personio", "nope");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain("nope");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed token before any fetch", async () => {
    const spy = vi.spyOn(global, "fetch");

    const result = await resolveAtsBoard("personio", "../etc/passwd");

    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("searchAtsCompanies (personio)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(user);
  });

  it("serves the Personio seed, not an empty list", async () => {
    expect(await getAtsCompanyCount("personio")).toBeGreaterThan(0);
    const { companies } = await searchAtsCompanies("personio", "");
    expect(companies.length).toBeGreaterThan(0);
    expect(companies[0]).toHaveProperty("token");
  });
});
