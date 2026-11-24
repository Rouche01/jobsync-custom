"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_CONSTANTS } from "@/lib/constants";
import { toastInfo } from "@/lib/toast";
import { suggestAtsCompanies } from "@/actions/atsCompany.actions";
import type { RankedCompany } from "@/lib/scraper/ats/suggestCompanies";
import type { JobBoard, LeverCompany } from "@/models/automation.model";
import type { AtsConfigValue } from "./types";

interface CompanySuggestionsProps {
  provider: JobBoard;
  value: AtsConfigValue;
  selected: LeverCompany[];
  onAdd: (company: LeverCompany) => void;
  onAddMany: (boards: LeverCompany[]) => number;
}

const REASON_LABEL: Record<string, string> = {
  watchlist: "Watched",
  title: "Title",
  keyword: "Keyword",
};

function toLeverCompany(c: RankedCompany): LeverCompany {
  return {
    name: c.name,
    token: c.token,
    ...(c.host ? { host: c.host } : {}),
  };
}

export function CompanySuggestions({
  provider,
  value,
  selected,
  onAdd,
  onAddMany,
}: CompanySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<RankedCompany[]>([]);
  const [loading, setLoading] = useState(false);

  const targetTitles = value.targetTitles ?? [];
  const keywords = value.keywords ?? [];
  const criteriaKey = JSON.stringify({
    provider,
    targetTitles,
    keywords,
  });
  const selectedTokens = new Set(selected.map((c) => c.token));
  const atLimit = selected.length >= APP_CONSTANTS.ATS_MAX_COMPANIES;

  const unselected = suggestions.filter((c) => !selectedTokens.has(c.token));
  const hasCriteria = targetTitles.length > 0 || keywords.length > 0;

  useEffect(() => {
    const parsed = JSON.parse(criteriaKey) as {
      provider: JobBoard;
      targetTitles: string[];
      keywords: string[];
    };
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      suggestAtsCompanies({
        provider: parsed.provider,
        targetTitles: parsed.targetTitles,
        keywords: parsed.keywords,
        limit: APP_CONSTANTS.ATS_MAX_COMPANIES,
      })
        .then((res) => {
          if (!cancelled) setSuggestions(res.companies);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [criteriaKey]);

  const addAllSuggested = () => {
    const skipped = onAddMany(unselected.map(toLeverCompany));
    if (skipped > 0) {
      toastInfo(
        `Added what fits — ${skipped} skipped at the ${APP_CONSTANTS.ATS_MAX_COMPANIES}-company limit.`,
      );
    }
  };

  return (
    <div className="min-w-0 space-y-2 rounded-md border p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Label className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          Suggested companies
        </Label>
        {unselected.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={atLimit}
            onClick={addAllSuggested}
          >
            Add all suggested ({unselected.length})
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ranked from your titles, keywords, and watchlist. Locations filter jobs
        when the automation runs — they do not choose companies here.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding matches…
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {hasCriteria
            ? "No directory matches yet. Try different titles/keywords, or pick companies below."
            : "Add a target title or keyword above (or watch companies in Library) to see suggestions."}
        </p>
      )}

      {!loading && unselected.length > 0 && (
        <ul className="max-h-48 min-w-0 space-y-1 overflow-y-auto overflow-x-hidden">
          {unselected.map((c) => (
            <li
              key={c.token}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                disabled={atLimit}
                onClick={() => onAdd(toLeverCompany(c))}
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.token}
                </span>
              </button>
              <div className="flex min-w-0 flex-wrap gap-1">
                {c.reasons.map((r) => (
                  <Badge key={r} variant="outline" className="font-normal">
                    {REASON_LABEL[r] ?? r}
                  </Badge>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={atLimit}
                onClick={() => onAdd(toLeverCompany(c))}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!loading && suggestions.length > 0 && unselected.length === 0 && (
        <p className="text-sm text-muted-foreground">
          All suggestions are already selected.
        </p>
      )}
    </div>
  );
}
