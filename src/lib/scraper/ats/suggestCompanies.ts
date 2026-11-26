import type { AtsCompanyHost } from "@/models/automation.model";

export type SuggestableCompany = {
  name: string;
  token: string;
  host?: AtsCompanyHost;
};

export type SuggestReason = "watchlist" | "title" | "keyword";

export type RankedCompany = SuggestableCompany & {
  score: number;
  reasons: SuggestReason[];
};

const WATCHLIST_BOOST = 100;
const TITLE_NAME = 10;
const TITLE_TOKEN = 8;
const KEYWORD_NAME = 5;
const KEYWORD_TOKEN = 4;

/** Split criteria into lowercase tokens (min length 2). */
export function tokenizeTerms(values: string[]): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    for (const part of raw.toLowerCase().split(/[^a-z0-9+#.]+/i)) {
      const t = part.trim();
      if (t.length >= 2) out.add(t);
    }
  }
  return [...out];
}

function scoreAgainst(
  company: SuggestableCompany,
  terms: string[],
  nameWeight: number,
  tokenWeight: number,
): number {
  if (terms.length === 0) return 0;
  const name = company.name.toLowerCase();
  const token = company.token.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (name.includes(term)) score += nameWeight;
    if (token.includes(term)) score += tokenWeight;
  }
  return score;
}

/**
 * Rank seeded ATS boards by target titles / keywords, boosting the user's
 * watchlist. Location is intentionally ignored — it filters jobs at run time,
 * not companies in the directory (seeds have no geo).
 */
export function rankCompanySuggestions(args: {
  seed: SuggestableCompany[];
  watched: SuggestableCompany[];
  targetTitles: string[];
  keywords: string[];
  limit: number;
}): RankedCompany[] {
  const titleTerms = tokenizeTerms(args.targetTitles);
  const keywordTerms = tokenizeTerms(args.keywords);
  const watchedByToken = new Map(args.watched.map((w) => [w.token, w]));

  // Prefer seed rows when both exist so directory spelling wins; keep host from either.
  const byToken = new Map<string, SuggestableCompany>();
  for (const c of args.seed) byToken.set(c.token, c);
  for (const w of args.watched) {
    if (!byToken.has(w.token)) byToken.set(w.token, w);
  }

  const ranked: RankedCompany[] = [];
  for (const company of byToken.values()) {
    const reasons: SuggestReason[] = [];
    let score = 0;

    if (watchedByToken.has(company.token)) {
      score += WATCHLIST_BOOST;
      reasons.push("watchlist");
    }

    const titleScore = scoreAgainst(
      company,
      titleTerms,
      TITLE_NAME,
      TITLE_TOKEN,
    );
    if (titleScore > 0) {
      score += titleScore;
      reasons.push("title");
    }

    const keywordScore = scoreAgainst(
      company,
      keywordTerms,
      KEYWORD_NAME,
      KEYWORD_TOKEN,
    );
    if (keywordScore > 0) {
      score += keywordScore;
      reasons.push("keyword");
    }

    if (score <= 0) continue;
    ranked.push({ ...company, score, reasons });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return ranked.slice(0, Math.max(0, args.limit));
}
