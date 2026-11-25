import type { Invoice, Job } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

const SUFFIXES: Record<string, string> = {
  street: "st", st: "st",
  avenue: "ave", ave: "ave", av: "ave",
  road: "rd", rd: "rd",
  drive: "dr", dr: "dr",
  court: "ct", ct: "ct",
  lane: "ln", ln: "ln",
  boulevard: "blvd", blvd: "blvd",
  place: "pl", pl: "pl",
  circle: "cir", cir: "cir",
  way: "way", parkway: "pkwy", pkwy: "pkwy",
  highway: "hwy", hwy: "hwy", terrace: "ter", ter: "ter",
};

/** "2700 Plaza Court, Dixon CA" -> ["2700","plaza","ct","dixon","ca"] */
export function addressTokens(s: string | null | undefined): string[] {
  return normalizeText(s)
    .split(" ")
    .filter(Boolean)
    .map((t) => SUFFIXES[t] ?? t);
}

export type JobSuggestion = { jobId: string; score: number; reason: string };

/**
 * Suggest the job for an invoice.
 * Strong signals: job number written on the invoice, or the same house number + street name.
 */
export function suggestJob(
  inv: Pick<Invoice, "shipTo"> & { jobReference?: string | null; text?: string | null },
  jobs: Pick<Job, "id" | "name" | "jobNumber" | "address" | "city" | "archived">[],
): JobSuggestion | null {
  const haystack = normalizeText([inv.shipTo, inv.jobReference, inv.text].filter(Boolean).join(" "));
  const shipTokens = addressTokens(inv.shipTo);
  let best: JobSuggestion | null = null;

  for (const job of jobs) {
    if (job.archived) continue;
    let score = 0;
    const reasons: string[] = [];

    const jobNo = normalizeText(job.jobNumber);
    if (jobNo && new RegExp(`(^| )${jobNo}( |$)`).test(haystack)) {
      score += 100;
      reasons.push(`job # ${job.jobNumber}`);
    }

    const jobAddr = addressTokens(job.address);
    const houseNo = jobAddr.find((t) => /^\d+$/.test(t));
    const streetWords = jobAddr.filter((t) => !/^\d+$/.test(t));
    if (houseNo && shipTokens.includes(houseNo)) {
      const matched = streetWords.filter((w) => shipTokens.includes(w)).length;
      if (streetWords.length > 0 && matched / streetWords.length >= 0.5) {
        score += 80;
        reasons.push(`address ${job.address}`);
      }
    }

    const city = normalizeText(job.city);
    if (city && score > 0 && haystack.includes(city)) score += 10;

    if (!best || score > best.score) best = score > 0 ? { jobId: job.id, score, reason: reasons.join(" + ") } : best;
  }
  return best && best.score >= 80 ? best : null;
}
