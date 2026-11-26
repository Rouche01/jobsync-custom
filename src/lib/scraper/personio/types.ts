import type { PersonioHost } from "@/models/automation.model";

// Shape after fast-xml-parser (arrays forced for repeating Personio tags).
export interface PersonioJobDescription {
  name?: string;
  value?: string;
}

export interface PersonioSalaryInformation {
  min?: string | number;
  max?: string | number;
  currencySymbol?: string;
  currencyCode?: string;
  type?: string; // yearly | monthly | …
}

export interface PersonioPosition {
  id: string | number;
  name?: string;
  subcompany?: string;
  office?: string | string[];
  additionalOffices?: { office?: string | string[] };
  department?: string;
  recruitingCategory?: string;
  jobDescriptions?: { jobDescription?: PersonioJobDescription | PersonioJobDescription[] };
  employmentType?: string; // permanent | intern | trainee | freelance
  seniority?: string;
  schedule?: string; // full-time | part-time
  yearsOfExperience?: string;
  createdAt?: string;
  salaryInformation?: PersonioSalaryInformation;
}

export interface PersonioBoardXml {
  "workzag-jobs"?: {
    position?: PersonioPosition | PersonioPosition[];
  };
}

export interface PersonioCompany {
  name: string;
  token: string;
  host?: PersonioHost;
}
