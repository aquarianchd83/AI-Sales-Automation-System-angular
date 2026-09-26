import { TenantJobRunOutcome } from './platform.model';

export { TenantJobDefinition, TenantJobRunOutcome, TENANT_JOB_RUN_OUTCOME_LABELS } from './platform.model';

/**
 * TenantJobDto (GET/PUT/POST /jobs) — one of the calling tenant's own recurring jobs: campaign sending
 * and lead discovery only. The tenant-facing counterpart of PlatformTenantJob, with every
 * platform-identity field (tenantId/tenantName/tenantSlug/tenantStatus) trimmed off.
 *
 * `isRegistered` false while `isEnabled` is true means your account's own status makes it ineligible
 * right now (see the parent TenantJobs.runsBackgroundJobs), not that the schedule itself is wrong.
 */
export interface TenantJob {
  jobType: string;
  displayName: string;
  description: string;
  cronExpression: string;
  defaultCron: string;
  isEnabled: boolean;
  isRegistered: boolean;
  nextExecutionUtc: string | null;
  lastExecutionUtc: string | null;
  hangfireLastJobState: string | null;
  lastRunAtUtc: string | null;
  lastRunOutcome: TenantJobRunOutcome | null;
  lastRunSummary: string | null;
  lastRunDurationMs: number | null;
  consecutiveFailureCount: number;
}

/** TenantJobsDto. `runsBackgroundJobs` false means your account's own status (e.g. suspended) makes
 * every job ineligible right now, regardless of any individual job's own `isEnabled`. */
export interface TenantJobs {
  runsBackgroundJobs: boolean;
  jobs: TenantJob[];
}

export interface UpdateTenantJobScheduleRequest {
  cronExpression: string;
  isEnabled: boolean;
}

/** PlatformJobTriggerResultDto. `backgroundJobId` is Hangfire's id for the one-off run. */
export interface TenantJobTriggerResult {
  recurringJobId: string;
  backgroundJobId: string;
}
