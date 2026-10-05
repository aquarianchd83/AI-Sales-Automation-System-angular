import { SetupOption } from '../models/application-setup.model';

/** "Dental clinics" -> "dental_clinics". Option values are stored with answers, so they stay plain and stable. */
export function slugifyOptionValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

/**
 * The admin types one option per line: `Instagram` (value derived from the label) or `ig | Instagram`
 * (explicit value). Blank lines are ignored; a repeated value keeps its first line.
 */
export function parseOptionLines(text: string): SetupOption[] {
  const seen = new Set<string>();
  const options: SetupOption[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    const bar = line.indexOf('|');
    const label = (bar >= 0 ? line.slice(bar + 1) : line).trim();
    const value = bar >= 0 ? line.slice(0, bar).trim() : slugifyOptionValue(line);
    if (!label || !value || seen.has(value.toLowerCase())) {
      continue;
    }
    seen.add(value.toLowerCase());
    options.push({ value, label });
  }

  return options;
}

/** Inverse of {@link parseOptionLines}; writes the short form when the value is just the slug of the label. */
export function formatOptionLines(options: SetupOption[]): string {
  return options.map((o) => (slugifyOptionValue(o.label) === o.value ? o.label : `${o.value} | ${o.label}`)).join('\n');
}
