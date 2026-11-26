import { APP_CONSTANTS } from "@/lib/constants";
import type { AtsCompanyHost, JobBoard } from "@/models/automation.model";

// Public job-board URL for a company. Lever and Personio hosts are region/
// TLD-specific and persisted on the company so we never re-probe.
export function companyBoardUrl(
  jobBoard: JobBoard,
  company: { token: string; host?: AtsCompanyHost },
): string {
  if (jobBoard === "lever") {
    const base =
      company.host === "eu"
        ? APP_CONSTANTS.LEVER_EU_JOB_URL
        : APP_CONSTANTS.LEVER_JOB_URL;
    return `${base}/${company.token}`;
  }
  if (jobBoard === "ashby") {
    return `${APP_CONSTANTS.ASHBY_JOB_URL}/${company.token}`;
  }
  if (jobBoard === "personio") {
    const template =
      company.host === "com"
        ? APP_CONSTANTS.PERSONIO_JOB_URL_COM
        : APP_CONSTANTS.PERSONIO_JOB_URL_DE;
    return template.replace("{slug}", encodeURIComponent(company.token));
  }
  return `${APP_CONSTANTS.GREENHOUSE_BOARD_URL}/${company.token}`;
}
