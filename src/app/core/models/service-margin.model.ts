import { CreditScenario } from './credit-payer.model';

/** A credit pack as the margin is read against it: what it sells for in India (before tax) and so what one of its credits is worth. */
export interface ServiceMarginPack {
  id: string;
  name: string;
  credits: number;
  priceInr: number;
  inrPerCredit: number;
}

/** What one item of a service earns when its credits come from one pack. */
export interface ServiceMarginByPack {
  packId: string;
  chargeInr: number;
  /** Null when the cost is not known, so there is nothing to take it from. */
  marginInr: number | null;
  marginPercent: number | null;
}

/** One line of the Service margins screen (GET /platform/service-margins). */
export interface ServiceMarginRow {
  scenario: CreditScenario;
  title: string;
  unitLabel: string;
  /** Null when the platform does not record what the service costs it (Content Studio), or has no calls to work it out from yet. */
  costUsd: number | null;
  costInr: number | null;
  /** Where the cost came from: real calls in the last 30 days, or the price list and typical usage. */
  costBasis: string;
  samples: number;
  /** The platform cannot work this cost out, so the admin may type it (Content Studio). */
  costEditable: boolean;
  /** The cost shown is the one the admin typed. */
  costIsManual: boolean;
  /** The setting: credits one unit draws. */
  creditsPerUnit: number;
  /** How many of those units one item draws - 1, except for a WhatsApp message, which depends on its category. */
  unitsPerItem: number;
  creditsCharged: number;
  paidByPlatform: boolean;
  byPack: ServiceMarginByPack[];
}

export interface ServiceMargins {
  inrPerUsd: number;
  packs: ServiceMarginPack[];
  rows: ServiceMarginRow[];
  notes: string[];
}

export interface UpdateServiceMarginsRequest {
  charges: { scenario: CreditScenario; creditsPerUnit: number }[];
  /** What a unit costs, in rupees, for the services whose cost is typed. Null clears it. */
  manualCosts: { scenario: CreditScenario; costInr: number | null }[];
}

/** The setting that makes one item draw the given credits: the credits per unit, which for a WhatsApp message is per marketing message. */
export function creditsPerUnitFor(row: ServiceMarginRow, creditsCharged: number): number {
  return row.unitsPerItem > 0 ? round(creditsCharged / row.unitsPerItem, 4) : creditsCharged;
}

/** What the screen shows for a row while its credits are being typed, before they are saved. The charge is the typed credits times each pack's rupees per credit. */
export function previewRow(row: ServiceMarginRow, packs: ServiceMarginPack[], creditsCharged: number, typedCostInr?: number | null): ServiceMarginRow {
  // A cost the admin types replaces the saved one while it is being typed; every other cost is worked out and stays as it is.
  const costInr = row.costEditable && typedCostInr !== undefined ? typedCostInr : row.costInr;
  return {
    ...row,
    costInr,
    creditsPerUnit: creditsPerUnitFor(row, creditsCharged),
    creditsCharged,
    byPack: packs.map((pack) => {
      const chargeInr = round(creditsCharged * pack.inrPerCredit, 4);
      const marginInr = costInr === null ? null : chargeInr - costInr;
      return {
        packId: pack.id,
        chargeInr,
        marginInr,
        marginPercent: marginInr !== null && chargeInr > 0 ? round((marginInr / chargeInr) * 100, 1) : null,
      };
    }),
  };
}

export function onPack(row: ServiceMarginRow, pack: ServiceMarginPack): ServiceMarginByPack | undefined {
  return row.byPack.find((p) => p.packId === pack.id);
}

function round(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}
