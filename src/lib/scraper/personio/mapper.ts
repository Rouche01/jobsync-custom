import { APP_CONSTANTS } from "@/lib/constants";
import type { PersonioHost } from "@/models/automation.model";
import type { JobDetails } from "../types";
import type { PersonioJobDescription, PersonioPosition } from "./types";

export function personioBoardBase(slug: string, host: PersonioHost): string {
  const template =
    host === "com"
      ? APP_CONSTANTS.PERSONIO_JOB_URL_COM
      : APP_CONSTANTS.PERSONIO_JOB_URL_DE;
  return template.replace("{slug}", encodeURIComponent(slug));
}

function asStringList(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function jobDescriptionBlocks(
  position: PersonioPosition,
): PersonioJobDescription[] {
  const raw = position.jobDescriptions?.jobDescription;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function personioDescriptionHtml(position: PersonioPosition): string {
  return jobDescriptionBlocks(position)
    .map((block) => {
      const heading = block.name?.trim();
      const body = block.value?.trim() ?? "";
      if (!body && !heading) return "";
      if (!heading) return body;
      return `<h3>${heading}</h3>${body}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function personioLocations(position: PersonioPosition): string {
  const primary = asStringList(position.office);
  const additional = asStringList(position.additionalOffices?.office);
  return Array.from(new Set([...primary, ...additional])).join(", ");
}

export function personioSalary(position: PersonioPosition): string | undefined {
  const info = position.salaryInformation;
  if (!info) return undefined;
  const symbol = info.currencySymbol?.trim() || info.currencyCode?.trim() || "";
  const min = info.min != null ? String(info.min).trim() : "";
  const max = info.max != null ? String(info.max).trim() : "";
  if (!min && !max) return undefined;
  const range = min && max && min !== max ? `${min}–${max}` : min || max;
  const period = info.type?.trim();
  return [symbol ? `${symbol}${range}` : range, period].filter(Boolean).join(" ");
}

export function personioEmploymentType(
  position: PersonioPosition,
): string | undefined {
  const parts = [position.employmentType, position.schedule]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

/** EN copy is usable when it has a title and at least one non-empty body block. */
export function hasUsefulPersonioCopy(position: PersonioPosition): boolean {
  const title = (position.name ?? "").trim();
  if (!title) return false;
  // Headings alone do not count — Mittelstand EN feeds often ship empty CDATA
  // with section titles, and DE still has the real text.
  return jobDescriptionBlocks(position).some(
    (block) => (block.value ?? "").trim().length > 0,
  );
}

export function mapPersonioJob(
  position: PersonioPosition,
  companyName: string,
  slug: string,
  host: PersonioHost,
): JobDetails {
  const id = String(position.id).trim();
  const base = personioBoardBase(slug, host);

  return {
    title: (position.name ?? "").trim(),
    company: companyName,
    location: personioLocations(position),
    description: personioDescriptionHtml(position),
    url: `${base}/job/${encodeURIComponent(id)}`,
    postedDate: position.createdAt,
    salary: personioSalary(position),
    employmentType: personioEmploymentType(position),
  };
}
