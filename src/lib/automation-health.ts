export type AutomationCampaignHealth = {
  enabled: boolean;
  mode: string;
  lastStatus: string;
  lastRunAt?: string;
  nextRunAt?: string;
  latest?: { verified: boolean; action: string; summary?: string } | null;
};

const failedActions = new Set(['aborted', 'error', 'failed']);
const MAX_RUN_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_JOURNAL_AGE_MS = 3 * 60 * 60 * 1000;
const NEXT_RUN_GRACE_MS = 30 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const timestamp = (value: string | undefined) => value ? Date.parse(value) : Number.NaN;

export function isAutomationCampaignHealthy(campaign: AutomationCampaignHealth, generatedAt?: string, now = Date.now()) {
  const lastRun = timestamp(campaign.lastRunAt), nextRun = timestamp(campaign.nextRunAt), journal = timestamp(generatedAt);
  return Boolean(
    campaign.enabled &&
      campaign.mode === 'live' &&
      campaign.lastStatus === 'ok' &&
      campaign.latest?.verified &&
      !failedActions.has(campaign.latest.action) &&
      Number.isFinite(lastRun) && now - lastRun >= -MAX_CLOCK_SKEW_MS && now - lastRun <= MAX_RUN_AGE_MS &&
      Number.isFinite(nextRun) && nextRun > lastRun && now - nextRun <= NEXT_RUN_GRACE_MS && nextRun - now <= MAX_RUN_AGE_MS &&
      Number.isFinite(journal) && now - journal >= -MAX_CLOCK_SKEW_MS && now - journal <= MAX_JOURNAL_AGE_MS,
  );
}

export function automationCampaignLabel(campaign: AutomationCampaignHealth, generatedAt?: string, now = Date.now()) {
  if (isAutomationCampaignHealthy(campaign, generatedAt, now)) return 'LIVE';
  return campaign.enabled && campaign.mode === 'live' ? 'FEHLER' : 'PAUSIERT';
}

export function automationJournalFreshness(generatedAt: string | undefined, now = Date.now()): { ageHours: number | null; stale: boolean; label: string } {
  const journal = timestamp(generatedAt), ageMs = now - journal;
  if (!Number.isFinite(journal) || ageMs < -MAX_CLOCK_SKEW_MS) return { ageHours: null, stale: true, label: 'Journal-Stand unbekannt' };
  const ageHours = Math.max(0, Math.floor(ageMs / 3_600_000)), stale = ageMs > MAX_JOURNAL_AGE_MS;
  return { ageHours, stale, label: ageHours >= 1 ? `Journal-Stand vor ${ageHours} h` : `Journal-Stand vor ${Math.max(0, Math.floor(ageMs / 60_000))} min` };
}
