import pLimit from "p-limit";
import { XMLParser } from "fast-xml-parser";
import { APP_CONSTANTS } from "@/lib/constants";
import type { PersonioHost } from "@/models/automation.model";
import type { JobDetails, ScraperResult } from "../types";
import { errorReason } from "../utils";
import {
  hasUsefulPersonioCopy,
  mapPersonioJob,
  personioBoardBase,
} from "./mapper";
import type { PersonioBoardXml, PersonioPosition } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  // Personio wraps HTML in CDATA; keep the text content.
  cdataPropName: false,
  isArray: (_name, jPathOrMatcher) => {
    // Force arrays for repeating tags without turning every scalar into one.
    // jPath is a string when jPath parsing is enabled (default); otherwise a MatcherView.
    if (typeof jPathOrMatcher !== "string") return false;
    return (
      jPathOrMatcher === "workzag-jobs.position" ||
      jPathOrMatcher.endsWith("jobDescriptions.jobDescription") ||
      jPathOrMatcher.endsWith("additionalOffices.office")
    );
  },
});

function positionsFromXml(xml: string): PersonioPosition[] {
  const parsed = xmlParser.parse(xml) as PersonioBoardXml;
  const raw = parsed?.["workzag-jobs"]?.position;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function fetchPersonioFeed(
  slug: string,
  host: PersonioHost,
  language: string,
  signal: AbortSignal,
): Promise<ScraperResult<PersonioPosition[]>> {
  const url = `${personioBoardBase(slug, host)}/xml?language=${encodeURIComponent(language)}`;
  const response = await fetch(url, { signal });

  if (response.status === 429) {
    return { success: false, error: { type: "rate_limited" } };
  }
  if (response.status === 404) {
    return {
      success: false,
      error: {
        type: "network",
        message: `Board '${slug}' not found on personio.${host}`,
      },
    };
  }
  if (!response.ok) {
    return {
      success: false,
      error: {
        type: "network",
        message: `Board '${slug}' returned ${response.status}`,
      },
    };
  }

  const xml = await response.text();
  try {
    return { success: true, data: positionsFromXml(xml) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    return {
      success: false,
      error: { type: "parse", message: `Board '${slug}' malformed XML: ${message}` },
    };
  }
}

/**
 * Merge EN (preferred) and DE (fallback) position lists by id. Keep EN when it
 * has a usable title+description; otherwise use DE when present.
 */
export function mergePersonioLanguages(
  primary: PersonioPosition[],
  fallback: PersonioPosition[],
): PersonioPosition[] {
  const byId = new Map<string, PersonioPosition>();

  for (const position of fallback) {
    const id = String(position.id ?? "").trim();
    if (!id) continue;
    byId.set(id, position);
  }

  for (const position of primary) {
    const id = String(position.id ?? "").trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || hasUsefulPersonioCopy(position)) {
      byId.set(id, position);
    }
  }

  return [...byId.values()];
}

// Fetch every listed posting for one board (EN preferred, DE fallback).
export async function fetchPersonioBoardJobs(
  name: string,
  token: string,
  host: PersonioHost = "de",
): Promise<ScraperResult<JobDetails[]>> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    APP_CONSTANTS.PERSONIO_FETCH_TIMEOUT_MS,
  );

  try {
    const primaryLang = APP_CONSTANTS.PERSONIO_FEED_LANGUAGE_PRIMARY;
    const fallbackLang = APP_CONSTANTS.PERSONIO_FEED_LANGUAGE_FALLBACK;

    const [primaryResult, fallbackResult] = await Promise.all([
      fetchPersonioFeed(token, host, primaryLang, controller.signal),
      fetchPersonioFeed(token, host, fallbackLang, controller.signal),
    ]);

    // Prefer a successful feed; if both fail, surface the primary error.
    if (!primaryResult.success && !fallbackResult.success) {
      return primaryResult;
    }

    const primary = primaryResult.success ? primaryResult.data : [];
    const fallback = fallbackResult.success ? fallbackResult.data : [];
    const merged = mergePersonioLanguages(primary, fallback);

    const jobs = merged
      .filter((position) => String(position.id ?? "").trim().length > 0)
      .map((position) => mapPersonioJob(position, name, token, host));

    return { success: true, data: jobs };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: { type: "network", message: `Board '${token}' timed out` },
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: { type: "network", message } };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch a watchlist in parallel (bounded concurrency) with per-token isolation.
export async function searchPersonioJobs(
  companies: { name: string; token: string; host?: PersonioHost | string }[],
): Promise<{ jobs: JobDetails[]; errors: { token: string; reason: string }[] }> {
  const limit = pLimit(APP_CONSTANTS.PERSONIO_FETCH_CONCURRENCY);

  const settled = await Promise.allSettled(
    companies.map(({ name, token, host }) =>
      limit(() =>
        fetchPersonioBoardJobs(
          name,
          token,
          host === "com" ? "com" : "de",
        ),
      ),
    ),
  );

  const jobs: JobDetails[] = [];
  const errors: { token: string; reason: string }[] = [];

  settled.forEach((result, index) => {
    const token = companies[index].token;
    if (result.status === "fulfilled") {
      if (result.value.success) {
        jobs.push(...result.value.data);
      } else {
        errors.push({ token, reason: errorReason(result.value.error) });
      }
    } else {
      const reason =
        result.reason instanceof Error ? result.reason.message : "Unknown error";
      errors.push({ token, reason });
    }
  });

  return { jobs, errors };
}
