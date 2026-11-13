// CV-to-skills parser (demo). Deterministic keyword extraction against the Talent Network's own
// vocabulary plus a small built-in dictionary. It fills a form the user still checks; it does not
// invent anything that is not in the pasted text.

import type { SeniorityLevel } from "./tessiant-types";

export interface ParsedCv {
  name: string | null;
  headline: string | null;
  skills: string[];
  sectors: string[];
  seniority: SeniorityLevel;
  yearsExperience: number | null;
  rate: number | null;
  location: string | null;
  summary: string | null;
  /** What was found, for the "check before saving" line. */
  found: string[];
  /** 0–100: how much of the form the text could fill. */
  coverage: number;
}

const BUILT_IN_SKILLS = [
  "SAP", "S/4HANA", "Solution architecture", "Programme management", "Project management", "PMO", "Change management", "Data platforms", "Azure", "AWS", "Governance",
  "Cybersecurity", "Zero trust", "Architecture", "HR transformation", "Retail transformation", "Basis", "Agile", "Scrum", "Finance transformation", "Operating model",
  "Procurement", "Supply chain", "ERP", "Salesforce", "Dynamics 365", "Oracle", "Integration", "Cloud", "Power BI", "Stakeholder management", "Risk",
];
const BUILT_IN_SECTORS = ["Retail", "Financial services", "Manufacturing", "Consumer", "Professional services", "Energy", "Public sector", "Healthcare", "Technology", "Utilities", "Telecoms"];
const UK_PLACES = ["London", "Manchester", "Leeds", "Birmingham", "Edinburgh", "Glasgow", "Bristol", "Reading", "Cambridge", "Oxford", "Belfast", "Cardiff", "Newcastle", "Sheffield", "Liverpool", "Nottingham", "Stockholm", "Lisbon", "Dublin", "Amsterdam"];

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function findTerms(text: string, vocabulary: string[]): string[] {
  const hits: Array<{ term: string; index: number }> = [];
  for (const term of vocabulary) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escape(term)}(?=$|[^a-z0-9])`, "i");
    const match = pattern.exec(text);
    if (match) hits.push({ term, index: match.index });
  }
  const seen = new Set<string>();
  return hits
    .sort((a, b) => a.index - b.index)
    .map((hit) => hit.term)
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseCv(text: string, vocabulary: { skills: string[]; sectors: string[] }): ParsedCv {
  const clean = text.replace(/\r/g, "").trim();
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  const found: string[] = [];

  const skills = findTerms(clean, [...new Set([...vocabulary.skills, ...BUILT_IN_SKILLS])]).slice(0, 10);
  if (skills.length) found.push(`${skills.length} skill${skills.length === 1 ? "" : "s"}`);
  const sectors = findTerms(clean, [...new Set([...vocabulary.sectors, ...BUILT_IN_SECTORS])]).slice(0, 4);
  if (sectors.length) found.push(`${sectors.length} sector${sectors.length === 1 ? "" : "s"}`);

  const lower = clean.toLowerCase();
  const seniority: SeniorityLevel = /\b(chief|cxo|cio|cto|cfo|coo|managing partner|partner|executive director)\b/.test(lower)
    ? "executive"
    : /\b(head of|director|principal|vp|vice president)\b/.test(lower)
      ? "principal"
      : /\b(senior|lead|manager)\b/.test(lower)
        ? "senior"
        : "mid";
  found.push(`seniority read as ${seniority}`);

  const years = /(\d{1,2})\s*\+?\s*years?/i.exec(clean);
  const yearsExperience = years ? Number(years[1]) : null;
  if (yearsExperience) found.push(`${yearsExperience} years' experience`);

  const rate = /(?:£|gbp)\s?(\d{3,4})\s*(?:\/|per)\s*day/i.exec(clean);
  const rateValue = rate ? Number(rate[1]) : null;
  if (rateValue) found.push(`day rate £${rateValue}`);

  const place = UK_PLACES.find((city) => new RegExp(`\\b${escape(city)}\\b`, "i").test(clean));
  const mode = /\bremote\b/i.test(clean) ? "remote" : /\bhybrid\b/i.test(clean) ? "hybrid" : null;
  const location = place ? `${place}, UK${mode ? ` · ${mode}` : ""}` : mode ? `UK · ${mode}` : null;
  if (location) found.push("location");

  // Name: first short line with two or more capitalised words and no digits.
  const name = lines.find((line) => line.length <= 40 && !/\d|@/.test(line) && /^[A-Z][a-z'-]+(\s+[A-Z][a-z'-]+)+$/.test(line)) ?? null;
  if (name) found.push("name");
  // Headline: the first line after the name that reads like a title.
  const headline = lines.find((line) => line !== name && line.length >= 8 && line.length <= 80 && !/@|\d{3}/.test(line) && !/^(summary|profile|experience|skills)/i.test(line)) ?? null;
  if (headline) found.push("headline");
  // Summary: the first paragraph-like line.
  const summary = lines.find((line) => line.length > 80)?.replace(/^(summary|profile|about)\s*[:\-–]\s*/i, "") ?? null;
  if (summary) found.push("summary");

  const filled = [skills.length > 0, sectors.length > 0, Boolean(rateValue), Boolean(location), Boolean(name), Boolean(headline), Boolean(summary)].filter(Boolean).length;
  return { name, headline, skills, sectors, seniority, yearsExperience, rate: rateValue, location, summary: summary ? summary.slice(0, 400) : null, found, coverage: Math.round((filled / 7) * 100) };
}

export const SAMPLE_CV = `Priya Raman
Senior SAP S/4HANA Solution Architect
London, UK · hybrid · £1,050 per day

Summary: 14 years delivering SAP programmes across Manufacturing and Retail, most recently leading solution architecture for a group-wide S/4HANA migration with Azure integration and data governance workstreams.

Skills: SAP, S/4HANA, Solution architecture, Integration, Azure, Governance, Stakeholder management
Sectors: Manufacturing, Retail, Consumer`;
