import { StoryKnowledgeFact, StoryVariation } from '../../../core/models/story-studio.model';

/** One problem the business says it solves, as the picker shows it: a short name and the summary beside it. */
export interface ProblemOption {
  title: string;
  summary: string;
}

const PROBLEM_CATEGORY = /^problems?$/i;

/**
 * A "Problems" fact is often one sentence listing several: "Problems our product solves: 1) Lead Discovery: Find customers.; 2) ...".
 * Splits each into a title (shown in the dropdown) and a summary (shown beside it).
 */
export function parseProblems(facts: { category: string; statement: string }[]): ProblemOption[] {
  const out: ProblemOption[] = [];
  for (const f of facts.filter((x) => PROBLEM_CATEGORY.test((x.category ?? '').trim()))) {
    const statement = (f.statement ?? '').trim();
    const firstItem = statement.search(/(^|\s)1\)\s/);
    const parts = firstItem >= 0 ? statement.slice(firstItem).split(/(?:^|\s*;?\s+)\d+\)\s+/).filter((p) => p.trim()) : [statement];
    for (const raw of parts) {
      const text = raw.trim().replace(/[;\s]+$/, '');
      if (!text) {
        continue;
      }
      const colon = text.indexOf(':');
      const hasTitle = colon > 0 && colon < 80;
      const title = hasTitle ? text.slice(0, colon).trim() : text.length > 60 ? text.slice(0, 57) + '...' : text;
      const summary = hasTitle ? text.slice(colon + 1).trim() : text;
      out.push({ title, summary: summary || text });
    }
  }
  return out;
}

/** The statements of the facts whose category matches, one per line: used to prefill an answer the business already gave. */
export function factText(facts: StoryKnowledgeFact[], category: RegExp): string {
  return factList(facts, category).join('\n');
}

export function factList(facts: StoryKnowledgeFact[], category: RegExp): string[] {
  return facts.filter((f) => category.test((f.category ?? '').trim())).map((f) => (f.statement ?? '').trim()).filter(Boolean);
}

/** The seven answers (and the sector) a story is written from. */
export interface StoryBrief {
  sector: string;
  problem: string;
  audience: string;
  solution: string;
  capabilities: string;
  benefits: string;
  differentiator: string;
  callToAction: string;
}

const MAX_TOPIC = 4000;

/**
 * The topic sent to the script writer: the brief, the angle of the chosen variation, then every other verified fact as instructions to follow.
 * Audience and call to action also travel in their own story fields; they are repeated here so the script sees the whole brief in one place.
 */
export function buildStoryTopic(brief: StoryBrief, variation: StoryVariation | null, facts: StoryKnowledgeFact[]): string {
  const lines = [
    `Sector: ${brief.sector}`,
    `Problem: ${brief.problem}`,
    `Target audience: ${brief.audience}`,
    `Solution: ${brief.solution}`,
    brief.capabilities && `Key capabilities: ${brief.capabilities}`,
    brief.benefits && `Business benefits: ${brief.benefits}`,
    brief.differentiator && `Differentiator: ${brief.differentiator}`,
    brief.callToAction && `Call to action: ${brief.callToAction}`,
  ].filter(Boolean) as string[];
  if (variation) {
    lines.push(`Angle: ${variation.angle}. Opening line: ${variation.hook} Outline: ${variation.outline}`);
  }
  lines.push('Video flow: Problem, Solution, How it works, Business benefit, Call to action.');

  const rest = facts
    .filter((f) => !PROBLEM_CATEGORY.test((f.category ?? '').trim()))
    .map((f) => `- ${f.category}${f.subject ? ' / ' + f.subject : ''}: ${f.statement}`);
  const head = lines.join('\n');
  const out = rest.length ? `${head}\n\nBusiness facts to follow as instructions (use them exactly; do not contradict them):\n${rest.join('\n')}` : head;
  return out.length > MAX_TOPIC ? out.slice(0, MAX_TOPIC - 3) + '...' : out;
}
