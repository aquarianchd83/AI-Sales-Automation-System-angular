/**
 * Plan-driven application setup. Everything the Talent is asked comes from the plan's pinned version (the
 * "definition"); nothing about any particular plan is known to the UI. The API enums travel by name.
 */

export type SetupFieldType =
  | 'Text'
  | 'MultilineText'
  | 'Number'
  | 'Decimal'
  | 'Currency'
  | 'Date'
  | 'Dropdown'
  | 'MultiSelect'
  | 'Radio'
  | 'Checkbox'
  | 'FileUpload'
  | 'Url'
  | 'Email'
  | 'Phone';

export const SETUP_FIELD_TYPES: { value: SetupFieldType; label: string; hint: string }[] = [
  { value: 'Text', label: 'Text', hint: 'A short answer' },
  { value: 'MultilineText', label: 'Multiline text', hint: 'A longer answer' },
  { value: 'Number', label: 'Number', hint: 'A whole number' },
  { value: 'Decimal', label: 'Decimal', hint: 'A number with decimals' },
  { value: 'Currency', label: 'Currency', hint: 'An amount of money, 0 or more' },
  { value: 'Date', label: 'Date', hint: 'A calendar date' },
  { value: 'Dropdown', label: 'Dropdown', hint: 'Pick one from a list' },
  { value: 'MultiSelect', label: 'Multi-select', hint: 'Pick several from a list' },
  { value: 'Radio', label: 'Radio buttons', hint: 'Pick one, all options visible' },
  { value: 'Checkbox', label: 'Checkbox', hint: 'Yes / no, or a confirmation' },
  { value: 'FileUpload', label: 'File upload', hint: 'An image from the media library' },
  { value: 'Url', label: 'URL', hint: 'A web address' },
  { value: 'Email', label: 'Email', hint: 'An email address' },
  { value: 'Phone', label: 'Phone number', hint: 'A phone number with country code' },
];

export type SetupConditionOperator = 'Equals' | 'NotEquals' | 'Contains' | 'In' | 'NotEmpty' | 'Empty';

export const SETUP_CONDITION_OPERATORS: { value: SetupConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'Equals', label: 'is', needsValue: true },
  { value: 'NotEquals', label: 'is not', needsValue: true },
  { value: 'Contains', label: 'includes', needsValue: true },
  { value: 'In', label: 'is one of (comma separated)', needsValue: true },
  { value: 'NotEmpty', label: 'has an answer', needsValue: false },
  { value: 'Empty', label: 'has no answer', needsValue: false },
];

export type ApplicationSetupStatus =
  | 'NotStarted'
  | 'InProgress'
  | 'Completed'
  | 'Incomplete'
  | 'Expired'
  | 'RequiresUpdate';

export type SetupVersionStatus = 'Draft' | 'Published' | 'Superseded';

export type SetupAuditAction =
  | 'ApplicationCreated'
  | 'ValueSet'
  | 'ValueCleared'
  | 'SetupCompleted'
  | 'PlanChanged'
  | 'VersionMigrated'
  | 'Executed'
  | 'ExecutionBlocked';

export interface SetupOption {
  value: string;
  label: string;
}

export interface SetupValidation {
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  patternMessage: string | null;
}

export interface SetupCondition {
  fieldKey: string;
  operator: SetupConditionOperator;
  value: string | null;
}

export interface SetupField {
  id: string;
  fieldKey: string;
  label: string;
  helpText: string | null;
  fieldType: SetupFieldType;
  isRequired: boolean;
  defaultValue: string | null;
  options: SetupOption[];
  validation: SetupValidation | null;
  displayOrder: number;
  section: string;
  condition: SetupCondition | null;
  metricKey: string | null;
  isActive: boolean;
}

export interface SetupSection {
  key: string;
  title: string;
  description: string;
  order: number;
  fields: SetupField[];
}

export interface SetupDefinition {
  planId: string;
  planCode: string;
  planName: string;
  versionId: string;
  versionNumber: number;
  sections: SetupSection[];
}

/** A typed answer: text, a number, a bool (checkbox) or a list (multi-select). */
export type SetupAnswer = string | number | boolean | string[] | null;
export type SetupAnswers = Record<string, SetupAnswer>;

export interface SetupFieldIssue {
  fieldKey: string;
  message: string;
}

export interface SetupSectionProgress {
  key: string;
  title: string;
  requiredCount: number;
  answeredCount: number;
  started: boolean;
  isComplete: boolean;
}

export interface SetupEvaluation {
  isComplete: boolean;
  percentComplete: number;
  visibleFieldKeys: string[];
  missing: SetupFieldIssue[];
  invalid: SetupFieldIssue[];
  sections: SetupSectionProgress[];
}

export interface ApplicationProjection {
  hasData: boolean;
  packagePrice: number | null;
  expectedCustomers: number | null;
  expectedLeads: number | null;
  expectedRevenue: number | null;
  marketingCost: number;
  socialMediaCost: number;
  operationalCost: number;
  totalCost: number;
  expectedProfit: number | null;
  roiPercent: number | null;
  missingInputs: string[];
}

export interface PlanApplication {
  id: string;
  name: string;
  planId: string;
  planCode: string;
  planName: string;
  planSetupVersionId: string;
  versionNumber: number;
  newerVersionAvailable: boolean;
  status: 'Active' | 'Archived';
  setupStatus: ApplicationSetupStatus;
  setupPercent: number;
  setupCompletedAt: string | null;
  setupExpiresAt: string | null;
  lastExecutedAt: string | null;
  executionCount: number;
  canExecute: boolean;
  createdAt: string;
}

export interface ApplicationSetup {
  application: PlanApplication;
  definition: SetupDefinition;
  values: SetupAnswers;
  evaluation: SetupEvaluation;
  projection: ApplicationProjection;
}

export interface SaveSetupRequest {
  /** Partial: only the keys sent are touched; null clears an answer. */
  values: SetupAnswers;
  complete: boolean;
  reason?: string | null;
}

export interface SaveSetupResult {
  completed: boolean;
  changedCount: number;
  setup: ApplicationSetup;
}

export interface AvailablePlan {
  planId: string;
  code: string;
  name: string;
  priceMonthlyCents: number;
  versionNumber: number;
  fieldCount: number;
  requiredFieldCount: number;
  sections: string[];
}

export interface ApplicationExecution {
  id: string;
  applicationId: string;
  planVersionLabel: string;
  startedAt: string;
  fieldCount: number;
}

export interface SetupAuditEntry {
  id: string;
  action: SetupAuditAction;
  fieldKey: string | null;
  fieldLabel: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  planVersionLabel: string;
  performedBy: string | null;
  performedByName: string | null;
  byPlatformSupport: boolean;
  performedAt: string;
}

// ---- Admin ---------------------------------------------------------------------------------------------------------

export interface SetupVersionSummary {
  id: string;
  versionNumber: number;
  status: SetupVersionStatus;
  releaseNotes: string | null;
  validityDays: number | null;
  requirementCount: number;
  applicationCount: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface PlanSetupSummary {
  planId: string;
  planCode: string;
  planName: string;
  planIsActive: boolean;
  versions: SetupVersionSummary[];
}

export interface SetupSectionInfo {
  key: string;
  title: string;
  description: string;
  order: number;
}

export interface SetupVersionDetail {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  versionNumber: number;
  status: SetupVersionStatus;
  releaseNotes: string | null;
  validityDays: number | null;
  publishedAt: string | null;
  applicationCount: number;
  fields: SetupField[];
  sections: SetupSectionInfo[];
  metricKeys: string[];
}

export interface SaveRequirementRequest {
  fieldKey: string;
  label: string;
  helpText: string | null;
  fieldType: SetupFieldType;
  isRequired: boolean;
  defaultValue: string | null;
  options: SetupOption[] | null;
  validation: SetupValidation | null;
  displayOrder: number;
  section: string;
  condition: SetupCondition | null;
  metricKey: string | null;
  isActive: boolean;
}

export interface SaveSetupVersionRequest {
  releaseNotes: string | null;
  validityDays: number | null;
}

// ---- Presentation helpers ------------------------------------------------------------------------------------------

export const SETUP_STATUS_LABELS: Record<ApplicationSetupStatus, string> = {
  NotStarted: 'Setup required',
  InProgress: 'Setup in progress',
  Completed: 'Setup completed',
  Incomplete: 'Setup incomplete',
  Expired: 'Setup expired',
  RequiresUpdate: 'Update required',
};

/** CSS modifier for a status chip: ok / warn / bad / neutral. */
export function setupStatusTone(status: ApplicationSetupStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (status) {
    case 'Completed':
      return 'ok';
    case 'InProgress':
      return 'warn';
    case 'Incomplete':
    case 'RequiresUpdate':
    case 'Expired':
      return 'bad';
    default:
      return 'neutral';
  }
}

export function setupStatusIcon(status: ApplicationSetupStatus): string {
  switch (status) {
    case 'Completed':
      return 'check_circle';
    case 'InProgress':
      return 'timelapse';
    case 'Incomplete':
      return 'error_outline';
    case 'RequiresUpdate':
      return 'update';
    case 'Expired':
      return 'event_busy';
    default:
      return 'radio_button_unchecked';
  }
}

/** True when the primary action should read "Complete Setup" rather than "View / Edit Setup". */
export function needsSetup(status: ApplicationSetupStatus): boolean {
  return status !== 'Completed';
}

export const SETUP_AUDIT_LABELS: Record<SetupAuditAction, string> = {
  ApplicationCreated: 'Application created',
  ValueSet: 'Answer saved',
  ValueCleared: 'Answer cleared',
  SetupCompleted: 'Setup confirmed',
  PlanChanged: 'Plan changed',
  VersionMigrated: 'Moved to a newer version',
  Executed: 'Application run',
  ExecutionBlocked: 'Run blocked — setup incomplete',
};

export function describeSetupSection(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}
