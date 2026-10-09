import { TenantWhatsAppConfig } from './tenant-settings.model';

/** Mirrors the API's MetaSignupSteps keys, in the order the steps run. */
export type MetaSignupStepKey = 'authorization' | 'assets' | 'credentials' | 'registration' | 'webhook' | 'templates' | 'verification';

/** Not Started, In Progress, Action Required, Failed, Completed. */
export type MetaSignupStepStatus = 'NotStarted' | 'InProgress' | 'ActionRequired' | 'Failed' | 'Completed';

/** What the tenant can do about a blocked step; one button each. */
export type MetaIssueAction = 'None' | 'Retry' | 'Reconnect' | 'Verify' | 'ContactSupport' | 'AddCredits';

/** MetaIssueDto - a blocked step in plain words. Never holds Meta's raw error or a secret; `reference` is what to quote to support. */
export interface MetaIssue {
  code: string;
  step: string;
  title: string;
  message: string;
  primaryAction: MetaIssueAction;
  secondaryAction: MetaIssueAction | null;
  retryable: boolean;
  reference: string | null;
}

export interface MetaSignupStep {
  key: MetaSignupStepKey;
  title: string;
  status: MetaSignupStepStatus;
  detail: string | null;
}

export interface MetaTemplateSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export interface MetaSignupClientConfig {
  enabled: boolean;
  appId: string | null;
  configurationId: string | null;
  apiVersion: string;
  issue: MetaIssue | null;
}

/** MetaSignupResultDto. `status` is Completed only when everything messaging depends on is in place. */
export interface MetaSignupResult {
  status: 'Completed' | 'ActionRequired' | 'Failed';
  steps: MetaSignupStep[];
  issue: MetaIssue | null;
  config: TenantWhatsAppConfig | null;
  templates: MetaTemplateSummary | null;
}

/** What Meta's popup reported, sent on to the API (which re-checks all of it with Meta). */
export interface CompleteMetaSignupRequest {
  code: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  clientEvent: 'FINISH' | 'CANCEL' | 'ERROR' | null;
  clientStep: string | null;
  clientErrorMessage: string | null;
}
