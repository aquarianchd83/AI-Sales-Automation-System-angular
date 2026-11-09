import { StoryKnowledgeFact } from '../../../core/models/story-studio.model';
import { StoryBrief, buildStoryTopic, factText, parseProblems } from './story-brief';

const fact = (category: string, statement: string, subject: string | null = null): StoryKnowledgeFact => ({ id: category, category, subject, statement });

const brief: StoryBrief = {
  sector: 'Healthcare', problem: 'Patients wait too long', audience: 'Clinic owners', solution: 'AI Sales Agent',
  capabilities: '', benefits: 'Fewer missed calls', differentiator: '', callToAction: 'Book a free demo',
};

describe('story brief helpers', () => {
  it('splits a numbered Problems fact into titled problems', () => {
    const out = parseProblems([fact('Problems', 'Problems our product solves: 1) A: Do a.; 2) B: Do b.')]);
    expect(out).toEqual([{ title: 'A', summary: 'Do a.' }, { title: 'B', summary: 'Do b.' }]);
  });

  it('keeps an unnumbered problem whole, and shortens a long title', () => {
    const long = 'x'.repeat(100);
    const out = parseProblems([fact('Problem', long)]);
    expect(out.length).toBe(1);
    expect(out[0].title.length).toBe(60);
    expect(out[0].summary).toBe(long);
  });

  it('ignores facts that are not problems', () => {
    expect(parseProblems([fact('About', 'We are Bansal Corp.')])).toEqual([]);
  });

  it('joins the statements of the matching category, to prefill an answer', () => {
    expect(factText([fact('Benefits', 'Saves time'), fact('Benefits', 'Cuts cost'), fact('About', 'x')], /^benefits?$/i)).toBe('Saves time\nCuts cost');
  });

  it('builds the topic: the brief, then every non-problem fact as an instruction', () => {
    const topic = buildStoryTopic(brief, [
      fact('Problems', 'Problems: 1) A: a'), fact('Offers', '10% discount'), fact('Services', 'Wardrobes', 'Custom'),
    ]);
    expect(topic).toContain('Sector: Healthcare');
    expect(topic).toContain('Business benefits: Fewer missed calls');
    expect(topic).not.toContain('Key capabilities');
    expect(topic).toContain('- Offers: 10% discount');
    expect(topic).toContain('- Services / Custom: Wardrobes');
    expect(topic).not.toContain('Problems: 1)');
  });

  it('never exceeds the 4000 characters the API accepts', () => {
    const topic = buildStoryTopic(brief, [fact('About', 'y'.repeat(5000))]);
    expect(topic.length).toBe(4000);
    expect(topic.endsWith('...')).toBeTrue();
  });
});
