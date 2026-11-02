/** The questions the AI asks a customer, per tenant. Mirrors the API's QualificationFieldDto and its limits. */

export const QUALIFICATION_DATA_TYPES = [
  { value: 'Text', label: 'Free text' },
  { value: 'Number', label: 'Number' },
  { value: 'Currency', label: 'Amount of money' },
  { value: 'Date', label: 'Date' },
  { value: 'Boolean', label: 'Yes / No' },
  { value: 'SingleChoice', label: 'One of a list' },
  { value: 'MultiChoice', label: 'Several of a list' },
  { value: 'PhoneNumber', label: 'Phone number' },
  { value: 'Email', label: 'Email' },
] as const;

export type QualificationDataType = (typeof QUALIFICATION_DATA_TYPES)[number]['value'];

export const QUALIFICATION_LIMITS = {
  fieldKey: 60,
  displayName: 100,
  description: 500,
  question: 300,
  allowedValue: 100,
  maxAllowedValues: 50,
  maxFields: 25,
} as const;

/** Lowercase snake_case starting with a letter - the key becomes an enum entry in the AI's tool schema. */
export const QUALIFICATION_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface QualificationField {
  id: string;
  fieldKey: string;
  displayName: string;
  description: string | null;
  question: string;
  dataType: QualificationDataType;
  isRequired: boolean;
  priority: number;
  scoreWeight: number;
  allowedValues: string[] | null;
  validationPattern: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  /** How many leads already have an answer, so someone turning a question off sees what it would stop collecting. */
  capturedLeadCount: number;
}

export interface CreateQualificationFieldRequest {
  fieldKey: string;
  displayName: string;
  description: string | null;
  question: string;
  dataType: QualificationDataType;
  isRequired: boolean;
  priority: number;
  scoreWeight: number;
  allowedValues: string[] | null;
  validationPattern: string | null;
  sortOrder: number;
}

/** The key cannot change after create: captured answers are stored against it. */
export type UpdateQualificationFieldRequest = Omit<CreateQualificationFieldRequest, 'fieldKey'>;

/** The one closing step a business offers customers. "Enquiry" is the API's name for "none". */
export const NEXT_STEP_OPTIONS = [
  { value: 'Enquiry', label: 'None - the AI only answers and asks questions' },
  { value: 'Demo', label: 'A demo' },
  { value: 'Appointment', label: 'An appointment' },
  { value: 'SiteVisit', label: 'A site visit' },
  { value: 'Consultation', label: 'A consultation' },
  { value: 'Registration', label: 'Registration' },
  { value: 'Purchase', label: 'Buying' },
] as const;

export const NEXT_STEP_DETAIL_MAX = 300;

export interface NextStep {
  goal: string;
  detail: string | null;
}

export function dataTypeLabel(value: string): string {
  return QUALIFICATION_DATA_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function needsChoices(dataType: string): boolean {
  return dataType === 'SingleChoice' || dataType === 'MultiChoice';
}

/** "Software you use today" -> "software_you_use_today": the suggested key while someone types the name. */
export function suggestFieldKey(displayName: string): string {
  const key = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '')
    .slice(0, QUALIFICATION_LIMITS.fieldKey);
  return key;
}

/** One choice per line or comma-separated, trimmed, blanks and repeats dropped. */
export function parseChoices(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,]/)) {
    const value = part.trim();
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}
