import { StoryKnowledgeFact } from '../../../core/models/story-studio.model';
import { StoryBrief, buildStoryTopic, factText, parseProblems, parseStoryTopic } from './story-brief';

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

  describe('reading a stored topic back (for cloning)', () => {
    it('gives back the answers buildStoryTopic wrote, and nothing from the facts that follow', () => {
      const full: StoryBrief = {
        sector: 'Real estate', problem: 'Finding customers is slow', audience: 'Small business owners', solution: 'AI Lead Discovery',
        capabilities: 'Finds leads', benefits: 'Less manual work', differentiator: 'One platform', callToAction: 'Book a free demo',
      };
      const topic = buildStoryTopic(full, [fact('Offers', 'Problem: not a brief line'), fact('About', 'Sector: neither')]);

      expect(parseStoryTopic(topic)).toEqual(full);
    });

    it('leaves out the answers that were empty', () => {
      const topic = buildStoryTopic({ ...brief, capabilities: '', differentiator: '' }, []);

      const parsed = parseStoryTopic(topic);
      expect(parsed.capabilities).toBeUndefined();
      expect(parsed.differentiator).toBeUndefined();
      expect(parsed.benefits).toBe('Fewer missed calls');
    });

    it('keeps an answer that ran over several lines together', () => {
      const topic = buildStoryTopic({ ...brief, capabilities: 'Finds leads\nScores them\nSends follow-ups' }, []);

      expect(parseStoryTopic(topic).capabilities).toBe('Finds leads\nScores them\nSends follow-ups');
    });

    it('copes with an old or empty topic', () => {
      expect(parseStoryTopic('Problem: Waiting weeks for a wardrobe\nHow we solve it: 10 days')).toEqual({ problem: 'Waiting weeks for a wardrobe' });
      expect(parseStoryTopic('')).toEqual({});
      expect(parseStoryTopic(null)).toEqual({});
    });
  });
});
