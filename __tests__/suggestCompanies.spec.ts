import {
  tokenizeTerms,
  rankCompanySuggestions,
} from "@/lib/scraper/ats/suggestCompanies";

describe("tokenizeTerms", () => {
  it("lowercases and splits on non-alphanumeric", () => {
    expect(tokenizeTerms(["Frontend Engineer", "React/Node"])).toEqual(
      expect.arrayContaining(["frontend", "engineer", "react", "node"]),
    );
  });

  it("drops tokens shorter than 2 chars", () => {
    expect(tokenizeTerms(["A", "C", "Go"])).toEqual(["go"]);
  });
});

describe("rankCompanySuggestions", () => {
  const seed = [
    { name: "Stripe", token: "stripe" },
    { name: "Netflix", token: "netflix" },
    { name: "React Corp", token: "reactcorp" },
    { name: "Acme", token: "acme" },
  ];

  it("returns empty when there is no criteria and no watchlist", () => {
    expect(
      rankCompanySuggestions({
        seed,
        watched: [],
        targetTitles: [],
        keywords: [],
        limit: 10,
      }),
    ).toEqual([]);
  });

  it("boosts watchlist companies even without title/keyword hits", () => {
    const ranked = rankCompanySuggestions({
      seed,
      watched: [{ name: "Acme", token: "acme" }],
      targetTitles: [],
      keywords: [],
      limit: 10,
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].token).toBe("acme");
    expect(ranked[0].reasons).toContain("watchlist");
    expect(ranked[0].score).toBeGreaterThanOrEqual(100);
  });

  it("ranks title matches above keyword-only matches", () => {
    const ranked = rankCompanySuggestions({
      seed,
      watched: [],
      targetTitles: ["Netflix"],
      keywords: ["react"],
      limit: 10,
    });
    expect(ranked.map((c) => c.token)).toEqual(["netflix", "reactcorp"]);
    expect(ranked[0].reasons).toContain("title");
    expect(ranked[1].reasons).toContain("keyword");
  });

  it("respects the limit", () => {
    const ranked = rankCompanySuggestions({
      seed,
      watched: seed,
      targetTitles: [],
      keywords: [],
      limit: 2,
    });
    expect(ranked).toHaveLength(2);
  });

  it("prefers seed spelling when watchlist overlaps a token", () => {
    const ranked = rankCompanySuggestions({
      seed,
      watched: [{ name: "ACME Watched", token: "acme" }],
      targetTitles: [],
      keywords: [],
      limit: 5,
    });
    expect(ranked[0].name).toBe("Acme");
    expect(ranked[0].reasons).toContain("watchlist");
  });
});
