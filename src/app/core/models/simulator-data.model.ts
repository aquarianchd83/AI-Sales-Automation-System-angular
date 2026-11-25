/** Mirrors SimulatorDataCategory on the API (sent as numbers). */
export enum SimulatorDataCategory {
  LeadBusiness = 0,
  AiReply = 1,
  IntentKeywords = 2,
  TaskAnswer = 3,
  DndNumber = 4,
  Setting = 5,
}

/** Mirrors SimulatorLeadVariant on the API. */
export enum SimulatorLeadVariant {
  Qualified = 0,
  PhoneNotOnPage = 1,
  PermanentlyClosed = 2,
}

export const SIMULATOR_CATEGORY_TABS: { category: SimulatorDataCategory; label: string; icon: string; help: string }[] = [
  {
    category: SimulatorDataCategory.LeadBusiness,
    label: 'Lead businesses',
    icon: 'storefront',
    help: 'Lead Discovery (simulator) yahi businesses return karta hai. Jo kind search ho rahi hai wo pehle aati hai, City khali ho to run ki location use hoti hai.',
  },
  {
    category: SimulatorDataCategory.AiReply,
    label: 'AI replies',
    icon: 'chat',
    help: 'WhatsApp inbox mein simulated AI ke canned replies.',
  },
  {
    category: SimulatorDataCategory.IntentKeywords,
    label: 'Intent keywords',
    icon: 'label',
    help: 'Customer ke message mein ye words hon to simulated AI ye intent pick karta hai (comma se alag karein).',
  },
  {
    category: SimulatorDataCategory.TaskAnswer,
    label: 'Task answers',
    icon: 'fact_check',
    help: 'Product knowledge tasks ke predefined answers. Har answer ke aage [SIMULATED] khud lagta hai.',
  },
  {
    category: SimulatorDataCategory.DndNumber,
    label: 'DND numbers',
    icon: 'phone_disabled',
    help: 'In numbers ko simulated DND check hamesha reject karta hai.',
  },
  {
    category: SimulatorDataCategory.Setting,
    label: 'Settings',
    icon: 'tune',
    help: 'Simulator ke switches.',
  },
];

export const SIMULATOR_VARIANT_LABELS: Record<SimulatorLeadVariant, string> = {
  [SimulatorLeadVariant.Qualified]: 'Qualifies',
  [SimulatorLeadVariant.PhoneNotOnPage]: 'Phone not on page (rejected)',
  [SimulatorLeadVariant.PermanentlyClosed]: 'Permanently closed (rejected)',
};

export interface SimulatorDummyRecord {
  id: string;
  category: SimulatorDataCategory;
  name: string;
  value: string | null;
  businessType: string | null;
  contactPerson: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  leadScore: number | null;
  variant: SimulatorLeadVariant | null;
  isActive: boolean;
  displayOrder: number;
  /** UTC, sent without a Z - shown through the zonedDate pipe. */
  createdAt: string;
  updatedAt: string | null;
}

export interface SimulatorKey {
  category: SimulatorDataCategory;
  key: string;
  defaultValue: string;
  help: string;
}

export interface SimulatorDummyData {
  records: SimulatorDummyRecord[];
  keys: SimulatorKey[];
}

export type SaveSimulatorDummyRecordRequest = Omit<SimulatorDummyRecord, 'id' | 'createdAt' | 'updatedAt'>;

/** A keyed kind (AI replies, keywords, answers, settings) holds one row per listed key. */
export function isKeyedCategory(category: SimulatorDataCategory): boolean {
  return (
    category === SimulatorDataCategory.AiReply ||
    category === SimulatorDataCategory.IntentKeywords ||
    category === SimulatorDataCategory.TaskAnswer ||
    category === SimulatorDataCategory.Setting
  );
}
