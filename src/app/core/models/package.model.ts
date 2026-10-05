export type PackageDurationUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

export const PACKAGE_DURATION_UNITS: PackageDurationUnit[] = ['Days', 'Weeks', 'Months', 'Years'];

/** PackageDto. `projectedRevenue` is price x expectedSales per month, worked out by the API. */
export interface SalesPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationValue: number;
  durationUnit: PackageDurationUnit;
  features: string[];
  expectedSales: number;
  projectedRevenue: number;
  isActive: boolean;
  createdAt: string;
}

/** SavePackageRequest — the same body creates and updates. */
export interface SavePackageRequest {
  name: string;
  description: string | null;
  price: number;
  durationValue: number;
  durationUnit: PackageDurationUnit;
  features: string[];
  expectedSales: number;
  isActive: boolean;
}

/** PackageSummaryDto — totals over the tenant's active packages only. */
export interface PackageSummary {
  activePackages: number;
  totalExpectedSales: number;
  totalProjectedRevenue: number;
}

/** SavePackageRequestValidator — mirrored so the form fails the same values. */
export const PACKAGE_LIMITS = {
  name: 150,
  description: 1000,
  maxPrice: 1_000_000_000,
  maxDuration: 1000,
  maxExpectedSales: 1_000_000,
  maxFeatures: 20,
  featureLength: 200,
};

/** "3 Months", "1 Year" — singular when the value is 1. */
export function formatPackageDuration(value: number, unit: PackageDurationUnit): string {
  return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
}

/** The features textarea holds one feature per line; blank lines are dropped. */
export function parseFeatureLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** PackageSaleDto — one recorded sale. `customerName` is null for a sale with no customer attached. */
export interface PackageSale {
  id: string;
  packageId: string;
  packageName: string;
  customerId: string | null;
  customerName: string | null;
  amount: number;
  soldAt: string;
}

/** RecordPackageSaleRequest — `amount` defaults to the package price and `soldAt` to now when omitted. */
export interface RecordPackageSaleRequest {
  packageId: string;
  customerId: string | null;
  amount: number | null;
  soldAt: string | null;
}
