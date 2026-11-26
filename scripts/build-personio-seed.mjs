#!/usr/bin/env node
/**
 * Rebuild src/lib/scraper/personio/companies.json from a public Personio board
 * directory, keeping only slugs whose XML feed currently returns ≥1 position.
 *
 * Usage:
 *   node scripts/build-personio-seed.mjs
 *   node scripts/build-personio-seed.mjs --csv /path/to/personio.csv
 *   node scripts/build-personio-seed.mjs --concurrency 3 --delay-ms 150
 *
 * Default source:
 *   https://kalebconfer-sys.github.io/job-board-directory/personio.csv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src/lib/scraper/personio/companies.json");
const DEFAULT_CSV =
  "https://kalebconfer-sys.github.io/job-board-directory/personio.csv";
const TOKEN_RE = /^[a-z0-9][a-z0-9_-]{1,79}$/;

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

const csvPath = flag("--csv", null);
const concurrency = Number(flag("--concurrency", "4"));
const delayMs = Number(flag("--delay-ms", "120"));
const includeEmptyCsv = args.includes("--include-zero");

const NAME_OVERRIDES = {
  "1komma5grad": "1KOMMA5°",
  "init-ag": "]init[ AG",
  ada: "Ada Health",
  "autonomous-teaming": "Autonomous Teaming",
  "auxmoney-gmbh": "Auxmoney",
  clark: "Clark",
  contorion: "Contorion",
  dental21: "Dental21",
  fairmas: "Fairmas",
  "getpress-gmbh": "getpress",
  holidaycheck: "HolidayCheck",
  "indra-avitech": "Indra Avitech",
  join: "Join",
  "kipu-quantum": "Kipu Quantum",
  "liveeo-gmbh": "LiveEO",
  penta: "Penta",
  personio: "Personio",
  smartbroker: "Smartbroker",
  thermondo: "Thermondo",
  tonies: "Tonies",
  "tomorrow-gmbh": "Tomorrow",
  verivox: "Verivox",
  vivid: "Vivid",
  westwing: "Westwing",
};

function humanize(token) {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayName(token, company) {
  if (NAME_OVERRIDES[token]) return NAME_OVERRIDES[token];
  const raw = (company || "").trim();
  if (raw && raw.toLowerCase() !== token) return raw;
  return humanize(token);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header?.startsWith("platform,")) {
    throw new Error("Unexpected CSV header: " + header);
  }
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple CSV: no quoted commas in this dataset.
    const [platform, token, company, board_url, api_url, open_roles] =
      line.split(",");
    if (platform !== "personio" || !token) continue;
    const t = token.toLowerCase();
    if (!TOKEN_RE.test(t)) continue;
    const roles = Number(open_roles);
    rows.push({
      token: t,
      company: company || t,
      boardUrl: board_url || "",
      openRoles: Number.isFinite(roles) ? roles : 0,
    });
  }
  return rows;
}

function hostFromUrl(boardUrl) {
  if (/\.jobs\.personio\.com\b/i.test(boardUrl)) return "com";
  return "de";
}

async function probe(token, host) {
  const url = `https://${token}.jobs.personio.${host}/xml?language=de`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "JobSync-PersonioSeedBuilder/1.0" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const jobs = (xml.match(/<position>/g) || []).length;
    return jobs > 0 ? { host, jobs } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function validateRow(row) {
  const preferred = hostFromUrl(row.boardUrl);
  const other = preferred === "de" ? "com" : "de";
  let hit = await probe(row.token, preferred);
  if (!hit) hit = await probe(row.token, other);
  if (!hit) return null;
  return {
    name: displayName(row.token, row.company),
    token: row.token,
    _jobs: hit.jobs,
    _host: hit.host,
  };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

const csvText = csvPath
  ? readFileSync(csvPath, "utf8")
  : await (await fetch(DEFAULT_CSV)).text();

const all = parseCsv(csvText);
const candidates = includeEmptyCsv
  ? all
  : all.filter((r) => r.openRoles > 0);

// Dedupe by token, keep highest reported open_roles.
const byToken = new Map();
for (const row of candidates) {
  const prev = byToken.get(row.token);
  if (!prev || row.openRoles > prev.openRoles) byToken.set(row.token, row);
}
const unique = [...byToken.values()].sort((a, b) =>
  a.token.localeCompare(b.token),
);

console.log(
  `Candidates: ${unique.length} (from ${all.length} CSV rows; skipped zero-role: ${!includeEmptyCsv})`,
);
console.log(`Probing with concurrency=${concurrency}, delayMs=${delayMs}…`);

let checked = 0;
const results = await mapPool(unique, concurrency, async (row) => {
  const hit = await validateRow(row);
  checked++;
  if (checked % 25 === 0 || checked === unique.length) {
    process.stdout.write(`  checked ${checked}/${unique.length}\n`);
  }
  return hit;
});

const live = results.filter(Boolean).map(({ name, token }) => ({ name, token }));

// Keep previously shipped boards if this run was rate-limited mid-way.
let previous = [];
try {
  previous = JSON.parse(readFileSync(OUT, "utf8"));
} catch {
  previous = [];
}
const mergedByToken = new Map(previous.map((c) => [c.token, c]));
for (const row of live) mergedByToken.set(row.token, row);
for (const [token, name] of Object.entries(NAME_OVERRIDES)) {
  const row = mergedByToken.get(token);
  if (row) row.name = name;
  else mergedByToken.set(token, { name, token });
}

const merged = [...mergedByToken.values()].sort((a, b) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
);

writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
console.log(
  `Wrote ${merged.length} boards → ${OUT} (live=${live.length}, kept previous gaps=${merged.length - live.length})`,
);
